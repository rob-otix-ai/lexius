import { eq, sql } from "drizzle-orm";
import {
  complianceWorkspace,
  articles,
  articleExtracts,
  obligations,
} from "@lexius/db";
import type { Database } from "@lexius/db";
import type { SwarmFinding } from "./types.js";
import { detectGaps } from "./gap-detector.js";

const DEFAULT_BATCH_SIZE = 5;

export async function runSwarmAgent(
  db: Database,
  sessionId: string,
  agentId: string,
  options?: { batchSize?: number; gapThreshold?: number },
): Promise<number> {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  let totalFindings = 0;

  // Pre-load curated obligations for gap detection.
  // We load them once — they don't change during a session.
  const curatedObligations = await db
    .select({ id: obligations.id, obligation: obligations.obligation })
    .from(obligations)
    .where(eq(obligations.provenanceTier, "CURATED"));

  while (true) {
    // 1. Claim a batch from swarm_work_queue using FOR UPDATE SKIP LOCKED
    const claimed = await db.execute(sql`
      UPDATE swarm_work_queue
      SET claimed_by = ${agentId}, claimed_at = now()
      WHERE id IN (
        SELECT id FROM swarm_work_queue
        WHERE session_id = ${sessionId}
          AND claimed_by IS NULL
        ORDER BY article_id
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING article_id
    `);

    if (claimed.rows.length === 0) break;

    const articleIds = claimed.rows.map((r: any) => r.article_id as string);

    // 3. For each claimed article, analyse and produce findings
    for (const articleId of articleIds) {
      const findings = await analyseArticle(
        db,
        sessionId,
        agentId,
        articleId,
        curatedObligations,
        options?.gapThreshold,
      );

      // 4. Write all findings to compliance_workspace in one insert
      if (findings.length > 0) {
        await db.insert(complianceWorkspace).values(
          findings.map((f) => ({
            sessionId,
            agentId,
            articleId,
            findingType: f.finding.type as any,
            finding: f.finding,
            provenanceTier: f.provenanceTier,
            sourceExtractId: f.sourceExtractId,
          })),
        );
        totalFindings += findings.length;
      }
    }

    // 5. Mark the batch as completed
    await db.execute(sql`
      UPDATE swarm_work_queue
      SET completed_at = now()
      WHERE session_id = ${sessionId}
        AND article_id IN ${sql.raw(`(${articleIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")})`)}
        AND claimed_by = ${agentId}
    `);
  }

  return totalFindings;
}

async function analyseArticle(
  db: Database,
  sessionId: string,
  agentId: string,
  articleId: string,
  curatedObligations: Array<{ id: string; obligation: string }>,
  gapThreshold?: number,
): Promise<
  Array<{
    finding: SwarmFinding;
    provenanceTier: "AUTHORITATIVE" | "CURATED" | "AI_GENERATED";
    sourceExtractId: number | null;
  }>
> {
  // 1. Read the article
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, articleId));
  if (!article) return [];

  // 2. Read all article_extracts for this article
  const extracts = await db
    .select()
    .from(articleExtracts)
    .where(eq(articleExtracts.articleId, articleId));

  const findings: Array<{
    finding: SwarmFinding;
    provenanceTier: "AUTHORITATIVE" | "CURATED" | "AI_GENERATED";
    sourceExtractId: number | null;
  }> = [];

  // 3. For each extract, produce the appropriate finding per DDD-013
  for (const ext of extracts) {
    switch (ext.extractType) {
      case "shall_clause":
        findings.push({
          finding: {
            type: "obligation",
            text: ext.valueText!,
            subjectHint: ext.verbatimExcerpt.slice(0, 30),
            articleRef: articleId,
            shallClauseId: ext.id,
            confidence: 1.0,
          },
          provenanceTier: "AUTHORITATIVE",
          sourceExtractId: ext.id,
        });
        break;

      case "fine_amount_eur":
        findings.push({
          finding: {
            type: "penalty",
            amountEur: Number(ext.valueNumeric),
            turnoverPercentage: 0,
            paragraphRef: ext.paragraphRef,
            extractId: ext.id,
          },
          provenanceTier: "AUTHORITATIVE",
          sourceExtractId: ext.id,
        });
        break;

      case "turnover_percentage":
        findings.push({
          finding: {
            type: "penalty",
            amountEur: 0,
            turnoverPercentage: Number(ext.valueNumeric),
            paragraphRef: ext.paragraphRef,
            extractId: ext.id,
          },
          provenanceTier: "AUTHORITATIVE",
          sourceExtractId: ext.id,
        });
        break;

      case "date":
        findings.push({
          finding: {
            type: "deadline",
            date: ext.valueDate?.toISOString() ?? "",
            paragraphRef: ext.paragraphRef,
            extractId: ext.id,
          },
          provenanceTier: "AUTHORITATIVE",
          sourceExtractId: ext.id,
        });
        break;

      case "article_cross_ref":
        findings.push({
          finding: {
            type: "cross_ref",
            sourceArticleId: articleId,
            targetArticleId: ext.valueText!,
            context: ext.verbatimExcerpt.slice(0, 200),
          },
          provenanceTier: "AUTHORITATIVE",
          sourceExtractId: ext.id,
        });
        break;

      case "annex_cross_ref":
        findings.push({
          finding: {
            type: "cross_ref",
            sourceArticleId: articleId,
            targetArticleId: ext.valueText!,
            context: ext.verbatimExcerpt.slice(0, 200),
          },
          provenanceTier: "AUTHORITATIVE",
          sourceExtractId: ext.id,
        });
        break;
    }
  }

  // 4. Stigmergic read: read other agents' findings for cross-referenced articles
  const crossRefExtracts = extracts.filter(
    (e) => e.extractType === "article_cross_ref",
  );
  for (const crossRef of crossRefExtracts) {
    const targetId = crossRef.valueText;
    if (!targetId) continue;
    // Read other agents' findings (stigmergic pattern)
    await db
      .select()
      .from(complianceWorkspace)
      .where(
        eq(complianceWorkspace.sessionId, sessionId),
      );
    // We read but don't act on these in P0 — the stigmergic read
    // is available for P1 conflict detection and obligation merging.
  }

  // 5. Gap detection
  if (curatedObligations.length > 0) {
    const shallClauses = extracts
      .filter((e) => e.extractType === "shall_clause")
      .map((e) => ({
        id: e.id,
        articleId: e.articleId,
        valueText: e.valueText,
        verbatimExcerpt: e.verbatimExcerpt,
      }));

    if (shallClauses.length > 0) {
      const gaps = detectGaps(
        shallClauses,
        curatedObligations,
        gapThreshold,
      );
      for (const gap of gaps) {
        findings.push({
          finding: gap,
          provenanceTier: "AI_GENERATED",
          sourceExtractId: gap.shallClauseId,
        });
      }
    }
  }

  return findings;
}
