/**
 * Proxy container for MCP proxy mode.
 *
 * Returns an object matching the Container interface shape from @lexius/core,
 * where each use case's `execute()` delegates to an HTTP call to the hosted API.
 *
 * This file must NOT import from @lexius/db, @lexius/core, or @lexius/infra.
 */

export function createProxyContainer(baseUrl: string, apiKey: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  async function get<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}/api/v1${path}`, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async function post<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  function qs(params: Record<string, string | undefined>): string {
    const entries = Object.entries(params).filter(
      (kv): kv is [string, string] => kv[1] != null && kv[1] !== "",
    );
    if (entries.length === 0) return "";
    return "?" + new URLSearchParams(entries).toString();
  }

  return {
    // --- Use cases (each has an `execute` method matching what the MCP tools call) ---

    classifySystem: {
      execute: (input: {
        legislationId: string;
        description?: string;
        useCase?: string;
        role: string;
        signals?: Record<string, unknown>;
      }) => post("/classify", input),
    },

    getObligations: {
      execute: (filter: {
        legislationId: string;
        role?: string;
        riskLevel?: string;
      }) =>
        get(
          `/obligations${qs({
            legislationId: filter.legislationId,
            role: filter.role,
            riskLevel: filter.riskLevel,
          })}`,
        ),
    },

    calculatePenalty: {
      execute: (input: {
        legislationId: string;
        violationType: string;
        annualTurnoverEur: number;
        isSme?: boolean;
      }) => post("/penalties/calculate", input),
    },

    searchKnowledge: {
      execute: (input: {
        legislationId: string;
        query: string;
        limit?: number;
        entityType: string;
      }) => post("/knowledge/search", input),
    },

    getArticle: {
      execute: (legislationId: string, articleNumber: string) =>
        get(`/articles/${encodeURIComponent(articleNumber)}${qs({ legislationId })}`),
    },

    getDeadlines: {
      execute: (legislationId: string) =>
        get(`/deadlines${qs({ legislationId })}`),
    },

    answerQuestion: {
      execute: (legislationId: string, question: string) =>
        post("/faq/search", { legislationId, question }),
    },

    runAssessment: {
      execute: (
        legislationId: string,
        assessmentId: string,
        input: Record<string, unknown>,
      ) =>
        post(`/assessments/${encodeURIComponent(assessmentId)}`, {
          legislationId,
          input,
        }),
    },

    listLegislations: {
      execute: () => get("/legislations"),
    },

    getArticleHistory: {
      execute: (articleId: string) =>
        get(`/articles/${encodeURIComponent(articleId)}/history`),
    },

    getDerivationChain: {
      execute: (obligationId: string) =>
        get(`/obligations/${encodeURIComponent(obligationId)}/derivation`),
    },

    getArticleExtracts: {
      execute: (articleId: string, extractType?: string) =>
        get(
          `/articles/${encodeURIComponent(articleId)}/extracts${
            extractType ? qs({ type: extractType }) : ""
          }`,
        ),
    },

    generateAuditReport: {
      execute: (input: Record<string, unknown>) => post("/audit", input),
    },

    enhanceAuditReport: {
      execute: (report: unknown, systemDescription: string) =>
        post("/audit", { ...(report as Record<string, unknown>), enhanced: true, systemDescription }),
    },

    // --- Repo stubs used by some MCP tools ---

    penaltyRepo: {
      findByLegislation: (legislationId: string) =>
        get(`/penalties${qs({ legislationId })}`),
    },

    deadlineRepo: {},

    pluginRegistry: {},
  };
}
