import { describe, expect, it, beforeEach } from "vitest";
import { writeFileSync, mkdtempSync, rmSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadCredentials,
  writeCredentials,
  requireCurator,
  deleteProfile,
  NotLoggedIn,
  NotCurator,
} from "./index.js";

describe("credentials", () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lexius-creds-"));
    path = join(dir, "credentials");
    delete process.env.LEXIUS_API_KEY;
    delete process.env.LEXIUS_API_URL;
    delete process.env.LEXIUS_CURATOR_ID;
    delete process.env.LEXIUS_ROLE;
    delete process.env.LEXIUS_PROFILE;
  });

  it("returns null when no file and no env", () => {
    expect(loadCredentials({ path })).toBeNull();
  });

  it("env vars beat file", () => {
    process.env.LEXIUS_API_URL = "https://env.example.com";
    process.env.LEXIUS_API_KEY = "lx_from_env";
    const creds = loadCredentials({ path });
    expect(creds).not.toBeNull();
    expect(creds?.apiUrl).toBe("https://env.example.com");
    expect(creds?.apiKey).toBe("lx_from_env");
    expect(creds?.profile).toBe("env");
  });

  it("writes then reads a default profile", () => {
    writeCredentials(
      {
        apiUrl: "https://lexius.example.com",
        apiKey: "lx_abc",
        curatorId: "rob@fall.dev",
        role: "curator",
        expiresAt: null,
      },
      { path },
    );
    expect(existsSync(path)).toBe(true);

    const creds = loadCredentials({ path });
    expect(creds?.apiUrl).toBe("https://lexius.example.com");
    expect(creds?.apiKey).toBe("lx_abc");
    expect(creds?.curatorId).toBe("rob@fall.dev");
    expect(creds?.role).toBe("curator");
    expect(creds?.profile).toBe("default");
  });

  it("writes a named profile and loads it via options.profile", () => {
    writeCredentials(
      {
        apiUrl: "https://staging.example.com",
        apiKey: "lx_stg",
        curatorId: null,
        role: "reader",
        expiresAt: null,
      },
      { path, profile: "staging" },
    );
    const creds = loadCredentials({ path, profile: "staging" });
    expect(creds?.apiUrl).toBe("https://staging.example.com");
    expect(creds?.profile).toBe("staging");
  });

  it("requireCurator throws NotLoggedIn when no file", () => {
    expect(() => requireCurator({ path })).toThrow(NotLoggedIn);
  });

  it("requireCurator throws NotCurator for reader role", () => {
    writeCredentials(
      {
        apiUrl: "https://x",
        apiKey: "lx_reader",
        curatorId: null,
        role: "reader",
        expiresAt: null,
      },
      { path },
    );
    expect(() => requireCurator({ path })).toThrow(NotCurator);
  });

  it("deleteProfile removes the section", () => {
    writeCredentials(
      {
        apiUrl: "https://x",
        apiKey: "lx_k",
        curatorId: null,
        role: "curator",
        expiresAt: null,
      },
      { path },
    );
    expect(deleteProfile("default", { path })).toBe(true);
    expect(loadCredentials({ path })).toBeNull();
  });

  it("file is mode 600 after write", () => {
    writeCredentials(
      {
        apiUrl: "https://x",
        apiKey: "lx_k",
        curatorId: null,
        role: "curator",
        expiresAt: null,
      },
      { path },
    );
    const mode = statSync(path).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
