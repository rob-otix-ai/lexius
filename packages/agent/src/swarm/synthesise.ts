import { eq } from "drizzle-orm";
import { complianceWorkspace } from "@lexius/db";
import type { Database } from "@lexius/db";
import type { ComplianceReport } from "@lexius/core";
import type { WorkspaceEntry } from "./types.js";

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

  // Map obligation findings
  const obligations = findings
    .filter((f) => f.findingType === "obligation")
    .map((f) => {
      const o = f.finding as any;
      return {
        obligation: o.text,
        article: f.articleId,
        deadline: null as string | null,
        category: "swarm-discovered",
        provenanceTier: f.provenanceTier as "AUTHORITATIVE" | "CURATED" | "AI_GENERATED",
      };
    });

  // Collect typed findings
  const gaps = findings.filter((f) => f.findingType === "gap");
  const penalties = findings.filter((f) => f.findingType === "penalty");
  const deadlines = findings.filter((f) => f.findingType === "deadline");

  // Compute reliance by tier
  const relianceByTier = { AUTHORITATIVE: 0, CURATED: 0, AI_GENERATED: 0 };
  for (const f of findings) {
    const tier = f.provenanceTier as keyof typeof relianceByTier;
    if (tier in relianceByTier) {
      relianceByTier[tier]++;
    }
  }

  // Compute penalty exposure: find the max fine from penalty findings
  const maxFine =
    penalties.length > 0
      ? Math.max(...penalties.map((p) => (p.finding as any).amountEur || 0))
      : 0;

  const penaltyExposure =
    penalties.length > 0
      ? {
          highestTier: "high-risk-non-compliance",
          maxFine,
          explanation: `${penalties.length} penalty provisions found across ${new Set(penalties.map((p) => p.articleId)).size} articles`,
        }
      : null;

  // Map deadlines
  const deadlineEntries = deadlines.map((d) => {
    const finding = d.finding as any;
    const dateStr = finding.date || "";
    const dateObj = new Date(dateStr);
    const daysRemaining = dateStr
      ? Math.ceil((dateObj.getTime() - Date.now()) / 86_400_000)
      : 0;
    return {
      date: dateStr,
      event: `Deadline from ${d.articleId}`,
      daysRemaining,
      isPast: dateStr ? dateObj < new Date() : false,
    };
  });

  // Top 20 AUTHORITATIVE findings as citations
  const citations = findings
    .filter((f) => f.provenanceTier === "AUTHORITATIVE")
    .slice(0, 20)
    .map((f) => ({
      article: f.articleId,
      title: "",
      summary:
        (f.finding as any).text?.slice(0, 200) ||
        JSON.stringify(f.finding).slice(0, 200),
      url: "",
    }));

  // Gap findings become recommendations
  const recommendations = gaps.map(
    (g) =>
      `GAP: ${(g.finding as any).shallClauseText?.slice(0, 150)} (${g.articleId})`,
  );

  // Determine overall confidence based on coverage
  const authoritative = relianceByTier.AUTHORITATIVE;
  const total = findings.length;
  const authRatio = total > 0 ? authoritative / total : 0;
  const overallConfidence: "high" | "medium" | "low" =
    authRatio >= 0.7 ? "high" : authRatio >= 0.4 ? "medium" : "low";

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
    penaltyExposure,
    documentationChecklist: null,
    deadlines: deadlineEntries,
    citations,
    recommendations,
    confidence: {
      overall: overallConfidence,
      signalCompleteness: authRatio,
      reasoning: `Swarm analysed ${total} findings; ${gaps.length} gaps detected; ${(authRatio * 100).toFixed(0)}% authoritative`,
    },
    relianceByTier,
  };
}
