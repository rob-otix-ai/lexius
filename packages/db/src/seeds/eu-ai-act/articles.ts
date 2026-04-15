import { articles } from "../../schema/index.js";
import type { Database } from "../../index.js";
import type { EmbeddingFn } from "../run.js";

const LEGISLATION_ID = "eu-ai-act";
const BASE_URL =
  "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689";

const articleData = [
  {
    number: "3",
    title: "Definitions",
    summary:
      "Defines key terms used throughout the regulation including 'AI system', 'provider', 'deployer', 'operator', 'risk', and 'substantial modification'. Establishes a common vocabulary aligned with international standards, particularly the OECD definition of AI systems. These definitions are foundational for determining scope and applicability of obligations.",
  },
  {
    number: "4",
    title: "AI Literacy",
    summary:
      "Requires providers and deployers to ensure sufficient AI literacy among their staff and other persons dealing with AI systems on their behalf. Measures should account for the technical knowledge, experience, education and training of staff, as well as the context of use. This is a universal obligation applicable regardless of risk classification.",
  },
  {
    number: "5",
    title: "Prohibited AI Practices",
    summary:
      "Prohibits AI practices that pose unacceptable risks, including subliminal manipulation, exploitation of vulnerabilities, social scoring by public authorities, real-time remote biometric identification for law enforcement (with exceptions), emotion recognition in workplaces and schools, untargeted scraping of facial images, and biometric categorisation for inferring sensitive attributes. Violations carry the highest penalties.",
  },
  {
    number: "6",
    title: "Classification Rules for High-Risk AI Systems",
    summary:
      "Establishes the criteria for classifying AI systems as high-risk. An AI system is high-risk if it is a safety component of or itself a product covered by Union harmonisation legislation (Annex I), or falls within use cases listed in Annex III. Article 6(3) provides an exception where Annex III systems are not high-risk if they do not pose significant risk of harm.",
  },
  {
    number: "9",
    title: "Risk Management System",
    summary:
      "Mandates a continuous, iterative risk management system for high-risk AI systems throughout their lifecycle. Requires identification and analysis of known and foreseeable risks, estimation and evaluation of risks, and adoption of risk management measures. Testing must be performed to find the most appropriate measures, and residual risks must be communicated to deployers.",
  },
  {
    number: "10",
    title: "Data and Data Governance",
    summary:
      "Sets requirements for training, validation and testing data used in high-risk AI systems. Data governance must cover design choices, data collection processes, data preparation, formulation of assumptions, assessment of availability and suitability, and examination of biases. Data sets must be relevant, sufficiently representative, and as free of errors as possible.",
  },
  {
    number: "11",
    title: "Technical Documentation",
    summary:
      "Requires high-risk AI system providers to draw up technical documentation before placing the system on the market or putting it into service. Documentation must demonstrate compliance with requirements and provide authorities with necessary information for assessment. It must be kept up to date and include elements specified in Annex IV.",
  },
  {
    number: "12",
    title: "Record-Keeping",
    summary:
      "Requires high-risk AI systems to be designed with automatic logging capabilities. Logs must enable monitoring of the system's operation and ensure traceability of its functioning throughout its lifecycle. Logging must cover the period of intended use and include relevant data for post-market monitoring and incident investigation.",
  },
  {
    number: "13",
    title: "Transparency and Provision of Information to Deployers",
    summary:
      "High-risk AI systems must be designed and developed to ensure their operation is sufficiently transparent to enable deployers to interpret outputs and use them appropriately. Instructions for use must include provider details, system characteristics, performance metrics, and known limitations. Information must enable deployers to comply with their own obligations.",
  },
  {
    number: "14",
    title: "Human Oversight",
    summary:
      "High-risk AI systems must be designed to allow effective human oversight during their period of use. Oversight measures must enable human overseers to understand system capabilities and limitations, monitor operation, interpret outputs, decide not to use or override the system, and intervene or interrupt operation. The level of oversight must be commensurate with risks.",
  },
  {
    number: "15",
    title: "Accuracy, Robustness and Cybersecurity",
    summary:
      "High-risk AI systems must achieve appropriate levels of accuracy, robustness and cybersecurity throughout their lifecycle. Accuracy levels must be declared in instructions for use. Systems must be resilient against errors, faults, inconsistencies, and adversarial attacks. Technical redundancy and fail-safe measures may be required.",
  },
  {
    number: "16",
    title: "Obligations of Providers of High-Risk AI Systems",
    summary:
      "Establishes comprehensive obligations for providers including ensuring compliance with requirements, implementing a quality management system, drawing up technical documentation, keeping logs, ensuring conformity assessment, registering in the EU database, taking corrective actions, affixing CE marking, and demonstrating conformity upon request. Providers must designate an authorised representative for systems from third countries.",
  },
  {
    number: "17",
    title: "Quality Management System",
    summary:
      "Requires providers of high-risk AI systems to implement a quality management system (QMS) covering policies for regulatory compliance, design and development techniques, data management, risk management, post-market monitoring, incident reporting, communication with authorities, record-keeping, resource management, and an accountability framework. The QMS must be proportionate to the organisation's size.",
  },
  {
    number: "26",
    title: "Obligations of Deployers of High-Risk AI Systems",
    summary:
      "Deployers must use high-risk AI systems in accordance with instructions, assign human oversight to competent persons, ensure input data is relevant, monitor operation, keep logs, conduct fundamental rights impact assessments where required, inform affected persons, and cooperate with authorities. Deployers who substantially modify a system become providers.",
  },
  {
    number: "27",
    title: "Fundamental Rights Impact Assessment for High-Risk AI Systems",
    summary:
      "Requires deployers that are bodies governed by public law or private entities providing public services, as well as deployers of certain high-risk systems, to perform a fundamental rights impact assessment (FRIA) before deployment. The FRIA must describe the deployer's processes, the period and frequency of use, categories of affected persons, specific risks, and human oversight measures.",
  },
  {
    number: "43",
    title: "Conformity Assessment",
    summary:
      "Establishes conformity assessment procedures for high-risk AI systems. Providers must follow procedures based on internal control (Annex VI) or involving a notified body (Annex VII) depending on the system type. Systems already subject to third-party conformity assessment under existing Union legislation may integrate AI Act requirements into that process.",
  },
  {
    number: "47",
    title: "EU Declaration of Conformity",
    summary:
      "Requires providers to draw up an EU declaration of conformity for each high-risk AI system, stating that the system meets the requirements. The declaration must contain information set out in Annex V, be translated into required languages, and kept up to date. It must be made available to national authorities upon request and kept for 10 years.",
  },
  {
    number: "49",
    title: "CE Marking",
    summary:
      "High-risk AI systems must bear the CE marking to indicate conformity. The CE marking must be affixed visibly, legibly and indelibly, or if not possible, on the packaging or accompanying documentation. The marking is subject to the general principles set out in Regulation (EC) No 765/2008.",
  },
  {
    number: "50",
    title: "Transparency Obligations for Certain AI Systems",
    summary:
      "Providers of AI systems intended to interact directly with persons must ensure the system discloses that the person is interacting with AI. Providers generating synthetic content must mark outputs as artificially generated in a machine-readable format. Deployers of emotion recognition or biometric categorisation systems must inform exposed persons. Deployers of deepfake systems must disclose the artificial nature of content.",
  },
  {
    number: "51",
    title: "Classification of General-Purpose AI Models as Systemic Risk",
    summary:
      "Establishes criteria for classifying general-purpose AI (GPAI) models as posing systemic risk based on high-impact capabilities evaluated through technical tools, benchmarks, or cumulative compute exceeding 10^25 FLOP. The Commission may update thresholds and criteria through delegated acts. Providers may present arguments that despite meeting thresholds, a model does not pose systemic risk.",
  },
  {
    number: "53",
    title: "Obligations for Providers of General-Purpose AI Models",
    summary:
      "GPAI model providers must draw up technical documentation, provide information and documentation to downstream providers, establish copyright policy, and publish a training content summary. Open-source models with publicly available parameters are exempt from some obligations unless they pose systemic risk. Compliance can be demonstrated through codes of practice.",
  },
  {
    number: "55",
    title:
      "Obligations for Providers of GPAI Models with Systemic Risk",
    summary:
      "Providers of GPAI models with systemic risk must additionally perform model evaluations including adversarial testing, assess and mitigate systemic risks, track and report serious incidents, and ensure adequate cybersecurity protections. They must engage with the AI Office and contribute to codes of practice addressing these additional obligations.",
  },
  {
    number: "72",
    title: "Post-Market Monitoring by Providers",
    summary:
      "Requires providers to establish and document a post-market monitoring system proportionate to the nature and risks of the AI system. The system must actively and systematically collect, document and analyse data provided by deployers or collected through other sources throughout the system's lifetime to evaluate continuous compliance with requirements.",
  },
  {
    number: "73",
    title: "Reporting of Serious Incidents",
    summary:
      "Providers of high-risk AI systems must report any serious incident to the market surveillance authorities of the Member States where the incident occurred. Reporting must occur immediately and no later than 15 days after becoming aware. The report must include information about the system, the incident, corrective measures, and must be followed by a final report within a specified timeframe.",
  },
  {
    number: "99",
    title: "Penalties",
    summary:
      "Establishes the penalty framework for infringements. Prohibited AI practices may incur fines up to EUR 35 million or 7% of worldwide annual turnover. High-risk system violations may incur fines up to EUR 15 million or 3%. Supplying false information may incur fines up to EUR 10 million or 2%. SMEs and startups benefit from proportionate penalty caps per Article 99(6).",
  },
  {
    number: "100",
    title: "Fines for Union Institutions, Bodies, Offices and Agencies",
    summary:
      "Establishes that the European Data Protection Supervisor (EDPS) may impose fines on Union institutions, agencies and bodies that infringe the regulation. Penalty levels mirror those for private operators but are applied to EU institutional budgets. The EDPS must take into account similar considerations as those for national authorities.",
  },
  {
    number: "113",
    title: "Entry into Force and Application",
    summary:
      "The regulation enters into force on 1 August 2024. Prohibitions apply from 2 February 2025. GPAI rules and governance provisions apply from 2 August 2025. Main high-risk system obligations apply from 2 August 2026. Requirements for high-risk systems in Annex I products apply from 2 August 2027. Provides a phased approach to allow stakeholders to prepare.",
  },
];

export async function seedArticles(db: Database, embed: EmbeddingFn) {
  console.log("Seeding articles...");

  const textsToEmbed = articleData.map((a) => `${a.title}. ${a.summary}`);
  const embeddings = await embed(textsToEmbed);

  for (let i = 0; i < articleData.length; i++) {
    const a = articleData[i];
    await db
      .insert(articles)
      .values({
        id: `${LEGISLATION_ID}-art-${a.number}`,
        legislationId: LEGISLATION_ID,
        number: a.number,
        title: a.title,
        summary: a.summary,
        fullText: a.summary,
        sourceUrl: `${BASE_URL}#art_${a.number}`,
        embedding: embeddings[i],
      })
      .onConflictDoUpdate({
        target: articles.id,
        set: {
          title: a.title,
          summary: a.summary,
          fullText: a.summary,
          sourceUrl: `${BASE_URL}#art_${a.number}`,
          embedding: embeddings[i],
        },
      });
  }

  console.log(`Seeded ${articleData.length} articles.`);
}
