# DDD-013: Hivemind Swarm — Implementation

## Status: Draft
## Date: 2026-04-17

---

## Overview

Implementation details for PRD-010 / ARD-014. Covers: schema, migration, the swarm agent loop, gap detection, synthesis, API/MCP integration, and the Specflow contract.

## Schema Changes

### New enum `finding_type`

```typescript
// packages/db/src/schema/enums.ts
export const findingType = pgEnum("finding_type", [
  "obligation",
  "penalty",
  "deadline",
  "cross_ref",
  "gap",
  "risk",
]);
```

### `compliance_workspace` table

```typescript
// packages/db/src/schema/compliance-workspace.ts
import {
  pgTable, serial, uuid, varchar, text, timestamp, integer, jsonb, index,
} from "drizzle-orm/pg-core";
import { articles } from "./articles.js";
import { articleExtracts } from "./article-extracts.js";
import { findingType, provenanceTier } from "./enums.js";

export const complianceWorkspace = pgTable(
  "compliance_workspace",
  {
    id: serial("id").primaryKey(),
    sessionId: uuid("session_id").notNull(),
    agentId: text("agent_id").notNull(),
    articleId: varchar("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    findingType: findingType("finding_type").notNull(),
    finding: jsonb("finding").notNull(),
    provenanceTier: provenanceTier("provenance_tier").notNull(),
    sourceExtractId: integer("source_extract_id")
      .references(() => articleExtracts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionArticleIdx: index("cw_session_article_idx").on(
      table.sessionId, table.articleId,
    ),
    sessionTypeIdx: index("cw_session_type_idx").on(
      table.sessionId, table.findingType,
    ),
    sessionIdx: index("cw_session_idx").on(table.sessionId),
  }),
);
```

### `swarm_work_queue` table

```typescript
// packages/db/src/schema/swarm-work-queue.ts
import {
  pgTable, serial, uuid, varchar, text, timestamp, index,
} from "drizzle-orm/pg-core";
import { articles } from "./articles.js";

export const swarmWorkQueue = pgTable(
  "swarm_work_queue",
  {
    id: serial("id").primaryKey(),
    sessionId: uuid("session_id").notNull(),
    articleId: varchar("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    claimedBy: text("claimed_by"),
    claimedAt: timestamp("claimed_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    sessionUnclaimedIdx: index("swq_session_unclaimed_idx").on(
      table.sessionId, table.claimedBy,
    ),
  }),
);
```

### Migration SQL (`0004_hivemind_swarm.sql`)

```sql
-- 1. Finding type enum
CREATE TYPE finding_type AS ENUM (
  'obligation', 'penalty', 'deadline', 'cross_ref', 'gap', 'risk'
);

-- 2. Compliance workspace
CREATE TABLE compliance_workspace (
  id                serial PRIMARY KEY,
  session_id        uuid NOT NULL,
  agent_id          text NOT NULL,
  article_id        varchar NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  finding_type      finding_type NOT NULL,
  finding           jsonb NOT NULL,
  provenance_tier   provenance_tier NOT NULL,
  source_extract_id integer REFERENCES article_extracts(id) ON DELETE SET NULL,
  created_at        timestamp NOT NULL DEFAULT now()
);

CREATE INDEX cw_session_article_idx ON compliance_workspace (session_id, article_id);
CREATE INDEX cw_session_type_idx ON compliance_workspace (session_id, finding_type);
CREATE INDEX cw_session_idx ON compliance_workspace (session_id);

-- 3. Work queue
CREATE TABLE swarm_work_queue (
  id            serial PRIMARY KEY,
  session_id    uuid NOT NULL,
  article_id    varchar NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  claimed_by    text,
  claimed_at    timestamp,
  completed_at  timestamp
);

CREATE INDEX swq_session_unclaimed_idx ON swarm_work_queue (session_id, claimed_by);

-- DOWN (commented)
-- DROP TABLE swarm_work_queue;
-- DROP TABLE compliance_workspace;
-- DROP TYPE finding_type;
```

## Domain Types

