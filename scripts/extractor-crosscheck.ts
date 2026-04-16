/**
 * Extractor cross-check script — DDD-011 §"Cross-Check Script".
 *
 * Reads `penalties` rows with a non-empty `derivedFrom` and `extractExempt = false`,
 * checks that `maxFineEur` and `globalTurnoverPercentage` each match at least one
 * `article_extracts` row of the matching type on any article in `derivedFrom`.
 *
 * Exits 0 on clean pass, non-zero on any mismatch or missing extract.
 *
 * Run: `pnpm crosscheck` (reads DATABASE_URL from env).
 */
import { and, eq, inArray } from "drizzle-orm";
import { createDb, articleExtracts, penalties } from "@lexius/db";

export type MismatchKind =
  | "penalty_fine_mismatch"
  | "penalty_turnover_mismatch"
  | "penalty_fine_missing"
  | "penalty_turnover_missing";

export interface Mismatch {
  kind: MismatchKind;
  rowId: string;
  expectedValue: string;
  extractedValues: string[];
  derivedFrom: string[];
  suggestion?: string;
}

// Floating-point tolerance for numeric comparison. The DB stores
// numeric(20,2) / numeric(5,2), so we can afford to compare as Number after
// parsing and allow ±0.01 of slack.
const NUMERIC_TOLERANCE = 0.01;

function numericEquals(a: string, b: string): boolean {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return a === b;
  return Math.abs(na - nb) <= NUMERIC_TOLERANCE;
}

export async function runCrossCheck(databaseUrl: string): Promise<Mismatch[]> {
  const { db, pool } = createDb(databaseUrl);
  const mismatches: Mismatch[] = [];
  try {
    const rows = await db.select().from(penalties);

    for (const p of rows) {
      if (p.extractExempt) continue;
      if (!p.derivedFrom || p.derivedFrom.length === 0) continue;

      // fine_amount_eur cross-check
      if (p.maxFineEur !== null && p.maxFineEur !== undefined) {
        const fineExtracts = await db
          .select()
          .from(articleExtracts)
          .where(
            and(
              inArray(articleExtracts.articleId, p.derivedFrom),
              eq(articleExtracts.extractType, "fine_amount_eur"),
            ),
          );
        const values = fineExtracts
          .map((e) => e.valueNumeric)
          .filter((v): v is string => v !== null && v !== undefined);

        if (values.length === 0) {
          mismatches.push({
            kind: "penalty_fine_missing",
            rowId: p.id,
            expectedValue: p.maxFineEur,
            extractedValues: [],
            derivedFrom: p.derivedFrom,
            suggestion:
              "No fine_amount_eur extract exists on any derivedFrom article. " +
              "Either widen the extractor, fix the derivedFrom list, or set extractExempt: true with a reason.",
          });
        } else if (!values.some((v) => numericEquals(v, p.maxFineEur!))) {
          mismatches.push({
            kind: "penalty_fine_mismatch",
            rowId: p.id,
            expectedValue: p.maxFineEur,
            extractedValues: values,
            derivedFrom: p.derivedFrom,
            suggestion: `update maxFineEur to one of [${values.join(", ")}]`,
          });
        }
      }

      // turnover_percentage cross-check
      if (
        p.globalTurnoverPercentage !== null &&
        p.globalTurnoverPercentage !== undefined
      ) {
        const turnoverExtracts = await db
          .select()
          .from(articleExtracts)
          .where(
            and(
              inArray(articleExtracts.articleId, p.derivedFrom),
              eq(articleExtracts.extractType, "turnover_percentage"),
            ),
          );
        const values = turnoverExtracts
          .map((e) => e.valueNumeric)
          .filter((v): v is string => v !== null && v !== undefined);

        if (values.length === 0) {
          mismatches.push({
            kind: "penalty_turnover_missing",
            rowId: p.id,
            expectedValue: p.globalTurnoverPercentage,
            extractedValues: [],
            derivedFrom: p.derivedFrom,
            suggestion:
              "No turnover_percentage extract exists on any derivedFrom article. " +
              "Either widen the extractor, fix the derivedFrom list, or set extractExempt: true with a reason.",
          });
        } else if (
          !values.some((v) => numericEquals(v, p.globalTurnoverPercentage!))
        ) {
          mismatches.push({
            kind: "penalty_turnover_mismatch",
            rowId: p.id,
            expectedValue: p.globalTurnoverPercentage,
            extractedValues: values,
            derivedFrom: p.derivedFrom,
            suggestion: `update globalTurnoverPercentage to one of [${values.join(", ")}]`,
          });
        }
      }
    }

    return mismatches;
  } finally {
    await pool.end();
  }
}

function formatMismatch(m: Mismatch): string {
  const lines: string[] = [];
  lines.push(`  ${m.kind} ${m.rowId}`);
  lines.push(`    expected: ${m.expectedValue}`);
  lines.push(
    `    extracted on derivedFrom [${m.derivedFrom.join(", ")}]: [${m.extractedValues.join(", ")}]`,
  );
  if (m.suggestion) lines.push(`    suggestion: ${m.suggestion}`);
  return lines.join("\n");
}

// CLI entry — only runs when this file is executed directly (not imported).
const invokedAsMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("extractor-crosscheck.ts");

if (invokedAsMain) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }
  runCrossCheck(databaseUrl)
    .then((mismatches) => {
      if (mismatches.length > 0) {
        console.error(
          `EXTRACTOR CROSS-CHECK FAILED: ${mismatches.length} mismatch(es)\n`,
        );
        for (const m of mismatches) {
          console.error(formatMismatch(m));
          console.error();
        }
        process.exit(1);
      }
      console.log("Extractor cross-check: clean.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Cross-check script failed:", err);
      process.exit(1);
    });
}
