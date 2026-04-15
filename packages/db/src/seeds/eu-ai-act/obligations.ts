import { obligations } from "../../schema/index.js";
import type { Database } from "../../index.js";
import type { EmbeddingFn } from "../run.js";

const LEGISLATION_ID = "eu-ai-act";

const obligationData = [
  // Provider high-risk obligations
  {
    id: `${LEGISLATION_ID}-obl-provider-hr-risk-mgmt`,
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Establish and maintain a risk management system",
    article: "Art. 9",
    details:
      "Implement a continuous, iterative risk management process throughout the AI system lifecycle. Identify, analyse, estimate and evaluate known and foreseeable risks. Adopt appropriate risk management measures and test for the most suitable approaches. Communicate residual risks to deployers.",
    category: "risk-management",
  },
  {
    id: `${LEGISLATION_ID}-obl-provider-hr-data-gov`,
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Ensure data and data governance",
    article: "Art. 10",
    details:
      "Training, validation and testing datasets must be subject to appropriate data governance and management practices. Ensure data relevance, representativeness, accuracy, completeness, and examination for possible biases. Apply appropriate statistical properties for the intended purpose.",
    category: "data-governance",
  },
  {
    id: `${LEGISLATION_ID}-obl-provider-hr-tech-doc`,
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Draw up technical documentation",
    article: "Art. 11",
    details:
      "Prepare technical documentation before the system is placed on the market or put into service. Documentation must demonstrate compliance with requirements, provide authorities with information for assessment, and include elements specified in Annex IV. Keep documentation up to date.",
    category: "documentation",
  },
  {
    id: `${LEGISLATION_ID}-obl-provider-hr-record-keeping`,
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Ensure automatic record-keeping (logging)",
    article: "Art. 12",
    details:
      "Design and develop high-risk AI systems with automatic logging capabilities to ensure traceability of functioning. Logs must cover the period of intended use and enable monitoring of system operation throughout its lifecycle.",
    category: "record-keeping",
  },
  {
    id: `${LEGISLATION_ID}-obl-provider-hr-transparency`,
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Ensure transparency and provide information to deployers",
    article: "Art. 13",
    details:
      "Design systems to be sufficiently transparent for deployers to interpret outputs and use them appropriately. Provide instructions for use including provider details, system characteristics, performance metrics, and known limitations.",
    category: "transparency",
  },
  {
    id: `${LEGISLATION_ID}-obl-provider-hr-human-oversight`,
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Design for human oversight",
    article: "Art. 14",
    details:
      "Design high-risk AI systems to allow effective human oversight during use. Enable human overseers to understand capabilities, monitor operation, interpret outputs, decide not to use or override the system, and intervene or interrupt operation as needed.",
    category: "human-oversight",
  },
  {
    id: `${LEGISLATION_ID}-obl-provider-hr-accuracy`,
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Ensure accuracy, robustness and cybersecurity",
    article: "Art. 15",
    details:
      "Achieve appropriate levels of accuracy, robustness and cybersecurity throughout the system lifecycle. Declare accuracy levels in instructions for use. Ensure resilience against errors, faults, inconsistencies, and adversarial attacks.",
    category: "technical-requirements",
  },
  {
    id: `${LEGISLATION_ID}-obl-provider-hr-qms`,
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Implement a quality management system",
    article: "Art. 16 / Art. 17",
    details:
      "Put in place a quality management system covering regulatory compliance policies, design and development techniques, data management, risk management, post-market monitoring, incident reporting, communication with authorities, record-keeping, resource management, and accountability framework.",
    category: "quality-management",
  },
  {
    id: `${LEGISLATION_ID}-obl-provider-hr-conformity`,
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Undergo conformity assessment",
    article: "Art. 43",
    details:
      "Complete the applicable conformity assessment procedure before placing the system on the market. Follow internal control procedures (Annex VI) or procedures involving a notified body (Annex VII) depending on the system type. Re-assess upon substantial modification.",
    category: "conformity-assessment",
  },
  {
    id: `${LEGISLATION_ID}-obl-provider-hr-declaration`,
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Draw up EU declaration of conformity",
    article: "Art. 47",
    details:
      "Prepare an EU declaration of conformity stating the system meets requirements. Include information set out in Annex V. Translate into required languages, keep up to date, and make available to national authorities upon request for 10 years.",
    category: "conformity-assessment",
  },
  {
    id: `${LEGISLATION_ID}-obl-provider-hr-ce-marking`,
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Affix CE marking",
    article: "Art. 49",
    details:
      "Affix the CE marking to high-risk AI systems to indicate conformity. The marking must be visible, legible and indelible. If not possible on the product, affix on packaging or accompanying documentation.",
    category: "conformity-assessment",
  },
  {
    id: `${LEGISLATION_ID}-obl-provider-hr-registration`,
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Register in the EU database",
    article: "Art. 16(i)",
    details:
      "Register the high-risk AI system in the EU database before placing it on the market or putting it into service. Ensure registration information is kept up to date.",
    category: "registration",
  },
  {
    id: `${LEGISLATION_ID}-obl-provider-hr-post-market`,
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Establish post-market monitoring system",
    article: "Art. 72",
    details:
      "Establish and document a post-market monitoring system proportionate to the nature and risks of the AI system. Actively and systematically collect, document and analyse data to evaluate continuous compliance throughout the system's lifetime.",
    category: "post-market-monitoring",
  },

  {
    id: `${LEGISLATION_ID}-obl-provider-hr-14`,
    role: "provider",
    riskLevel: "high-risk",
    obligation: "Report serious incidents to market surveillance authorities",
    article: "Art. 73",
    deadline: "2026-08-02",
    details:
      "Providers must report any serious incident to the market surveillance authorities of the Member States where the incident occurred, immediately and no later than 15 days after becoming aware of it. The report must include details of the incident, corrective measures taken, and information about the AI system involved.",
    category: "incident-reporting",
  },

  // Deployer high-risk obligations
  {
    id: `${LEGISLATION_ID}-obl-deployer-hr-instructions`,
    role: "deployer",
    riskLevel: "high-risk",
    obligation: "Use in accordance with instructions for use",
    article: "Art. 26(1)",
    details:
      "Use the high-risk AI system in accordance with the instructions for use accompanying the system. Ensure the system is used for its intended purpose and within the conditions specified by the provider.",
    category: "usage",
  },
  {
    id: `${LEGISLATION_ID}-obl-deployer-hr-human-oversight`,
    role: "deployer",
    riskLevel: "high-risk",
    obligation: "Assign human oversight to competent persons",
    article: "Art. 26(2)",
    details:
      "Assign human oversight to natural persons who have the necessary competence, training and authority to carry out that function. Ensure overseers can effectively fulfil their role.",
    category: "human-oversight",
  },
  {
    id: `${LEGISLATION_ID}-obl-deployer-hr-input-data`,
    role: "deployer",
    riskLevel: "high-risk",
    obligation: "Ensure input data relevance",
    article: "Art. 26(4)",
    details:
      "Ensure that input data is relevant and sufficiently representative in view of the intended purpose of the high-risk AI system, to the extent the deployer exercises control over the input data.",
    category: "data-governance",
  },
  {
    id: `${LEGISLATION_ID}-obl-deployer-hr-monitoring`,
    role: "deployer",
    riskLevel: "high-risk",
    obligation: "Monitor operation of the AI system",
    article: "Art. 26(5)",
    details:
      "Monitor the operation of the high-risk AI system on the basis of the instructions for use and inform the provider or distributor of any serious incident or malfunction and interrupt use if necessary.",
    category: "monitoring",
  },
  {
    id: `${LEGISLATION_ID}-obl-deployer-hr-records`,
    role: "deployer",
    riskLevel: "high-risk",
    obligation: "Keep logs generated by the AI system",
    article: "Art. 26(6)",
    details:
      "Keep the logs automatically generated by the high-risk AI system, to the extent such logs are under their control, for a period appropriate to the intended purpose and applicable legal obligations (at least 6 months).",
    category: "record-keeping",
  },
  {
    id: `${LEGISLATION_ID}-obl-deployer-hr-fria`,
    role: "deployer",
    riskLevel: "high-risk",
    obligation: "Conduct fundamental rights impact assessment",
    article: "Art. 27",
    details:
      "Before deploying a high-risk AI system, perform a fundamental rights impact assessment. Describe processes, intended use period and frequency, categories of affected persons, specific risks of harm, human oversight measures, and actions to take if risks materialise. Required for public bodies and certain private entities.",
    category: "impact-assessment",
  },
  {
    id: `${LEGISLATION_ID}-obl-deployer-hr-inform-workers`,
    role: "deployer",
    riskLevel: "high-risk",
    obligation: "Inform workers and their representatives",
    article: "Art. 26(7)",
    details:
      "Inform workers' representatives and affected workers that they will be subject to a high-risk AI system. Provide this information before the system is put into use.",
    category: "transparency",
  },
  {
    id: `${LEGISLATION_ID}-obl-deployer-hr-cooperate`,
    role: "deployer",
    riskLevel: "high-risk",
    obligation: "Cooperate with competent authorities",
    article: "Art. 26(8)",
    details:
      "Cooperate with relevant national competent authorities on any action those authorities take in relation to the high-risk AI system, including providing information and access.",
    category: "cooperation",
  },

  // Limited-risk transparency obligations
  {
    id: `${LEGISLATION_ID}-obl-limited-disclose-ai`,
    role: "provider",
    riskLevel: "limited",
    obligation: "Disclose AI interaction to users",
    article: "Art. 50(1)",
    details:
      "Providers of AI systems intended to interact directly with natural persons must ensure the system is designed and developed so that the person is informed they are interacting with an AI system, unless this is obvious from the circumstances.",
    category: "transparency",
  },
  {
    id: `${LEGISLATION_ID}-obl-limited-label-deepfakes`,
    role: "deployer",
    riskLevel: "limited",
    obligation: "Label deepfake content",
    article: "Art. 50(4)",
    details:
      "Deployers of AI systems that generate or manipulate image, audio or video content constituting a deepfake must disclose that the content has been artificially generated or manipulated. This does not apply where the use is authorised by law for legitimate purposes.",
    category: "transparency",
  },
  {
    id: `${LEGISLATION_ID}-obl-limited-label-text`,
    role: "provider",
    riskLevel: "limited",
    obligation: "Label AI-generated text published for public information",
    article: "Art. 50(3)",
    details:
      "Providers of AI systems generating synthetic audio, image, video or text content must ensure outputs are marked in a machine-readable format as artificially generated or manipulated. Technical solutions must be effective, interoperable, robust and reliable.",
    category: "transparency",
  },
  {
    id: `${LEGISLATION_ID}-obl-limited-label-emotion`,
    role: "deployer",
    riskLevel: "limited",
    obligation: "Inform persons exposed to emotion recognition",
    article: "Art. 50(3)",
    details:
      "Deployers of emotion recognition systems must inform the natural persons exposed to the system of its operation and process personal data in accordance with applicable Union law. This obligation applies in contexts where emotion recognition is not prohibited.",
    category: "transparency",
  },

  // GPAI obligations
  {
    id: `${LEGISLATION_ID}-obl-gpai-tech-doc`,
    role: "provider",
    riskLevel: "gpai",
    obligation: "Draw up and maintain technical documentation",
    article: "Art. 53(1)(a)",
    details:
      "GPAI model providers must draw up and keep up to date technical documentation of the model, including its training and testing process and results of its evaluation, containing at minimum the elements set out in Annex XI.",
    category: "documentation",
  },
  {
    id: `${LEGISLATION_ID}-obl-gpai-downstream-info`,
    role: "provider",
    riskLevel: "gpai",
    obligation:
      "Provide information and documentation to downstream providers",
    article: "Art. 53(1)(b)",
    details:
      "Draw up and make available information and documentation to downstream AI system providers who intend to integrate the GPAI model into their systems, enabling them to understand the model's capabilities and limitations and comply with their obligations.",
    category: "transparency",
  },
  {
    id: `${LEGISLATION_ID}-obl-gpai-copyright`,
    role: "provider",
    riskLevel: "gpai",
    obligation: "Establish copyright compliance policy",
    article: "Art. 53(1)(c)",
    details:
      "Put in place a policy to comply with Union copyright law, in particular to identify and comply with reservations of rights expressed by rights holders pursuant to Article 4(3) of Directive (EU) 2019/790.",
    category: "legal-compliance",
  },
  {
    id: `${LEGISLATION_ID}-obl-gpai-content-summary`,
    role: "provider",
    riskLevel: "gpai",
    obligation: "Publish a training content summary",
    article: "Art. 53(1)(d)",
    details:
      "Draw up and make publicly available a sufficiently detailed summary about the content used for training the GPAI model, according to a template provided by the AI Office.",
    category: "transparency",
  },
  {
    id: `${LEGISLATION_ID}-obl-gpai-systemic-eval`,
    role: "provider",
    riskLevel: "gpai-systemic",
    obligation: "Perform model evaluations for systemic risk",
    article: "Art. 55(1)(a)",
    details:
      "Perform model evaluations in accordance with standardised protocols and tools, including conducting and documenting adversarial testing to identify and mitigate systemic risks.",
    category: "risk-management",
  },
  {
    id: `${LEGISLATION_ID}-obl-gpai-systemic-incidents`,
    role: "provider",
    riskLevel: "gpai-systemic",
    obligation: "Track, document and report serious incidents",
    article: "Art. 55(1)(b)",
    details:
      "Track, document and report to the AI Office and relevant national competent authorities any serious incidents and possible corrective measures without undue delay.",
    category: "incident-reporting",
  },
  {
    id: `${LEGISLATION_ID}-obl-gpai-systemic-cyber`,
    role: "provider",
    riskLevel: "gpai-systemic",
    obligation: "Ensure adequate cybersecurity protection",
    article: "Art. 55(1)(c)",
    details:
      "Ensure an adequate level of cybersecurity protection for the GPAI model with systemic risk and the physical infrastructure of the model.",
    category: "cybersecurity",
  },
  {
    id: `${LEGISLATION_ID}-obl-gpai-systemic-energy`,
    role: "provider",
    riskLevel: "gpai-systemic",
    obligation: "Report energy consumption and efficiency",
    article: "Art. 55(1)(d)",
    details:
      "Document and report information on the energy consumption of the model, including measured or estimated energy used for training, and the computational resources used.",
    category: "reporting",
  },

  // Universal obligation
  {
    id: `${LEGISLATION_ID}-obl-universal-literacy`,
    role: "all",
    riskLevel: "all",
    obligation: "Ensure AI literacy",
    article: "Art. 4",
    details:
      "Providers and deployers of AI systems must take measures to ensure a sufficient level of AI literacy of their staff and other persons dealing with the operation and use of AI systems on their behalf. This universal obligation applies regardless of the risk classification of the AI system.",
    category: "ai-literacy",
  },
];

export async function seedObligations(db: Database, embed: EmbeddingFn) {
  console.log("Seeding obligations...");

  const textsToEmbed = obligationData.map(
    (o) => `${o.role} ${o.riskLevel}: ${o.obligation}. ${o.details}`,
  );
  const embeddings = await embed(textsToEmbed);

  for (let i = 0; i < obligationData.length; i++) {
    const o = obligationData[i];
    await db
      .insert(obligations)
      .values({
        id: o.id,
        legislationId: LEGISLATION_ID,
        role: o.role,
        riskLevel: o.riskLevel,
        obligation: o.obligation,
        article: o.article,
        details: o.details,
        category: o.category,
        embedding: embeddings[i],
      })
      .onConflictDoUpdate({
        target: obligations.id,
        set: {
          role: o.role,
          riskLevel: o.riskLevel,
          obligation: o.obligation,
          article: o.article,
          details: o.details,
          category: o.category,
          embedding: embeddings[i],
        },
      });
  }

  console.log(`Seeded ${obligationData.length} obligations.`);
}
