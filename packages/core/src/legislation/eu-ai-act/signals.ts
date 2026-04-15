import type { SignalSchema } from "../../domain/plugin.js";
import type { ClassifyOutput } from "../../domain/value-objects/classify.js";

export const signalSchema: SignalSchema = {
  domain: {
    type: "enum",
    options: [
      "biometrics",
      "critical-infrastructure",
      "education",
      "employment",
      "essential-services",
      "law-enforcement",
      "migration",
      "justice",
      "other",
    ],
    question: "In which domain will the AI system operate?",
  },
  uses_biometrics: {
    type: "boolean",
    question: "Does the system use biometric identification or categorisation?",
  },
  biometric_realtime: {
    type: "boolean",
    question: "Does the system perform real-time biometric identification?",
    dependsOn: { uses_biometrics: true },
  },
  biometric_law_enforcement: {
    type: "boolean",
    question: "Is the real-time biometric identification used for law enforcement in publicly accessible spaces?",
    dependsOn: { biometric_realtime: true },
  },
  is_safety_component: {
    type: "boolean",
    question: "Is the AI system a safety component of a product covered by EU harmonisation legislation?",
  },
  affects_fundamental_rights: {
    type: "boolean",
    question: "Does the system have potential to affect fundamental rights?",
  },
  targets_vulnerable: {
    type: "boolean",
    question: "Does the system target or disproportionately affect vulnerable groups (children, disabled persons)?",
  },
  generates_synthetic_content: {
    type: "boolean",
    question: "Does the system generate synthetic audio, image, video, or text content (deepfakes)?",
  },
  interacts_with_natural_persons: {
    type: "boolean",
    question: "Does the system directly interact with natural persons (e.g., chatbot, virtual assistant)?",
  },
  performs_emotion_recognition_workplace: {
    type: "boolean",
    question: "Does the system perform emotion recognition in the workplace or educational institutions?",
  },
  performs_social_scoring: {
    type: "boolean",
    question: "Does the system perform social scoring of natural persons by public authorities?",
  },
};

const domainToAnnexCategory: Record<string, { category: string; level: number }> = {
  biometrics: { category: "Biometric identification and categorisation (Annex III, 1)", level: 4 },
  "critical-infrastructure": { category: "Critical infrastructure management (Annex III, 2)", level: 4 },
  education: { category: "Education and vocational training (Annex III, 3)", level: 4 },
  employment: { category: "Employment, workers management (Annex III, 4)", level: 4 },
  "essential-services": { category: "Access to essential services (Annex III, 5)", level: 4 },
  "law-enforcement": { category: "Law enforcement (Annex III, 6)", level: 4 },
  migration: { category: "Migration, asylum, border control (Annex III, 7)", level: 4 },
  justice: { category: "Administration of justice and democratic processes (Annex III, 8)", level: 4 },
};

export function classifyBySignals(signals: Record<string, unknown>): ClassifyOutput | null {
  const matchedSignals: string[] = [];
  const allSignalKeys = Object.keys(signalSchema);
  const providedKeys = Object.keys(signals);
  const missingSignals = allSignalKeys.filter((k) => !providedKeys.includes(k));

  // Track which signals are true
  for (const key of providedKeys) {
    if (signals[key] === true || (typeof signals[key] === "string" && signals[key] !== "other")) {
      matchedSignals.push(key);
    }
  }

  // 1. Prohibited checks
  if (signals.performs_social_scoring === true) {
    return {
      riskClassification: "unacceptable",
      confidence: "high",
      matchedCategory: { name: "Social scoring by public authorities", level: 5 },
      relevantArticles: ["Article 5(1)(c)"],
      roleDetermination: "provider",
      obligationsSummary: "This AI system is prohibited under the EU AI Act.",
      matchedSignals,
      missingSignals,
      nextQuestions: [],
      basis: "signals",
    };
  }

  if (signals.performs_emotion_recognition_workplace === true) {
    return {
      riskClassification: "unacceptable",
      confidence: "high",
      matchedCategory: { name: "Emotion recognition in workplace/school", level: 5 },
      relevantArticles: ["Article 5(1)(f)"],
      roleDetermination: "provider",
      obligationsSummary: "This AI system is prohibited under the EU AI Act.",
      matchedSignals,
      missingSignals,
      nextQuestions: [],
      basis: "signals",
    };
  }

  if (signals.biometric_law_enforcement === true) {
    return {
      riskClassification: "unacceptable",
      confidence: "high",
      matchedCategory: { name: "Real-time remote biometric identification for law enforcement", level: 5 },
      relevantArticles: ["Article 5(1)(d)"],
      roleDetermination: "provider",
      obligationsSummary: "This AI system is prohibited under the EU AI Act (subject to narrow exceptions).",
      matchedSignals,
      missingSignals,
      nextQuestions: [],
      basis: "signals",
    };
  }

  // 2. High-risk via domain mapping
  const domain = signals.domain as string | undefined;
  if (domain && domain in domainToAnnexCategory) {
    const mapped = domainToAnnexCategory[domain];
    return {
      riskClassification: "high",
      confidence: "high",
      matchedCategory: { name: mapped.category, level: mapped.level },
      relevantArticles: ["Article 6(2)", "Annex III"],
      roleDetermination: "provider",
      obligationsSummary: "High-risk AI system. Must comply with Chapter 2 requirements including risk management, data governance, transparency, human oversight, accuracy, robustness, and cybersecurity.",
      matchedSignals,
      missingSignals,
      nextQuestions: [],
      basis: "signals",
    };
  }

  if (signals.is_safety_component === true) {
    return {
      riskClassification: "high",
      confidence: "high",
      matchedCategory: { name: "Safety component (Annex I)", level: 4 },
      relevantArticles: ["Article 6(1)", "Annex I"],
      roleDetermination: "provider",
      obligationsSummary: "High-risk AI system as safety component. Must comply with Chapter 2 requirements.",
      matchedSignals,
      missingSignals,
      nextQuestions: [],
      basis: "signals",
    };
  }

  // 3. Limited-risk transparency obligations
  if (signals.generates_synthetic_content === true) {
    return {
      riskClassification: "limited",
      confidence: "high",
      matchedCategory: { name: "Synthetic content generation", level: 2 },
      relevantArticles: ["Article 50(2)"],
      roleDetermination: "provider",
      obligationsSummary: "Limited-risk: transparency obligations apply. Must mark output as artificially generated and ensure technical detectability.",
      matchedSignals,
      missingSignals,
      nextQuestions: [],
      basis: "signals",
    };
  }

  if (signals.interacts_with_natural_persons === true) {
    return {
      riskClassification: "limited",
      confidence: "medium",
      matchedCategory: { name: "Direct interaction with natural persons", level: 2 },
      relevantArticles: ["Article 50(1)"],
      roleDetermination: "deployer",
      obligationsSummary: "Limited-risk: must inform natural persons that they are interacting with an AI system.",
      matchedSignals,
      missingSignals,
      nextQuestions: [],
      basis: "signals",
    };
  }

  // No signal matched decisively
  return null;
}
