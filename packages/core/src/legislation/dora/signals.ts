import type { SignalSchema } from "../../domain/plugin.js";
import type { ClassifyOutput } from "../../domain/value-objects/classify.js";

export const signalSchema: SignalSchema = {
  entity_type: {
    type: "enum",
    options: [
      "credit-institution",
      "payment-institution",
      "investment-firm",
      "crypto-asset-provider",
      "insurance-undertaking",
      "reinsurance-undertaking",
      "aifm",
      "ucits-manager",
      "csd",
      "ccp",
      "trading-venue",
      "trade-repository",
      "data-reporting-service",
      "credit-rating-agency",
      "ict-third-party",
      "ict-intra-group",
      "not-applicable",
    ],
    question: "What type of financial entity or ICT provider is this?",
  },
  is_microenterprise: {
    type: "boolean",
    question: "Is this a microenterprise (< 10 staff AND turnover/balance sheet ≤ €2M)?",
  },
  supports_critical_functions: {
    type: "boolean",
    question: "Does this ICT service support a Critical or Important Function?",
  },
  uses_ict_third_parties: {
    type: "boolean",
    question: "Does the entity use ICT third-party service providers?",
  },
  is_systemically_important: {
    type: "boolean",
    question: "Is this a G-SII, O-SII, or otherwise systemically important entity?",
    dependsOn: { is_microenterprise: false },
  },
  is_ctpp_designated: {
    type: "boolean",
    question: "Has this entity been designated as a Critical ICT Third-Party Provider?",
    dependsOn: { entity_type: "ict-third-party" },
  },
};

export function classifyBySignals(signals: Record<string, unknown>): ClassifyOutput | null {
  const matchedSignals: string[] = [];
  const allSignalKeys = Object.keys(signalSchema);
  const providedKeys = Object.keys(signals);
  const missingSignals = allSignalKeys.filter((k) => !providedKeys.includes(k));

  for (const key of providedKeys) {
    if (signals[key] === true || (typeof signals[key] === "string" && signals[key] !== "not-applicable")) {
      matchedSignals.push(key);
    }
  }

  // 1. Out-of-scope
  if (signals.entity_type === "not-applicable") {
    return {
      riskClassification: "out-of-scope",
      confidence: "high",
      matchedCategory: { name: "Not in scope", level: 0 },
      relevantArticles: ["Article 2"],
      roleDetermination: "unknown",
      obligationsSummary: "This regulation does not apply to this entity.",
      matchedSignals,
      missingSignals,
      nextQuestions: [],
      basis: "signals",
    };
  }

  // 2. CTPP designation takes precedence
  if (signals.is_ctpp_designated === true) {
    return {
      riskClassification: "ctpp",
      confidence: "high",
      matchedCategory: { name: "Designated critical ICT third-party provider", level: 5 },
      relevantArticles: ["Article 31", "Article 35"],
      roleDetermination: "provider",
      obligationsSummary: "Subject to EU-level Lead Overseer supervision. Periodic penalty payments up to 1% of average daily worldwide turnover apply.",
      matchedSignals,
      missingSignals,
      nextQuestions: [],
      basis: "signals",
    };
  }

  // 3. Microenterprise simplified regime (Art. 16)
  if (signals.is_microenterprise === true && signals.entity_type && signals.entity_type !== "ict-third-party") {
    return {
      riskClassification: "simplified-framework",
      confidence: "high",
      matchedCategory: { name: "Simplified ICT risk management (Art. 16)", level: 2 },
      relevantArticles: ["Article 16"],
      roleDetermination: "deployer",
      obligationsSummary: "Simplified ICT risk management framework applies. Threat-led penetration testing is not required.",
      matchedSignals,
      missingSignals,
      nextQuestions: [],
      basis: "signals",
    };
  }

  // 4. Standard financial entity
  if (signals.entity_type && typeof signals.entity_type === "string" && signals.entity_type !== "not-applicable" && signals.entity_type !== "ict-third-party") {
    return {
      riskClassification: "full-framework",
      confidence: "high",
      matchedCategory: { name: `${signals.entity_type} under full framework`, level: 4 },
      relevantArticles: ["Article 5", "Article 6", "Article 17", "Article 24", "Article 28"],
      roleDetermination: "deployer",
      obligationsSummary: "Full ICT risk management framework applies across five pillars: governance, incident management, resilience testing, third-party risk, oversight.",
      matchedSignals,
      missingSignals,
      nextQuestions: [],
      basis: "signals",
    };
  }

  // 5. ICT third-party but not CTPP
  if (signals.entity_type === "ict-third-party") {
    return {
      riskClassification: "full-framework",
      confidence: "medium",
      matchedCategory: { name: "ICT third-party service provider", level: 3 },
      relevantArticles: ["Article 28", "Article 30"],
      roleDetermination: "provider",
      obligationsSummary: "Subject to contractual and oversight obligations imposed by financial entity clients per Art. 28 and Art. 30.",
      matchedSignals,
      missingSignals,
      nextQuestions: ["Has this entity been designated as a Critical ICT Third-Party Provider?"],
      basis: "signals",
    };
  }

  return null;
}