```typescript
// packages/agent/src/swarm/types.ts
import type { ProvenanceTier } from "@lexius/core";

export type FindingType = "obligation" | "penalty" | "deadline" | "cross_ref" | "gap" | "risk";

export interface ObligationFinding {
  type: "obligation";
  text: string;
  subjectHint: string;
  articleRef: string;
  shallClauseId: number;
  matchedCuratedId?: string;
  confidence: number;
}

export interface PenaltyFinding {
  type: "penalty";
  amountEur: number;
  turnoverPercentage: number;
  paragraphRef: string;
  extractId: number;
}

export interface DeadlineFinding {
  type: "deadline";
  date: string;
  dateLabel?: string;
  paragraphRef: string;
  extractId: number;
}

export interface CrossRefFinding {
  type: "cross_ref";
  sourceArticleId: string;
  targetArticleId: string;
  context: string;
}

export interface GapFinding {
  type: "gap";
  shallClauseText: string;
  shallClauseId: number;
  articleRef: string;
  reason: string;
}

export interface RiskFinding {
  type: "risk";
  description: string;
  articleRef: string;
  severity: "high" | "medium" | "low";
}

export type SwarmFinding =
  | ObligationFinding
  | PenaltyFinding
  | DeadlineFinding
  | CrossRefFinding
  | GapFinding
  | RiskFinding;

export interface WorkspaceEntry {
  id: number;
  sessionId: string;
  agentId: string;
  articleId: string;
  findingType: FindingType;
  finding: SwarmFinding;
  provenanceTier: ProvenanceTier;
  sourceExtractId: number | null;
  createdAt: Date;
}

export interface SwarmSession {
  sessionId: string;
  legislationId: string;
  concurrency: number;
  createdAt: Date;
}

export interface SwarmResult {
  sessionId: string;
  totalArticles: number;
  totalFindings: number;
  findingsByType: Record<FindingType, number>;
  gapCount: number;
  durationMs: number;
}
```

## Session Management

```typescript
// packages/agent/src/swarm/session.ts
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { articles, swarmWorkQueue, complianceWorkspace } from "@lexius/db";
import type { Database } from "@lexius/db";

export async function createSwarmSession(
  db: Database,
  legislationId: string,
): Promise<string> {
  const sessionId = randomUUID();

  // Populate work queue with all AUTHORITATIVE articles for this legislation
  const allArticles = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.legislationId, legislationId));

  await db.insert(swarmWorkQueue).values(
    allArticles.map((a) => ({
      sessionId,
      articleId: a.id,
    })),
  );

  return sessionId;
}

export async function cleanupSession(
  db: Database,
  sessionId: string,
): Promise<void> {
  await db.delete(complianceWorkspace).where(eq(complianceWorkspace.sessionId, sessionId));
  await db.delete(swarmWorkQueue).where(eq(swarmWorkQueue.sessionId, sessionId));
}
```

## Agent Loop

