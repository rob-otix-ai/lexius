import { faq } from "../../schema/index.js";
import type { Database } from "../../index.js";
import type { EmbeddingFn } from "../run.js";

const LEGISLATION_ID = "eu-ai-act";

const faqData = [
  {
    id: `${LEGISLATION_ID}-faq-what-is`,
    question: "What is the EU AI Act?",
    answer:
      "The EU AI Act (Regulation 2024/1689) is the world's first comprehensive legal framework for artificial intelligence. It establishes harmonised rules for the placing on the market, putting into service and use of AI systems in the European Union. The regulation takes a risk-based approach, categorising AI systems into four risk levels (prohibited, high-risk, limited, and minimal) with corresponding obligations.",
    articleReferences: ["Art. 1", "Art. 2"],
    keywords: ["EU AI Act", "regulation", "overview", "framework"],
    category: "general",
  },
  {
    id: `${LEGISLATION_ID}-faq-who-applies`,
    question: "Who does the EU AI Act apply to?",
    answer:
      "The EU AI Act applies to providers who develop or have AI systems developed and place them on the market or put them into service in the EU, deployers who use AI systems under their authority within the EU, and providers/deployers located in third countries where the AI system output is used in the EU. It also applies to importers and distributors of AI systems. Certain exemptions exist for military/national security, research, and personal non-professional use.",
    articleReferences: ["Art. 2", "Art. 3"],
    keywords: ["scope", "applicability", "provider", "deployer", "extraterritorial"],
    category: "scope",
  },
  {
    id: `${LEGISLATION_ID}-faq-risk-classification`,
    question: "How does the EU AI Act classify AI systems by risk?",
    answer:
      "The EU AI Act uses a four-tier risk classification: (1) Unacceptable/Prohibited risk (Art. 5) - AI practices that are banned entirely, such as social scoring and subliminal manipulation; (2) High-risk (Art. 6, Annex III) - AI systems subject to strict requirements before market placement; (3) Limited risk (Art. 50) - AI systems with transparency obligations, such as chatbots and deepfakes; (4) Minimal risk - all other AI systems with no specific obligations beyond AI literacy.",
    articleReferences: ["Art. 5", "Art. 6", "Art. 50", "Annex III"],
    keywords: ["risk", "classification", "categories", "tiers", "levels"],
    category: "risk-classification",
  },
  {
    id: `${LEGISLATION_ID}-faq-provider-vs-deployer`,
    question: "What is the difference between a provider and a deployer under the EU AI Act?",
    answer:
      "A provider is the entity that develops an AI system (or has it developed) and places it on the market or puts it into service under their own name or trademark. A deployer is the entity that uses an AI system under their authority, except where the AI system is used in the course of a personal non-professional activity. Importantly, a deployer who substantially modifies a high-risk AI system becomes a provider for that modified system.",
    articleReferences: ["Art. 3(3)", "Art. 3(4)", "Art. 25"],
    keywords: ["provider", "deployer", "roles", "definitions", "responsibilities"],
    category: "roles",
  },
  {
    id: `${LEGISLATION_ID}-faq-high-risk-obligations`,
    question: "What are the main obligations for high-risk AI systems?",
    answer:
      "High-risk AI system providers must: establish a risk management system (Art. 9), ensure data governance (Art. 10), prepare technical documentation (Art. 11), implement logging (Art. 12), ensure transparency (Art. 13), design for human oversight (Art. 14), ensure accuracy and robustness (Art. 15), implement a QMS (Art. 17), undergo conformity assessment (Art. 43), and establish post-market monitoring (Art. 72). Deployers must use systems according to instructions, assign human oversight, monitor operation, and conduct fundamental rights impact assessments where required.",
    articleReferences: ["Art. 9-17", "Art. 26", "Art. 27", "Art. 43", "Art. 72"],
    keywords: ["high-risk", "obligations", "requirements", "provider", "deployer"],
    category: "obligations",
  },
  {
    id: `${LEGISLATION_ID}-faq-prohibited-practices`,
    question: "What AI practices are prohibited under the EU AI Act?",
    answer:
      "Article 5 prohibits: (1) subliminal techniques causing harm, (2) exploitation of vulnerabilities due to age, disability or socio-economic situation, (3) social scoring by public authorities, (4) real-time remote biometric identification for law enforcement in public spaces (with limited exceptions), (5) emotion recognition in workplaces and schools, (6) untargeted scraping of facial images from the internet or CCTV, (7) biometric categorisation to infer sensitive attributes like race or religion, and (8) predictive policing based solely on profiling or personality traits.",
    articleReferences: ["Art. 5"],
    keywords: ["prohibited", "banned", "unacceptable", "social scoring", "biometric", "manipulation"],
    category: "prohibited-practices",
  },
  {
    id: `${LEGISLATION_ID}-faq-transparency`,
    question: "What are the transparency requirements under the EU AI Act?",
    answer:
      "For limited-risk AI systems (Art. 50): AI systems interacting with persons must disclose the AI nature of the interaction; deepfake content must be labelled; AI-generated text for public information must be marked; emotion recognition system use must be disclosed. For high-risk systems (Art. 13): systems must be transparent enough for deployers to interpret outputs, with comprehensive instructions for use. GPAI providers must publish training content summaries.",
    articleReferences: ["Art. 13", "Art. 50", "Art. 53"],
    keywords: ["transparency", "disclosure", "labelling", "chatbot", "deepfake"],
    category: "transparency",
  },
  {
    id: `${LEGISLATION_ID}-faq-gpai`,
    question: "What are the rules for general-purpose AI (GPAI) models?",
    answer:
      "All GPAI model providers must: prepare technical documentation, provide information to downstream providers, establish a copyright compliance policy, and publish a training content summary. GPAI models with systemic risk (e.g., those trained with >10^25 FLOPs) have additional obligations: model evaluations including adversarial testing, systemic risk assessment and mitigation, serious incident reporting, and cybersecurity protections. Open-source models have some exemptions unless classified as systemic risk.",
    articleReferences: ["Art. 51", "Art. 52", "Art. 53", "Art. 55"],
    keywords: ["GPAI", "general-purpose", "foundation model", "systemic risk", "open source"],
    category: "gpai",
  },
  {
    id: `${LEGISLATION_ID}-faq-penalties`,
    question: "What are the penalties for non-compliance with the EU AI Act?",
    answer:
      "The EU AI Act establishes three tiers of penalties: (1) Prohibited practices violations: up to EUR 35 million or 7% of global annual turnover, whichever is higher; (2) High-risk system non-compliance: up to EUR 15 million or 3% of global turnover; (3) Supplying false information to authorities: up to EUR 10 million or 2% of global turnover. For SMEs and startups, the fine is the lower of the fixed amount or the percentage, ensuring proportionality.",
    articleReferences: ["Art. 99", "Art. 100"],
    keywords: ["penalties", "fines", "sanctions", "enforcement", "turnover"],
    category: "penalties",
  },
  {
    id: `${LEGISLATION_ID}-faq-deadlines`,
    question: "What are the key implementation deadlines for the EU AI Act?",
    answer:
      "The EU AI Act follows a phased implementation: 1 Aug 2024 - entry into force; 2 Feb 2025 - prohibitions and AI literacy apply; 2 Aug 2025 - GPAI rules and governance apply; 2 Aug 2026 - high-risk AI system obligations (Annex III) apply; 2 Aug 2027 - obligations for high-risk AI in Annex I products apply. This phased approach gives organisations time to prepare for compliance.",
    articleReferences: ["Art. 113"],
    keywords: ["deadlines", "timeline", "implementation", "dates", "phased"],
    category: "deadlines",
  },
  {
    id: `${LEGISLATION_ID}-faq-art6-exception`,
    question: "What is the Article 6(3) exception for high-risk AI systems?",
    answer:
      "Article 6(3) provides that an AI system listed in Annex III shall not be considered high-risk if it does not pose a significant risk of harm to the health, safety or fundamental rights of natural persons, including by not materially influencing the outcome of decision-making. This applies when the AI system is intended to perform a narrow procedural task, improve the result of a previously completed human activity, detect decision-making patterns without replacing human assessment, or perform a preparatory task to an assessment relevant for the use cases listed in Annex III.",
    articleReferences: ["Art. 6(3)"],
    keywords: ["exception", "Article 6(3)", "high-risk", "exemption", "narrow procedural"],
    category: "risk-classification",
  },
  {
    id: `${LEGISLATION_ID}-faq-fria`,
    question: "What is a Fundamental Rights Impact Assessment (FRIA)?",
    answer:
      "A Fundamental Rights Impact Assessment (Art. 27) must be conducted by deployers of high-risk AI systems that are public law bodies, private entities providing public services, or deployers of systems for creditworthiness assessment or risk pricing in life/health insurance. The FRIA must describe the deployer's processes, intended use period and frequency, categories of affected natural persons, specific risks of harm, human oversight measures, and escalation procedures. The first FRIA must be completed before deployment, and updated when necessary.",
    articleReferences: ["Art. 27"],
    keywords: ["FRIA", "fundamental rights", "impact assessment", "deployer", "public services"],
    category: "obligations",
  },
  {
    id: `${LEGISLATION_ID}-faq-ai-literacy`,
    question: "What does the AI literacy obligation require?",
    answer:
      "Article 4 requires providers and deployers to ensure a sufficient level of AI literacy among their staff and other persons dealing with AI systems on their behalf. Measures must take into account the technical knowledge, experience, education, training, and context of use, as well as the persons or groups of persons on whom the AI system is to be used. This is a universal obligation applying from 2 February 2025, regardless of the AI system's risk classification.",
    articleReferences: ["Art. 4"],
    keywords: ["AI literacy", "training", "education", "staff", "universal"],
    category: "obligations",
  },
  {
    id: `${LEGISLATION_ID}-faq-conformity-assessment`,
    question: "How does conformity assessment work under the EU AI Act?",
    answer:
      "Conformity assessment (Art. 43) is the process by which providers demonstrate that high-risk AI systems comply with requirements. Two procedures exist: (1) Internal control based on Annex VI, where the provider self-assesses compliance; (2) Assessment involving a notified body based on Annex VII, required for certain biometric and critical infrastructure systems. New conformity assessment is required when a system is substantially modified. Systems already subject to third-party assessment under existing EU law may integrate AI Act requirements.",
    articleReferences: ["Art. 43", "Annex VI", "Annex VII"],
    keywords: ["conformity assessment", "notified body", "internal control", "compliance"],
    category: "conformity",
  },
  {
    id: `${LEGISLATION_ID}-faq-ce-marking`,
    question: "What is the CE marking requirement for AI systems?",
    answer:
      "High-risk AI systems that comply with all applicable requirements must bear the CE marking (Art. 49) to indicate conformity. The marking must be affixed visibly, legibly and indelibly on the AI system or, if not possible, on its packaging or accompanying documentation. The CE marking is subject to the general principles of Regulation (EC) No 765/2008 and signals that the system has undergone the required conformity assessment procedures.",
    articleReferences: ["Art. 49"],
    keywords: ["CE marking", "conformity", "market access", "labelling"],
    category: "conformity",
  },
  {
    id: `${LEGISLATION_ID}-faq-post-market`,
    question: "What is post-market monitoring for AI systems?",
    answer:
      "Post-market monitoring (Art. 72) requires providers to establish a documented system for actively and systematically collecting, documenting and analysing data on the performance of high-risk AI systems throughout their lifetime. The system must be proportionate to the nature and risks of the AI system. Data may come from deployers or other sources. The goal is to evaluate continuous compliance with requirements and take corrective action when needed.",
    articleReferences: ["Art. 72", "Art. 73"],
    keywords: ["post-market monitoring", "lifecycle", "continuous compliance", "incidents"],
    category: "obligations",
  },
  {
    id: `${LEGISLATION_ID}-faq-dora-nis2`,
    question: "How does the EU AI Act interact with DORA and NIS2?",
    answer:
      "The EU AI Act complements existing EU legislation including DORA (Digital Operational Resilience Act) and NIS2 (Network and Information Security Directive). For AI systems in the financial sector, DORA requirements for ICT risk management apply alongside AI Act obligations. NIS2 cybersecurity requirements are relevant for AI systems used in critical infrastructure. The AI Act's cybersecurity requirements (Art. 15) should be implemented considering these existing frameworks. Providers and deployers must comply with all applicable regulations simultaneously.",
    articleReferences: ["Art. 15", "Recital 80"],
    keywords: ["DORA", "NIS2", "financial services", "cybersecurity", "interplay"],
    category: "interplay",
  },
  {
    id: `${LEGISLATION_ID}-faq-sme`,
    question: "What special provisions exist for SMEs and startups?",
    answer:
      "The EU AI Act includes several provisions to support SMEs and startups: (1) Proportionate penalty caps where fines are the lower of the fixed amount or percentage of turnover (Art. 99(6)); (2) Regulatory sandboxes providing controlled environments for testing innovative AI systems (Art. 57-62); (3) Priority access for SMEs and startups to regulatory sandboxes; (4) Simplified technical documentation options in certain cases; (5) The AI Office and national authorities must consider SME interests when establishing codes of practice and guidelines.",
    articleReferences: ["Art. 57-62", "Art. 99(6)"],
    keywords: ["SME", "startup", "small business", "proportionate", "sandbox"],
    category: "sme",
  },
  {
    id: `${LEGISLATION_ID}-faq-extraterritorial`,
    question: "Does the EU AI Act have extraterritorial scope?",
    answer:
      "Yes, the EU AI Act applies beyond EU borders in certain cases. It applies to: (1) providers placing AI systems on the EU market or putting them into service in the EU, regardless of where they are established; (2) providers and deployers located in third countries where the output produced by the AI system is used in the EU; (3) importers and distributors of AI systems. This mirrors the approach of the GDPR in ensuring that EU rules apply whenever EU residents are affected.",
    articleReferences: ["Art. 2"],
    keywords: ["extraterritorial", "scope", "third country", "international", "GDPR"],
    category: "scope",
  },
  {
    id: `${LEGISLATION_ID}-faq-open-source`,
    question: "Are there exceptions for open-source AI models?",
    answer:
      "The EU AI Act provides limited exemptions for open-source AI models. GPAI models made available under a free and open-source licence with publicly available model parameters, architecture and weights are exempt from certain obligations like technical documentation and downstream provider information (Art. 53(2)). However, these exemptions do not apply if the model is classified as posing systemic risk. High-risk AI system obligations still apply to open-source systems classified as high-risk.",
    articleReferences: ["Art. 53(2)", "Art. 55"],
    keywords: ["open source", "free software", "exemption", "GPAI", "licence"],
    category: "gpai",
  },
  {
    id: `${LEGISLATION_ID}-faq-nca`,
    question: "What are national competent authorities under the EU AI Act?",
    answer:
      "Each Member State must designate at least one notifying authority and one market surveillance authority as national competent authorities (Art. 70). The market surveillance authority acts as the main enforcement body at national level. Member States may also designate or establish a national single point of contact to coordinate AI Act implementation. These authorities supervise compliance, conduct market surveillance, handle complaints, and impose penalties for infringements.",
    articleReferences: ["Art. 70", "Art. 74"],
    keywords: ["national authority", "competent authority", "market surveillance", "enforcement"],
    category: "governance",
  },
  {
    id: `${LEGISLATION_ID}-faq-ai-office`,
    question: "What is the AI Office?",
    answer:
      "The AI Office is established within the European Commission (Art. 64) to support the implementation and enforcement of the EU AI Act. It has exclusive competence for supervising GPAI model providers, develops guidelines and codes of practice, coordinates between national authorities, provides technical expertise, and manages the EU database for high-risk AI systems. The AI Office plays a central role in ensuring harmonised application of the regulation across Member States.",
    articleReferences: ["Art. 64", "Art. 65"],
    keywords: ["AI Office", "Commission", "governance", "supervision", "GPAI"],
    category: "governance",
  },
  {
    id: `${LEGISLATION_ID}-faq-sandboxes`,
    question: "What are AI regulatory sandboxes?",
    answer:
      "AI regulatory sandboxes (Art. 57-62) are controlled environments set up by national competent authorities or the European Data Protection Supervisor to enable the development, testing and validation of innovative AI systems under regulatory oversight before placement on the market. They provide legal certainty and facilitate learning for authorities. Member States must establish at least one sandbox by 2 August 2026. SMEs and startups have priority access. Sandboxes must ensure that participants' rights are protected and that personal data processing complies with applicable law.",
    articleReferences: ["Art. 57", "Art. 58", "Art. 59"],
    keywords: ["sandbox", "regulatory sandbox", "innovation", "testing", "controlled environment"],
    category: "sandbox",
  },
  {
    id: `${LEGISLATION_ID}-faq-codes-of-practice`,
    question: "What are codes of practice for GPAI?",
    answer:
      "Codes of practice (Art. 56) are developed to facilitate GPAI model providers' compliance with their obligations. The AI Office encourages and facilitates the drafting of codes of practice at Union level, with participation from GPAI providers, relevant national competent authorities, civil society organisations, and other stakeholders. Codes should cover transparency obligations, copyright policy, and for systemic risk models, risk identification and mitigation measures. Compliance with approved codes of practice creates a presumption of conformity with the corresponding obligations.",
    articleReferences: ["Art. 56"],
    keywords: ["codes of practice", "GPAI", "self-regulation", "guidelines", "compliance"],
    category: "gpai",
  },
];

export async function seedFaq(db: Database, embed: EmbeddingFn) {
  console.log("Seeding FAQ...");

  const textsToEmbed = faqData.map(
    (f) => `${f.question} ${f.answer}`,
  );
  const embeddings = await embed(textsToEmbed);

  for (let i = 0; i < faqData.length; i++) {
    const f = faqData[i];
    await db
      .insert(faq)
      .values({
        id: f.id,
        legislationId: LEGISLATION_ID,
        question: f.question,
        answer: f.answer,
        articleReferences: f.articleReferences,
        keywords: f.keywords,
        category: f.category,
        embedding: embeddings[i],
      })
      .onConflictDoUpdate({
        target: faq.id,
        set: {
          question: f.question,
          answer: f.answer,
          articleReferences: f.articleReferences,
          keywords: f.keywords,
          category: f.category,
          embedding: embeddings[i],
        },
      });
  }

  console.log(`Seeded ${faqData.length} FAQ entries.`);
}
