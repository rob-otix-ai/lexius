import { faq } from "../../schema/index.js";
import type { Database } from "../../index.js";
import type { EmbeddingFn } from "../run.js";
import { articleStringToIds, curatedSeedProvenance } from "../helpers/index.js";
import { ARTICLE_IDS } from "./articles.js";

const LEGISLATION_ID = "dora";

const faqData = [
  {
    id: `${LEGISLATION_ID}-faq-in-scope`,
    question: "Am I in scope of DORA?",
    answer:
      "DORA applies to 20+ categories of financial entities listed in Article 2, including credit institutions, payment institutions, electronic money institutions, investment firms, crypto-asset service providers, insurance and reinsurance undertakings, CCPs, CSDs, trading venues, AIFMs, UCITS management companies, IORPs, credit rating agencies and crowdfunding service providers. It also applies indirectly to ICT third-party service providers through contractual and oversight requirements, with direct obligations on those designated as critical (CTPPs).",
    articleReferences: ["Art. 2"],
    keywords: ["scope", "applicability", "financial entity", "in scope", "covered"],
    category: "scope",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-microenterprise`,
    question: "What is a microenterprise under DORA and what simplified regime applies?",
    answer:
      "Under DORA, a microenterprise is a financial entity that employs fewer than 10 persons and has an annual turnover or balance sheet total not exceeding EUR 2 million (following the Commission Recommendation 2003/361/EC definition). Microenterprises, together with small and non-interconnected investment firms and certain exempted payment and e-money institutions, may apply the simplified ICT risk management framework under Article 16, which reduces the intensity of obligations while preserving core governance, protection, detection, response and testing elements.",
    articleReferences: ["Art. 3(60)", "Art. 16"],
    keywords: ["microenterprise", "simplified framework", "Article 16", "proportionality", "small entity"],
    category: "scope",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-tlpt`,
    question: "Do I need to perform Threat-Led Penetration Testing (TLPT)?",
    answer:
      "TLPT under Articles 26 and 27 is mandatory only for financial entities identified by the competent authority as significant and whose ICT infrastructure supports critical or important functions. Designation is based on criteria including the impact and systemic character of the entity and its risk profile. Identified entities must perform TLPT at least every three years, covering live production systems and all critical or important functions, using testers that meet the strict requirements of Article 27.",
    articleReferences: ["Art. 26", "Art. 27"],
    keywords: ["TLPT", "threat-led penetration testing", "advanced testing", "red team", "TIBER"],
    category: "testing",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-critical-important-function`,
    question: "What qualifies as a Critical or Important Function under DORA?",
    answer:
      "A critical or important function (CIF) is a function whose disruption would materially impair the financial performance of the entity, the soundness or continuity of its services and activities, or its ability to comply with the conditions and obligations of its authorisation. The definition in Article 3(22) is aligned with existing frameworks such as the BRRD and the EBA Guidelines on outsourcing. Functions supporting CIFs are subject to stricter DORA requirements on testing, third-party risk and contractual arrangements.",
    articleReferences: ["Art. 3(22)", "Art. 28", "Art. 30"],
    keywords: ["critical or important function", "CIF", "materiality", "outsourcing"],
    category: "definitions",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-mandatory-clauses`,
    question: "What are the mandatory contract clauses for ICT third-party services?",
    answer:
      "Article 30 requires all ICT third-party contracts to be in writing and contain minimum provisions: clear service descriptions, data processing locations, service levels, accessibility and assistance, cooperation with competent authorities, termination rights and exit strategies. Contracts covering services supporting critical or important functions must additionally include full service descriptions, monitoring and performance reporting, business contingency plans, ICT security standards, staff training, unrestricted audit and inspection rights for the financial entity and competent authorities, and provisions on subcontracting.",
    articleReferences: ["Art. 30"],
    keywords: ["contract", "clauses", "outsourcing", "third-party", "Article 30", "audit rights"],
    category: "third-party-risk",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-major-incident`,
    question: "When does an ICT-related incident count as 'major' under DORA?",
    answer:
      "Under Article 18 and the related RTS, an ICT-related incident is classified as major based on criteria including the number and relevance of affected clients or counterparts, the duration of the incident, geographical spread, data losses (confidentiality, integrity, availability), severity of impact on ICT systems, criticality of the affected services, and economic impact. When the thresholds specified in the RTS are met, the incident must be reported to the competent authority under Article 19.",
    articleReferences: ["Art. 18", "Art. 19"],
    keywords: ["major incident", "classification", "threshold", "reporting", "severity"],
    category: "incident-response",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-register`,
    question: "What is the Register of Information?",
    answer:
      "The Register of Information (Article 28) is a structured inventory of all contractual arrangements between a financial entity and ICT third-party service providers, maintained at entity, sub-consolidated and consolidated levels. It distinguishes contracts supporting critical or important functions from other ICT contracts and records mandatory attributes including provider identification, service description, locations, criticality, dependencies and subcontracting chain. Financial entities must submit their registers annually to their competent authority using the harmonised ITS template.",
    articleReferences: ["Art. 28"],
    keywords: ["register of information", "RoI", "inventory", "ICT contracts", "reporting"],
    category: "third-party-risk",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-dora-nis2`,
    question: "How does DORA interact with NIS2?",
    answer:
      "DORA is treated as lex specialis for the financial sector relative to the NIS2 Directive (EU) 2022/2555. Under NIS2 Article 4, where sector-specific Union legal acts impose cybersecurity risk management or incident reporting requirements at least equivalent to NIS2, those sectoral rules apply instead. For financial entities in scope of DORA, the DORA ICT risk management, incident reporting, testing and third-party risk frameworks therefore take precedence over the equivalent NIS2 obligations, while certain NIS2 elements may still apply where DORA is silent.",
    articleReferences: ["Art. 1", "Art. 2"],
    keywords: ["NIS2", "lex specialis", "sectoral", "cybersecurity directive", "interplay"],
    category: "interplay",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-provider-ctpp`,
    question: "What happens if my ICT provider is designated as a CTPP?",
    answer:
      "If an ICT third-party service provider is designated as critical (CTPP) under Article 31, it becomes subject to direct Union-level oversight by a Lead Overseer (EBA, EIOPA or ESMA). Financial entities using that provider must take designation into account in their ICT risk assessments and, where the CTPP does not endorse recommendations issued by the Lead Overseer, consider the ICT risk implications and potentially revisit the contractual arrangement. CTPP designation does not relieve financial entities of their own DORA obligations.",
    articleReferences: ["Art. 31", "Art. 35"],
    keywords: ["CTPP", "critical provider", "lead overseer", "designation", "oversight framework"],
    category: "third-party-risk",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-intra-group`,
    question: "Does DORA apply to intra-group ICT services?",
    answer:
      "Yes. DORA explicitly covers intra-group ICT services, meaning arrangements where ICT services are provided by another entity of the same group. Such arrangements must be treated as third-party ICT arrangements, included in the Register of Information, subject to due diligence and concentration-risk analysis, and governed by written contracts complying with Article 30. Proportionality may influence the intensity of controls, but the formal obligations apply.",
    articleReferences: ["Art. 28", "Art. 30"],
    keywords: ["intra-group", "group services", "third-party", "internal provider"],
    category: "third-party-risk",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-tiber`,
    question: "Is TIBER-EU mandatory for TLPT under DORA?",
    answer:
      "DORA does not mandate TIBER-EU specifically, but the TLPT requirements in Articles 26 and 27 and the related RTS are closely aligned with the TIBER-EU framework developed by the ECB and the Eurosystem. Many national competent authorities use TIBER-based implementations to operationalise DORA TLPT. Financial entities may rely on TIBER-compliant tests to satisfy DORA TLPT obligations, provided the scope, methodology and tester requirements meet the DORA RTS.",
    articleReferences: ["Art. 26", "Art. 27"],
    keywords: ["TIBER-EU", "TLPT", "red team", "threat intelligence", "ECB"],
    category: "testing",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-penalty-caps`,
    question: "What are the DORA penalty caps?",
    answer:
      "DORA itself does not set harmonised monetary penalty caps for financial entities; it requires Member States to provide for effective, proportionate and dissuasive administrative penalties and remedial measures under Articles 50-52. Member States therefore set the specific fine ceilings in national transposition — commonly referenced as up to EUR 2 million or 2% of total annual worldwide turnover for serious breaches. For CTPPs, the Lead Overseer may impose periodic penalty payments of up to 1% of daily average worldwide turnover per day for up to six months (Article 35).",
    articleReferences: ["Art. 35", "Art. 50", "Art. 51"],
    keywords: ["penalty", "fines", "caps", "sanction", "enforcement"],
    category: "penalties",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-register-update`,
    question: "How often must the Register of Information be updated?",
    answer:
      "The Register of Information must be kept up to date on a continuous basis to reflect new, amended or terminated contractual arrangements, and must be submitted to the competent authority at least once a year in the harmonised ITS format. Material changes — such as new contracts covering critical or important functions, changes in subcontracting chains, or changes in data processing locations — should be reflected without undue delay so that the register remains an accurate basis for supervisory assessments and the CTPP designation exercise.",
    articleReferences: ["Art. 28"],
    keywords: ["register update", "frequency", "annual submission", "RoI"],
    category: "third-party-risk",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-incident-timeline`,
    question: "What is the 24-72-30 hour timeline for incident reporting?",
    answer:
      "The '24-72-30 hour' figure is commonly associated with NIS2 (early warning within 24 hours, incident notification within 72 hours, and final report within one month). DORA does not hard-code these hours; instead Article 20 empowers the ESAs to define the precise timelines for initial, intermediate and final major ICT-related incident reports via RTS/ITS. Financial entities must therefore follow the RTS-defined deadlines for DORA reporting, which are aligned with but distinct from NIS2 timelines.",
    articleReferences: ["Art. 19", "Art. 20"],
    keywords: ["24 hours", "72 hours", "30 days", "timeline", "reporting deadline", "NIS2"],
    category: "incident-response",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-lead-overseer`,
    question: "Who is the Lead Overseer for a CTPP?",
    answer:
      "The Lead Overseer for a CTPP is one of the European Supervisory Authorities (EBA, EIOPA or ESMA) designated by the ESAs Joint Committee when the CTPP is designated under Article 31. The assignment is based on the financial sector that relies most on the CTPP's services. The Lead Overseer is responsible for conducting the oversight activities, issuing recommendations, coordinating with national competent authorities, and where necessary imposing periodic penalty payments under Article 35.",
    articleReferences: ["Art. 31", "Art. 32", "Art. 35"],
    keywords: ["lead overseer", "EBA", "EIOPA", "ESMA", "joint committee", "oversight"],
    category: "oversight",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-significant-cyber-threat`,
    question: "What is a 'significant cyber threat' under DORA?",
    answer:
      "Article 3(18) defines a cyber threat, and a 'significant cyber threat' is one whose technical characteristics indicate that it could result in a major ICT-related incident or a major operational or security payment-related incident. Financial entities may voluntarily notify significant cyber threats to their competent authority under Article 19(2), supporting sector-wide situational awareness and sharing of indicators of compromise and tactics, techniques and procedures.",
    articleReferences: ["Art. 3(18)", "Art. 19(2)"],
    keywords: ["significant cyber threat", "voluntary notification", "TTP", "IoC", "threat intelligence"],
    category: "incident-response",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-casp`,
    question: "Are crypto-asset service providers in scope of DORA?",
    answer:
      "Yes. Crypto-asset service providers (CASPs) authorised under the Markets in Crypto-Assets Regulation (MiCA) and issuers of asset-referenced tokens are included in the list of financial entities under Article 2 of DORA. They must therefore comply with the full ICT risk management, incident reporting, testing and third-party risk frameworks, subject to proportionality. Entities qualifying as microenterprises may apply the simplified framework under Article 16.",
    articleReferences: ["Art. 2"],
    keywords: ["CASP", "crypto-asset service provider", "MiCA", "crypto", "asset-referenced tokens"],
    category: "scope",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-emi`,
    question: "Are electronic money institutions in scope of DORA?",
    answer:
      "Yes. Electronic money institutions authorised under the E-Money Directive (EMD2) are explicitly listed in Article 2 of DORA and are subject to the full framework. E-money institutions that benefit from the EMD2 exemption regime, together with PSD2-exempted payment institutions, may apply the simplified ICT risk management framework under Article 16 provided they meet the relevant size and interconnection thresholds.",
    articleReferences: ["Art. 2", "Art. 16"],
    keywords: ["electronic money institution", "EMI", "EMD2", "payment institution", "PSD2"],
    category: "scope",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-cloud`,
    question: "How does DORA apply to cloud service providers?",
    answer:
      "Cloud service providers are ICT third-party service providers under DORA. Financial entities using cloud services must include them in the Register of Information, conduct due diligence and concentration-risk analysis, and ensure contracts meet Article 30 requirements (including audit rights, termination and exit strategies). Where a cloud provider is designated as a CTPP under Article 31, it becomes directly subject to the Lead Overseer. Cloud-specific RTS further detail controls such as data location, sub-outsourcing and portability requirements.",
    articleReferences: ["Art. 28", "Art. 30", "Art. 31"],
    keywords: ["cloud", "SaaS", "IaaS", "PaaS", "hyperscaler", "AWS", "Azure", "GCP"],
    category: "third-party-risk",
    sourceUrl: null,
  },
  {
    id: `${LEGISLATION_ID}-faq-five-pillars`,
    question: "What are the five pillars of DORA?",
    answer:
      "DORA is typically described as resting on five pillars: (1) ICT Risk Management — Articles 5-15, covering governance, the RMF, protection, detection, response and recovery; (2) ICT-Related Incident Management, Classification and Reporting — Articles 17-23; (3) Digital Operational Resilience Testing — Articles 24-27, including advanced TLPT; (4) Management of ICT Third-Party Risk — Articles 28-30 (entity-level) and Articles 31-44 (Oversight Framework for CTPPs); and (5) Information-Sharing Arrangements on cyber threat intelligence — Article 45.",
    articleReferences: ["Art. 5", "Art. 17", "Art. 24", "Art. 28", "Art. 45"],
    keywords: ["five pillars", "structure", "overview", "framework", "DORA architecture"],
    category: "general",
    sourceUrl: null,
  },
];

export async function seedFaq(db: Database, embed: EmbeddingFn) {
  console.log("Seeding FAQ...");

  const textsToEmbed = faqData.map((f) => `${f.question} ${f.answer}`);
  const embeddings = await embed(textsToEmbed);

  for (let i = 0; i < faqData.length; i++) {
    const f = faqData[i];
    const derivedFrom = articleStringToIds(
      LEGISLATION_ID,
      f.articleReferences,
      ARTICLE_IDS,
    );
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
        sourceUrl: f.sourceUrl,
        derivedFrom,
        embedding: embeddings[i],
        ...curatedSeedProvenance(),
      })
      .onConflictDoUpdate({
        target: faq.id,
        set: {
          question: f.question,
          answer: f.answer,
          articleReferences: f.articleReferences,
          keywords: f.keywords,
          category: f.category,
          sourceUrl: f.sourceUrl,
          derivedFrom,
          embedding: embeddings[i],
          ...curatedSeedProvenance(),
        },
      });
  }

  console.log(`Seeded ${faqData.length} FAQ entries.`);
}