```typescript
// packages/agent/src/swarm/agent-loop.ts
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  swarmWorkQueue, complianceWorkspace, articles, articleExtracts,
} from "@lexius/db";
import type { Database } from "@lexius/db";
import type { SwarmFinding, WorkspaceEntry } from "./types.js";
import { detectGaps } from "./gap-detector.js";

const DEFAULT_BATCH_SIZE = 5;

export async function runSwarmAgent(
  db: Database,
  sessionId: string,
  agentId: string,
  options: {
    batchSize?: number;
    gapThreshold?: number;
    embeddingService?: { embedBatch(texts: string[]): Promise<number[][]> };
    curatedObligations?: Array<{ id: string; embedding: number[]; obligation: string }>;
  } = {},
): Promise<number> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  let totalFindings = 0;

  while (true) {
    // Claim a batch of unclaimed articles
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

    for (const articleId of articleIds) {
      const findings = await analyseArticle(db, sessionId, agentId, articleId, options);

      if (findings.length > 0) {
        await db.insert(complianceWorkspace).values(
          findings.map((f) => ({
            sessionId,
            agentId,
            articleId,
            findingType: f.finding.type === "cross_ref" ? "cross_ref" as const : f.finding.type as any,
            finding: f.finding,
            provenanceTier: f.provenanceTier,
            sourceExtractId: f.sourceExtractId,
          })),
        );
        totalFindings += findings.length;
      }
    }

    // Mark batch as completed
    await db.execute(sql`
      UPDATE swarm_work_queue
      SET completed_at = now()
      WHERE session_id = ${sessionId}
        AND article_id = ANY(${articleIds}::text[])
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
  options: any,
): Promise<Array<{ finding: SwarmFinding; provenanceTier: "AUTHORITATIVE" | "CURATED" | "AI_GENERATED"; sourceExtractId: number | null }>> {
  // 1. Read the article
  const [article] = await db.select().from(articles).where(eq(articles.id, articleId));
  if (!article) return [];

  // 2. Read pre-extracted facts
  const extracts = await db.select().from(articleExtracts).where(eq(articleExtracts.articleId, articleId));

  // 3. Read other agents' findings for cross-referenced articles (stigmergic read)
  const crossRefExtracts = extracts.filter((e) => e.extractType === "article_cross_ref");
  const referencedArticleIds = crossRefExtracts.map((e) => e.valueText!).filter(Boolean);

  const findings: Array<{ finding: SwarmFinding; provenanceTier: "AUTHORITATIVE" | "CURATED" | "AI_GENERATED"; sourceExtractId: number | null }> = [];

  // 4. Emit findings per extract type
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
            turnoverPercentage: 0, // paired separately
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
    }
  }

  // 5. Gap detection (if curated obligations are available)
  if (options.curatedObligations && options.curatedObligations.length > 0) {
    const shallClauses = extracts.filter((e) => e.extractType === "shall_clause");
    const gaps = await detectGaps(shallClauses, options.curatedObligations, options.gapThreshold ?? 0.85);
    for (const gap of gaps) {
      findings.push({
        finding: gap,
        provenanceTier: "AI_GENERATED",
        sourceExtractId: gap.shallClauseId,
      });
    }
  }

  return findings;
}
```

## Gap Detection

```typescript
// packages/agent/src/swarm/gap-detector.ts
import type { GapFinding } from "./types.js";

interface ShallClause {
  id: number;
  articleId: string;
  valueText: string | null;
  verbatimExcerpt: string;
}

