// Infrastructure implementation of CrossCheckService. For v1 (obligations-
// only), this is a no-op because obligations have no numerically-adjudicable
// fields. Left in place so the wiring is ready when penalty/deadline curator
// paths land in a follow-up branch.
import type {
  CrossCheckInput,
  CrossCheckResult,
  CrossCheckService,
} from "@lexius/core";
import type { Database } from "@lexius/db";

export class DrizzleCrossCheckService implements CrossCheckService {
  constructor(private readonly _db: Database) {}

  async run(_input: CrossCheckInput): Promise<CrossCheckResult> {
    // v1 scope: obligations have no numerically-adjudicable fields.
    // touchesNumericFields("obligation", ...) returns false, so this method
    // is never called in the obligations path. Penalty path (follow-up) will
    // extend this to query article_extracts and compare values.
    return { ok: true, mismatches: [] };
  }
}
