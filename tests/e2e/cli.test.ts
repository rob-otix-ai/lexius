import { describe, it, expect } from "vitest";
import { execFile } from "child_process";
import { promisify } from "util";
import { isDatabaseAvailable } from "./setup.js";

const exec = promisify(execFile);

const CLI_PATH = new URL(
  "../../packages/cli/dist/index.js",
  import.meta.url,
).pathname;

async function runCli(...args: string[]): Promise<unknown> {
  const { stdout } = await exec("node", [CLI_PATH, ...args], {
    env: { ...process.env },
    cwd: import.meta.dirname,
    timeout: 30_000,
  });
  return JSON.parse(stdout);
}

describe.skipIf(!isDatabaseAvailable())("E2E CLI Tests", () => {
  it("classify --signals employment domain returns high-risk", async () => {
    const result = (await runCli(
      "classify",
      "--signals",
      '{"domain":"employment"}',
      "--format",
      "json",
    )) as Record<string, unknown>;

    expect(result.riskClassification).toBe("high");
  });

  it("deadlines returns array of deadlines", async () => {
    const result = await runCli("deadlines", "--format", "json");

    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBeGreaterThan(0);
  });

  it("obligations --role provider --risk high-risk returns obligations", async () => {
    const result = await runCli(
      "obligations",
      "--role",
      "provider",
      "--risk",
      "high-risk",
      "--format",
      "json",
    );

    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBeGreaterThan(0);
  });

  it("penalty --violation prohibited --turnover 500000000 returns penalty", async () => {
    const result = (await runCli(
      "penalty",
      "--violation",
      "prohibited",
      "--turnover",
      "500000000",
      "--format",
      "json",
    )) as Record<string, unknown>;

    expect(result.calculatedFine).toBeGreaterThan(0);
  });

  it("article 5 returns article with Prohibited in title", async () => {
    const result = (await runCli(
      "article",
      "5",
      "--format",
      "json",
    )) as Record<string, unknown>;

    expect(result.title).toMatch(/Prohibited/i);
  });

  it("legislations lists available legislations", async () => {
    const result = await runCli("legislations", "--format", "json");

    expect(Array.isArray(result)).toBe(true);
    const ids = (result as Array<Record<string, unknown>>).map((l) => l.id);
    expect(ids).toContain("eu-ai-act");
  });
});
