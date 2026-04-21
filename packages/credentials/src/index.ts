import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";

export type Role = "reader" | "curator";

export interface Credentials {
  apiUrl: string;
  apiKey: string;
  curatorId: string | null;
  role: Role;
  profile: string;
  expiresAt: Date | null;
}

export interface LoadOptions {
  profile?: string;
  /** Override the credentials file path. Useful for tests. */
  path?: string;
}

/** Resolve the platform-appropriate credentials file path. */
export function credentialsPath(override?: string): string {
  if (override) return override;
  if (process.env.LEXIUS_CREDENTIALS_FILE) return process.env.LEXIUS_CREDENTIALS_FILE;

  if (platform() === "win32") {
    const appData = process.env.APPDATA;
    if (appData) return join(appData, "lexius", "credentials");
  }

  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg ?? join(homedir(), ".config");
  return join(base, "lexius", "credentials");
}

/** Load credentials. Returns null when no file and no env overrides present. */
export function loadCredentials(options: LoadOptions = {}): Credentials | null {
  // Env-first escape hatch for CI and ephemeral environments.
  const envKey = process.env.LEXIUS_API_KEY;
  const envUrl = process.env.LEXIUS_API_URL;
  if (envKey && envUrl) {
    return {
      apiUrl: envUrl,
      apiKey: envKey,
      curatorId: process.env.LEXIUS_CURATOR_ID ?? null,
      role: (process.env.LEXIUS_ROLE as Role) ?? "reader",
      profile: "env",
      expiresAt: null,
    };
  }

  const path = credentialsPath(options.path);
  if (!existsSync(path)) return null;

  const raw = readFileSync(path, "utf8");
  const profiles = parseToml(raw);
  const profileName =
    options.profile ?? process.env.LEXIUS_PROFILE ?? "default";

  const section = profileName === "default"
    ? profiles.default
    : profiles.profile?.[profileName];

  if (!section) return null;

  const apiUrl =
    process.env.LEXIUS_API_URL ??
    (typeof section.api_url === "string" ? section.api_url : undefined);
  const apiKey =
    process.env.LEXIUS_API_KEY ??
    (typeof section.api_key === "string" ? section.api_key : undefined);
  if (!apiUrl || !apiKey) return null;

  const curatorId =
    process.env.LEXIUS_CURATOR_ID ??
    (typeof section.curator_id === "string" ? section.curator_id : null);
  const role =
    (typeof section.role === "string" ? section.role : "reader") as Role;
  const expiresAt =
    typeof section.expires_at === "string"
      ? new Date(section.expires_at)
      : null;

  return { apiUrl, apiKey, curatorId, role, profile: profileName, expiresAt };
}

export class NotLoggedIn extends Error {
  constructor() {
    super("Not logged in. Run `lexius-curate login --key ...` first.");
    this.name = "NotLoggedIn";
  }
}

export class NotCurator extends Error {
  constructor() {
    super("This action requires a curator-scoped API key.");
    this.name = "NotCurator";
  }
}

/** Load + assert curator role. Throws if not logged in or not a curator. */
export function requireCurator(options: LoadOptions = {}): Credentials {
  const creds = loadCredentials(options);
  if (!creds) throw new NotLoggedIn();
  if (creds.role !== "curator") throw new NotCurator();
  return creds;
}

export interface WriteOptions {
  profile?: string;
  path?: string;
}

/** Write a profile section to the credentials file (mode 600). */
export function writeCredentials(
  creds: Omit<Credentials, "profile">,
  options: WriteOptions = {},
): string {
  const path = credentialsPath(options.path);
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  const profileName = options.profile ?? "default";
  const existing = existsSync(path) ? parseToml(readFileSync(path, "utf8")) : {
    default: null,
    profile: {},
  };

  const section: Record<string, string> = {
    api_url: creds.apiUrl,
    api_key: creds.apiKey,
    role: creds.role,
  };
  if (creds.curatorId) section.curator_id = creds.curatorId;
  if (creds.expiresAt) section.expires_at = creds.expiresAt.toISOString();

  if (profileName === "default") {
    existing.default = section;
  } else {
    existing.profile = existing.profile ?? {};
    existing.profile[profileName] = section;
  }

  writeFileSync(path, renderToml(existing), { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}

/** Remove a profile section. Returns true if something was removed. */
export function deleteProfile(
  profileName: string,
  options: LoadOptions = {},
): boolean {
  const path = credentialsPath(options.path);
  if (!existsSync(path)) return false;
  const existing = parseToml(readFileSync(path, "utf8"));
  if (profileName === "default") {
    if (!existing.default) return false;
    existing.default = null;
  } else {
    if (!existing.profile?.[profileName]) return false;
    delete existing.profile[profileName];
  }
  writeFileSync(path, renderToml(existing), { mode: 0o600 });
  return true;
}

// ── Minimal TOML parser/writer ─────────────────────────────────────────
// Supports the narrow subset we need: [default] and [profile.<name>]
// sections with key = "string" pairs. Never extends to arrays, nested
// tables, or inline tables.

interface ParsedToml {
  default: Record<string, string> | null;
  profile?: Record<string, Record<string, string>>;
}

function parseToml(input: string): ParsedToml {
  const result: ParsedToml = { default: null, profile: {} };
  let currentSection: Record<string, string> | null = null;
  let currentName = "";

  for (const lineRaw of input.split("\n")) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#")) continue;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      const name = sectionMatch[1].trim();
      if (name === "default") {
        result.default = result.default ?? {};
        currentSection = result.default;
        currentName = "default";
      } else if (name.startsWith("profile.")) {
        const profileName = name.slice("profile.".length);
        result.profile = result.profile ?? {};
        result.profile[profileName] = result.profile[profileName] ?? {};
        currentSection = result.profile[profileName];
        currentName = profileName;
      } else {
        currentSection = null;
      }
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_]+)\s*=\s*"(.*)"\s*$/);
    if (kvMatch && currentSection) {
      currentSection[kvMatch[1]] = kvMatch[2];
    }
  }

  if (result.default === null && !result.profile) {
    return { default: null };
  }
  return result;
}

function renderToml(parsed: ParsedToml): string {
  const parts: string[] = [];
  if (parsed.default) {
    parts.push("[default]");
    for (const [k, v] of Object.entries(parsed.default)) {
      parts.push(`${k} = ${JSON.stringify(v)}`);
    }
    parts.push("");
  }
  if (parsed.profile) {
    for (const [name, fields] of Object.entries(parsed.profile)) {
      parts.push(`[profile.${name}]`);
      for (const [k, v] of Object.entries(fields)) {
        parts.push(`${k} = ${JSON.stringify(v)}`);
      }
      parts.push("");
    }
  }
  return parts.join("\n");
}