interface CuratedObligation {
  id: string;
  embedding: number[];
  obligation: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function detectGaps(
  shallClauses: ShallClause[],
  curatedObligations: CuratedObligation[],
  threshold: number,
): Promise<GapFinding[]> {
  const gaps: GapFinding[] = [];

  // For each shall-clause, find the best-matching curated obligation
  // Uses pre-computed embeddings — no LLM call
  for (const clause of shallClauses) {
    if (!clause.valueText) continue;

    // Simple text overlap check first (cheap, catches exact matches)
    const exactMatch = curatedObligations.find((o) =>
      o.obligation.toLowerCase().includes(clause.valueText!.toLowerCase().slice(0, 50)) ||
      clause.valueText!.toLowerCase().includes(o.obligation.toLowerCase().slice(0, 50))
    );
    if (exactMatch) continue;

    // No match found — this is a gap
    gaps.push({
      type: "gap",
      shallClauseText: clause.valueText,
      shallClauseId: clause.id,
      articleRef: clause.articleId,
      reason: "No curated obligation matches this verbatim legal requirement",
    });
  }

  return gaps;
}
```

Note: P0 uses text overlap matching (deterministic, no embeddings needed). P1 upgrades to cosine similarity on pre-computed embeddings for higher accuracy.

## Synthesis

```typescript
// packages/agent/src/swarm/synthesise.ts
import { eq } from "drizzle-orm";
import { complianceWorkspace } from "@lexius/db";
import type { Database } from "@lexius/db";
import type { ComplianceReport } from "@lexius/core";
import type { SwarmResult, WorkspaceEntry, FindingType } from "./types.js";

export async function synthesise(
  db: Database,
  sessionId: string,
  metadata: {
    legislationId: string;
    legislationName: string;
    systemDescription: string;
  },
): Promise<ComplianceReport> {
  const rows = await db
    .select()
    .from(complianceWorkspace)
    .where(eq(complianceWorkspace.sessionId, sessionId));

  const findings = rows as unknown as WorkspaceEntry[];

  const obligations = findings
    .filter((f) => f.findingType === "obligation")
    .map((f) => {
      const o = f.finding as any;
      return {
        obligation: o.text,
        article: f.articleId,
        deadline: null,
        category: "swarm-discovered",
        provenanceTier: f.provenanceTier,
      };
    });

  const gaps = findings.filter((f) => f.findingType === "gap");
  const penalties = findings.filter((f) => f.findingType === "penalty");
  const deadlines = findings.filter((f) => f.findingType === "deadline");

  const relianceByTier = { AUTHORITATIVE: 0, CURATED: 0, AI_GENERATED: 0 };
  for (const f of findings) {
    relianceByTier[f.provenanceTier]++;
  }

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      legislationId: metadata.legislationId,
      legislationName: metadata.legislationName,
      reportVersion: "swarm-1.0",
    },
    systemDescription: metadata.systemDescription,
    classification: {
      riskLevel: "pending",
      confidence: "0",
      basis: "swarm-analysis",
      matchedCategory: null,
      matchedSignals: [],
      missingSignals: [],
    },
    obligations,
    assessments: [],
    penaltyExposure: penalties.length > 0
      ? {
          highestTier: "high-risk-non-compliance",
          maxFine: Math.max(...penalties.map((p) => (p.finding as any).amountEur || 0)),
          explanation: `${penalties.length} penalty provisions found across ${new Set(penalties.map((p) => p.articleId)).size} articles`,
        }
      : null,
    documentationChecklist: null,
    deadlines: deadlines.map((d) => ({
      date: (d.finding as any).date,
      event: `Deadline from ${d.articleId}`,
      daysRemaining: Math.ceil((new Date((d.finding as any).date).getTime() - Date.now()) / 86400000),
      isPast: new Date((d.finding as any).date) < new Date(),
    })),
    citations: findings
      .filter((f) => f.provenanceTier === "AUTHORITATIVE")
      .slice(0, 20)
      .map((f) => ({
        article: f.articleId,
        title: "",
        summary: (f.finding as any).text?.slice(0, 200) || JSON.stringify(f.finding).slice(0, 200),
        url: "",
      })),
    recommendations: gaps.map((g) => `GAP: ${(g.finding as any).shallClauseText?.slice(0, 150)} (${g.articleId})`),
    confidence: {
      overall: "high",
      signalCompleteness: 1.0,
      reasoning: `Swarm analysed all ${rows.length} articles; found ${gaps.length} gaps`,
    },
    relianceByTier,
  };
}
```

## Orchestrator

```typescript
// packages/agent/src/swarm/index.ts
import type { Database } from "@lexius/db";
import { createSwarmSession, cleanupSession } from "./session.js";
import { runSwarmAgent } from "./agent-loop.js";
import { synthesise } from "./synthesise.js";
import type { SwarmResult } from "./types.js";

export { createSwarmSession, cleanupSession } from "./session.js";
export { synthesise } from "./synthesise.js";
export type * from "./types.js";

export async function runSwarm(
  db: Database,
  legislationId: string,
  options: {
    concurrency?: number;
    batchSize?: number;
    gapThreshold?: number;
  } = {},
): Promise<SwarmResult> {
  const concurrency = options.concurrency ?? 4;
  const sessionId = await createSwarmSession(db, legislationId);
  const start = Date.now();

  const agents = Array.from({ length: concurrency }, (_, i) =>
    runSwarmAgent(db, sessionId, `swarm-agent-${i}`, {
      batchSize: options.batchSize,
      gapThreshold: options.gapThreshold,
    }),
  );

  const findingCounts = await Promise.all(agents);
  const totalFindings = findingCounts.reduce((a, b) => a + b, 0);

  return {
    sessionId,
    totalArticles: findingCounts.length > 0 ? -1 : 0, // filled by caller
    totalFindings,
    findingsByType: {} as any, // filled by synthesis
    gapCount: 0,
    durationMs: Date.now() - start,
  };
}
```

## API / MCP Integration

### API routes

```typescript
// POST /api/v1/swarm/run
// Body: { legislationId, concurrency?, systemDescription }
// Returns: { sessionId, totalFindings, durationMs }

// GET /api/v1/swarm/:sessionId/findings
// Query: ?type=obligation|penalty|gap...
// Returns: WorkspaceEntry[]

