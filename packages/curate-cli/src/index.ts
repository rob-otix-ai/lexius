import { Command } from "commander";
import {
  loadCredentials,
  requireCurator,
  writeCredentials,
  deleteProfile,
  credentialsPath,
  NotCurator,
  NotLoggedIn,
} from "@robotixai/lexius-credentials";

const program = new Command();

program
  .name("lexius-curate")
  .description("Curator CLI for Lexius — create, edit, deprecate, revert, history")
  .version("0.1.0");

interface ApiOptions {
  apply?: boolean;
  profile?: string;
}

function dryRunQuery(options: ApiOptions): string {
  return options.apply ? "" : "?dry_run=true";
}

async function callApi<T = any>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  options: {
    profile?: string;
    body?: unknown;
    ifMatch?: number;
  } = {},
): Promise<T> {
  const creds = requireCurator({ profile: options.profile });
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.apiKey}`,
    "Content-Type": "application/json",
    "X-Source": "cli",
  };
  if (creds.curatorId) headers["X-Curator-Id"] = creds.curatorId;
  if (options.ifMatch !== undefined) {
    headers["If-Match"] = String(options.ifMatch);
  }

  const url = new URL(path, creds.apiUrl).toString();
  const res = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(
      `HTTP ${res.status} ${res.statusText}: ${JSON.stringify(data)}`,
    );
    (err as any).status = res.status;
    (err as any).body = data;
    throw err;
  }
  return data as T;
}

function printOk(msg: string) {
  console.log(msg);
}

function printErr(err: unknown) {
  if (err instanceof NotLoggedIn || err instanceof NotCurator) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }
  const e = err as any;
  if (e?.status && e?.body) {
    console.error(`error: ${e.body.error ?? "unknown"}: ${e.body.message ?? ""}`);
    if (e.body.current !== undefined) {
      console.error(`  (server row_version is ${e.body.current})`);
    }
    if (e.body.missing) {
      console.error(`  missing: ${e.body.missing.join(", ")}`);
    }
    if (e.body.mismatches) {
      console.error(`  mismatches: ${JSON.stringify(e.body.mismatches, null, 2)}`);
    }
  } else {
    console.error(String((err as Error)?.message ?? err));
  }
  process.exitCode = 1;
}

// ── login / logout / whoami ─────────────────────────────────────────────

program
  .command("login")
  .description("Save a curator API key to the credentials file")
  .requiredOption("--key <apiKey>", "curator-scoped API key (lx_...)")
  .option("--url <apiUrl>", "Lexius API URL", process.env.LEXIUS_API_URL)
  .option("--profile <name>", "profile name", "default")
  .action(async (opts: { key: string; url?: string; profile: string }) => {
    try {
      if (!opts.url) {
        console.error("--url is required (or set LEXIUS_API_URL)");
        process.exit(1);
      }
      // Verify against the server before writing.
      const res = await fetch(new URL("/api/v1/curate/whoami", opts.url).toString(), {
        headers: { Authorization: `Bearer ${opts.key}` },
      });
      if (!res.ok) {
        console.error(`login verification failed: HTTP ${res.status}`);
        const body = await res.text();
        console.error(body);
        process.exit(1);
      }
      const who = (await res.json()) as { editor_id: string | null; role: string };
      if (who.role !== "curator") {
        console.error(`key is role='${who.role}', not 'curator' — refusing to save`);
        process.exit(1);
      }
      const path = writeCredentials(
        {
          apiUrl: opts.url,
          apiKey: opts.key,
          curatorId: who.editor_id,
          role: "curator",
          expiresAt: null,
        },
        { profile: opts.profile },
      );
      printOk(`Logged in as ${who.editor_id ?? "(unknown curator)"} (profile: ${opts.profile})`);
      printOk(`Credentials written to ${path}`);
    } catch (err) {
      printErr(err);
    }
  });

program
  .command("logout")
  .description("Remove a saved profile")
  .option("--profile <name>", "profile name", "default")
  .action((opts: { profile: string }) => {
    const removed = deleteProfile(opts.profile);
    printOk(removed ? `Removed profile '${opts.profile}'` : `Profile '${opts.profile}' not found`);
  });

program
  .command("whoami")
  .description("Show current curator identity")
  .option("--profile <name>", "profile name")
  .action((opts: { profile?: string }) => {
    const creds = loadCredentials({ profile: opts.profile });
    if (!creds) {
      console.error("Not logged in. Run `lexius-curate login --key ...` first.");
      process.exitCode = 1;
      return;
    }
    printOk(
      `Logged in as ${creds.curatorId ?? "(unknown)"} (role: ${creds.role}, profile: ${creds.profile}, url: ${creds.apiUrl})`,
    );
  });

// ── obligations ─────────────────────────────────────────────────────────

const obligations = program
  .command("obligations")
  .description("Curator actions on CURATED-tier obligations");

obligations
  .command("list")
  .description("List obligations needing review (queue)")
  .option("--profile <name>", "profile name")
  .option("--stale", "only obligations flagged needs_review", true)
  .action(async (opts: { profile?: string; stale?: boolean }) => {
    try {
      const data = await callApi<{ obligations: any[] }>(
        "GET",
        "/api/v1/curate/queue",
        { profile: opts.profile },
      );
      for (const o of data.obligations) {
        printOk(
          `${o.id}  rv=${o.row_version}  stale_since=${o.stale_since ?? "-"}  "${o.obligation.slice(0, 80)}"`,
        );
      }
      printOk(`\n${data.obligations.length} obligation(s)`);
    } catch (err) {
      printErr(err);
    }
  });

obligations
  .command("create")
  .description("Create a new CURATED obligation (non-empty derivedFrom required)")
  .requiredOption("--id <id>", "obligation id")
  .requiredOption("--legislation <id>", "legislation id")
  .requiredOption("--role <role>", "role (provider, deployer, etc.)")
  .requiredOption("--risk-level <level>", "risk level")
  .requiredOption("--obligation <text>", "obligation statement")
  .requiredOption("--derived-from <ids...>", "article ids (space-separated)")
  .option("--article <ref>", "article reference", "")
  .option("--deadline <iso>", "deadline ISO string")
  .option("--details <text>", "details", "")
  .option("--category <cat>", "category", "")
  .requiredOption("--reason <reason>", "reason for the edit (required by audit)")
  .option("--apply", "commit the change (without this, dry-run only)")
  .option("--profile <name>", "profile name")
  .action(async (opts: any) => {
    try {
      const body = {
        id: opts.id,
        legislationId: opts.legislation,
        role: opts.role,
        riskLevel: opts.riskLevel,
        obligation: opts.obligation,
        article: opts.article,
        deadline: opts.deadline ?? null,
        details: opts.details,
        category: opts.category,
        derivedFrom: opts.derivedFrom,
        reason: opts.reason,
      };
      const data = await callApi(
        "POST",
        `/api/v1/curate/obligations${dryRunQuery(opts)}`,
        { profile: opts.profile, body },
      );
      printOk(JSON.stringify(data, null, 2));
    } catch (err) {
      printErr(err);
    }
  });

obligations
  .command("edit <id>")
  .description("Edit fields on an existing CURATED obligation")
  .requiredOption("--row-version <n>", "current row_version (from GET)", Number)
  .option("--changes <json>", "JSON of changes to apply", "{}")
  .requiredOption("--reason <reason>", "reason for the edit")
  .option("--apply", "commit the change (without this, dry-run only)")
  .option("--profile <name>", "profile name")
  .action(async (id: string, opts: any) => {
    try {
      const changes = JSON.parse(opts.changes);
      const data = await callApi(
        "PATCH",
        `/api/v1/curate/obligations/${encodeURIComponent(id)}${dryRunQuery(opts)}`,
        {
          profile: opts.profile,
          body: { changes, reason: opts.reason },
          ifMatch: opts.rowVersion,
        },
      );
      printOk(JSON.stringify(data, null, 2));
    } catch (err) {
      printErr(err);
    }
  });

obligations
  .command("deprecate <id>")
  .description("Soft-delete an obligation (sets deprecated_at + reason)")
  .requiredOption("--row-version <n>", "current row_version", Number)
  .requiredOption("--reason <reason>", "reason for deprecation")
  .option("--apply", "commit the change")
  .option("--profile <name>", "profile name")
  .action(async (id: string, opts: any) => {
    try {
      const data = await callApi(
        "DELETE",
        `/api/v1/curate/obligations/${encodeURIComponent(id)}${dryRunQuery(opts)}`,
        {
          profile: opts.profile,
          body: { reason: opts.reason },
          ifMatch: opts.rowVersion,
        },
      );
      printOk(JSON.stringify(data, null, 2));
    } catch (err) {
      printErr(err);
    }
  });

obligations
  .command("history <id>")
  .description("Show audit history for an obligation")
  .option("--profile <name>", "profile name")
  .action(async (id: string, opts: { profile?: string }) => {
    try {
      const data = await callApi<{ edits: any[] }>(
        "GET",
        `/api/v1/curate/edits?entity_type=obligation&entity_id=${encodeURIComponent(id)}`,
        { profile: opts.profile },
      );
      for (const e of data.edits) {
        printOk(
          `${e.edited_at}  ${e.action.padEnd(9)}  v${e.row_version_before ?? "-"}→v${e.row_version_after}  ${e.editor_id}  "${e.reason}"`,
        );
      }
      printOk(`\n${data.edits.length} edit(s)`);
    } catch (err) {
      printErr(err);
    }
  });

// ── my-edits + revert ───────────────────────────────────────────────────

program
  .command("my-edits")
  .description("Show your own edit history")
  .option("--since <iso>", "only edits after this ISO timestamp")
  .option("--profile <name>", "profile name")
  .action(async (opts: { since?: string; profile?: string }) => {
    try {
      const creds = requireCurator({ profile: opts.profile });
      const q = new URLSearchParams({ editor_id: creds.curatorId ?? "" });
      if (opts.since) q.set("since", opts.since);
      const data = await callApi<{ edits: any[] }>(
        "GET",
        `/api/v1/curate/edits?${q}`,
        { profile: opts.profile },
      );
      for (const e of data.edits) {
        printOk(
          `${e.edited_at}  ${e.action.padEnd(9)}  ${e.entity_type}/${e.entity_id}  "${e.reason}"`,
        );
      }
      printOk(`\n${data.edits.length} edit(s)`);
    } catch (err) {
      printErr(err);
    }
  });

program
  .command("revert <editId>")
  .description("Revert a specific audit edit (writes a new edit with old_values)")
  .requiredOption("--reason <reason>", "reason for the revert")
  .option("--apply", "commit the revert")
  .option("--profile <name>", "profile name")
  .action(async (editId: string, opts: any) => {
    try {
      // The revert route needs the obligation id. We fetch the edit first.
      const { edits } = await callApi<{ edits: any[] }>(
        "GET",
        `/api/v1/curate/edits?entity_type=obligation&entity_id=`,
        { profile: opts.profile },
      );
      const match = edits.find((e) => e.id === editId);
      if (!match) {
        // Fall back: just POST with the edit id and the server resolves.
      }
      const obligationId = match?.entity_id ?? editId;
      const data = await callApi(
        "POST",
        `/api/v1/curate/obligations/${encodeURIComponent(obligationId)}/revert${dryRunQuery(opts)}`,
        {
          profile: opts.profile,
          body: { editId, reason: opts.reason },
        },
      );
      printOk(JSON.stringify(data, null, 2));
    } catch (err) {
      printErr(err);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  printErr(err);
  process.exit(1);
});
