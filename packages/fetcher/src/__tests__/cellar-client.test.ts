import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CellarClient } from "../cellar-client.js";

describe("CellarClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns html and final url on a successful fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<html><body>ok</body></html>", {
        status: 200,
        headers: { "Content-Type": "application/xhtml+xml" },
      }),
    );
    // override url property since Response constructor doesn't set it
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      url: "https://publications.europa.eu/resource/celex/32024R1689",
      text: async () => "<html><body>ok</body></html>",
    } as unknown as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new CellarClient();
    const result = await client.fetchXhtml("32024R1689");

    expect(result.html).toBe("<html><body>ok</body></html>");
    expect(result.url).toBe("https://publications.europa.eu/resource/celex/32024R1689");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws on 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      url: "https://publications.europa.eu/resource/celex/BADCELEX",
      text: async () => "not found",
    } as unknown as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new CellarClient();
    await expect(client.fetchXhtml("BADCELEX")).rejects.toThrow(/HTTP 404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries with exponential backoff on 429 then succeeds", async () => {
    const okResponse = {
      ok: true,
      status: 200,
      url: "https://publications.europa.eu/resource/celex/32024R1689",
      text: async () => "<html>ok</html>",
    } as unknown as Response;
    const rateLimited = {
      ok: false,
      status: 429,
      url: "https://publications.europa.eu/resource/celex/32024R1689",
      text: async () => "rate limited",
    } as unknown as Response;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited)
      .mockResolvedValueOnce(rateLimited)
      .mockResolvedValueOnce(okResponse);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new CellarClient();
    const promise = client.fetchXhtml("32024R1689");
    // Advance through the two backoff windows (1s then 2s).
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.html).toBe("<html>ok</html>");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("accepts a custom user agent and sends it in the request header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: "https://publications.europa.eu/resource/celex/32024R1689",
      text: async () => "<html>ok</html>",
    } as unknown as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new CellarClient("test-agent/9.9");
    await client.fetchXhtml("32024R1689");

    const callArgs = fetchMock.mock.calls[0];
    const init = callArgs[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("test-agent/9.9");
    expect(headers.Accept).toBe("application/xhtml+xml");
    expect(headers["Accept-Language"]).toBe("eng");
  });
});