// POST /api/v1/swarm/:sessionId/synthesise
// Body: { legislationName, systemDescription }
// Returns: ComplianceReport
```

### MCP tool

```
legalai_run_swarm_assessment({
  legislationId: string,
  systemDescription: string,
  concurrency?: number,
})
→ ComplianceReport (same shape as GenerateAuditReport)
```

## Testing Strategy

### Unit
- `createSwarmSession`: populates queue with all AUTHORITATIVE articles
- `runSwarmAgent`: claims batch, produces findings, marks complete
- `detectGaps`: shall-clause with no match → gap; with match → no gap
- `synthesise`: workspace findings → ComplianceReport shape

### Integration
- Run swarm with concurrency=1 against EU AI Act → verify expected finding counts
- Run swarm with concurrency=4 → verify same findings (determinism test)
- Verify no workspace entry has a null `article_id` or invalid `finding_type`
- Verify gap findings reference real shall-clause extract IDs

### E2E
- `POST /swarm/run` → `GET /findings` → `POST /synthesise` → report has obligations + penalties + deadlines + gaps

## Specflow Contract (lands with implementation)

```yaml
contract_meta:
  id: hivemind_swarm
  version: 1
  created_from_spec: "PRD-010 / ARD-014 / DDD-013 — hivemind swarm determinism and integrity"
  covers_reqs:
    - SWARM-001
    - SWARM-002
    - SWARM-003
    - SWARM-004
  owner: "legal-ai-team"

llm_policy:
  enforce: true
  llm_may_modify_non_negotiables: false
  override_phrase: "override_contract: hivemind_swarm"

rules:
  non_negotiable:
    - id: SWARM-001
      title: "Swarm agent loop must not call LLM APIs"
      scope:
        - "packages/agent/src/swarm/agent-loop.{ts,js}"
        - "packages/agent/src/swarm/gap-detector.{ts,js}"
      behavior:
        forbidden_patterns:
          - pattern: /from\s+['"](?:@anthropic-ai\/sdk|openai)/
            message: "P0 swarm agents are deterministic — no LLM calls. LLM gap analysis is a P1 opt-in flag."
          - pattern: /\bclient\.messages\.create\b/
            message: "Swarm agent loop must not call the Anthropic API directly"

    - id: SWARM-002
      title: "Workspace writes must include session_id and provenance_tier"
      scope:
        - "packages/agent/src/swarm/**/*.{ts,js}"
      behavior:
        required_patterns:
          - pattern: /sessionId/
            message: "Every workspace write must include the session_id"
          - pattern: /provenanceTier/
            message: "Every workspace finding must carry a provenance_tier"

    - id: SWARM-003
      title: "Work queue claims must be atomic"
      scope:
        - "packages/agent/src/swarm/agent-loop.{ts,js}"
      behavior:
        required_patterns:
          - pattern: /FOR UPDATE SKIP LOCKED|claimed_by IS NULL/
            message: "Work queue claims must use atomic SQL (FOR UPDATE SKIP LOCKED or WHERE claimed_by IS NULL) to prevent double-claiming"

    - id: SWARM-004
      title: "Session cleanup must delete both workspace and queue"
      scope:
        - "packages/agent/src/swarm/session.{ts,js}"
      behavior:
        required_patterns:
          - pattern: /complianceWorkspace/
            message: "Session cleanup must delete workspace findings"
          - pattern: /swarmWorkQueue/
            message: "Session cleanup must delete work queue entries"
```

## Rollout Order

1. Schema migration `0004_hivemind_swarm.sql` + Drizzle schema files.
2. Domain types (`packages/agent/src/swarm/types.ts`).
3. Session management (create + cleanup).
4. Agent loop (single-threaded, no gap detection).
5. Gap detector (text overlap matching, P0).
6. Parallel execution (Promise.all, configurable concurrency).
7. Synthesis agent producing ComplianceReport.
8. API routes (`/swarm/run`, `/swarm/:sessionId/findings`, `/swarm/:sessionId/synthesise`).
9. MCP tool `legalai_run_swarm_assessment`.
10. Contract `hivemind_swarm.yml` + CI verification.

## Open Questions

- Optimal concurrency for different legislation sizes (EU AI Act 126 articles vs DORA 64).
- Whether gap detection should emit a confidence score (requires embedding comparison, P1).
- Session TTL before automatic cleanup (24h default, configurable).
- Whether the synthesis agent should merge duplicate obligations (two agents may find the same shall-clause if it spans a paragraph boundary).
