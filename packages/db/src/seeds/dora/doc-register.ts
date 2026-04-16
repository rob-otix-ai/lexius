import { articles } from "../../schema/index.js";
import type { Database } from "../../index.js";
import type { EmbeddingFn } from "../run.js";
import { curatedSeedProvenance } from "../helpers/index.js";

const LEGISLATION_ID = "dora";
const SOURCE_URL =
  "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2554#art_28";

const docRegisterData = [
  {
    id: "dora-doc-1",
    number: "doc-1",
    title: "ICT service description and function",
    summary:
      "Description of each ICT service provided by the third party, including the nature, scope, and intended business function it supports within the financial entity.",
    fullText:
      "For each contractual arrangement with an ICT third-party service provider, the Register of Information must document a clear description of the ICT service(s) provided, the specific business function or process supported, the type of service (e.g., cloud IaaS/PaaS/SaaS, software licence, managed service, professional service), and whether the service supports a critical or important function. This enables supervisory authorities to understand the entity's reliance on external ICT services.",
    relatedAnnexes: ["RoI"],
  },
  {
    id: "dora-doc-2",
    number: "doc-2",
    title: "ICT service criticality classification",
    summary:
      "Classification of whether the ICT service supports a critical or important function (CIF), with justification of the materiality assessment.",
    fullText:
      "The Register must record whether each ICT service supports a critical or important function (CIF) as defined in Article 3(22). This requires documentation of the materiality assessment, including the impact of a disruption on financial performance, service continuity, and regulatory compliance. CIF-supporting services are subject to stricter contractual, testing and concentration-risk requirements.",
    relatedAnnexes: ["RoI"],
  },
  {
    id: "dora-doc-3",
    number: "doc-3",
    title: "ICT third-party service provider identification",
    summary:
      "Identification details of the ICT third-party service provider including legal name, legal entity identifier (LEI), country of registration and group affiliation.",
    fullText:
      "The Register must contain the identification of each ICT third-party service provider, including legal name, registered office address, country of establishment, legal entity identifier (LEI) where available, parent undertaking and group structure where relevant, and whether the provider is an intra-group entity. This information is essential for the ESAs' critical ICT third-party provider designation exercise.",
    relatedAnnexes: ["RoI"],
  },
  {
    id: "dora-doc-4",
    number: "doc-4",
    title: "Contractual arrangement details",
    summary:
      "Key contractual data including contract reference, start and end dates, renewal mechanism, notice periods, governing law and jurisdiction.",
    fullText:
      "Each entry in the Register must detail the contractual arrangement: contract reference or identifier, execution date, effective start date, contractual end or renewal date, renewal mechanism, notice periods for termination, governing law and jurisdiction, and whether the contract has been amended since execution. This supports supervisory review of contract governance.",
    relatedAnnexes: ["RoI"],
  },
  {
    id: "dora-doc-5",
    number: "doc-5",
    title: "Service performance and availability metrics",
    summary:
      "Service level agreements (SLAs), key performance indicators, availability targets and monitoring reports for the ICT service.",
    fullText:
      "The Register must capture the service levels agreed with the ICT third-party service provider, including availability targets, performance indicators, response and resolution times, and the monitoring and reporting mechanisms used to assess actual performance against those levels. Deviations and remediation actions should also be recorded for CIF-supporting services.",
    relatedAnnexes: ["RoI"],
  },
  {
    id: "dora-doc-6",
    number: "doc-6",
    title: "Geographical location of data and service provision",
    summary:
      "Locations (country, region) where data is stored, processed and where the ICT service is delivered from, including any third-country locations.",
    fullText:
      "The Register must record the geographical locations, at country and, where relevant, regional level, where the ICT service is provided from, where data are stored, and where data are processed. It must flag transfers to third countries and document relevant data-protection safeguards. This information supports concentration-risk analysis and assessment of geopolitical and data-protection risks.",
    relatedAnnexes: ["RoI"],
  },
  {
    id: "dora-doc-7",
    number: "doc-7",
    title: "Dependencies and concentration indicators",
    summary:
      "Indicators of dependency on the provider and concentration at entity and group level, including substitutability analysis.",
    fullText:
      "The Register must include indicators of dependency, including the share of the function covered by the provider, ease of substitution, existence of alternative providers, and group-level or sector-level concentration. It must flag where multiple services are provided by the same or closely connected providers and where the provider's failure could materially impair the financial entity's operations.",
    relatedAnnexes: ["RoI"],
  },
  {
    id: "dora-doc-8",
    number: "doc-8",
    title: "Exit strategy and alternative arrangements",
    summary:
      "Documented exit plan and alternative arrangements ensuring the financial entity can terminate or migrate the service without disruption to critical or important functions.",
    fullText:
      "For ICT services supporting critical or important functions, the Register must record the documented exit strategy, including triggers for invocation, alternative providers identified or to be engaged, data portability arrangements, transition timelines, and testing of the exit plan. Alternative in-house arrangements and contingency measures must also be described where relevant.",
    relatedAnnexes: ["RoI"],
  },
  {
    id: "dora-doc-9",
    number: "doc-9",
    title: "ICT service chain (subcontractors)",
    summary:
      "Identification of subcontractors in the ICT service chain, including those supporting critical or important functions, and the chain of sub-outsourcing.",
    fullText:
      "The Register must document the ICT service chain: identification of subcontractors involved in the provision of the ICT service, the portion of the service they perform, their geographical location, whether they support a critical or important function, and the chain of sub-outsourcing arrangements. Particular attention must be given to sub-outsourcing to third-country providers, which is subject to heightened supervisory scrutiny.",
    relatedAnnexes: ["RoI"],
  },
];

export async function seedDocRegister(db: Database, embed: EmbeddingFn) {
  console.log("Seeding Register of Information fields...");

  const textsToEmbed = docRegisterData.map(
    (d) => `${d.title}. ${d.summary}`,
  );
  const embeddings = await embed(textsToEmbed);

  for (let i = 0; i < docRegisterData.length; i++) {
    const d = docRegisterData[i];
    await db
      .insert(articles)
      .values({
        id: d.id,
        legislationId: LEGISLATION_ID,
        number: d.number,
        title: d.title,
        summary: d.summary,
        fullText: d.fullText,
        sourceUrl: SOURCE_URL,
        relatedAnnexes: d.relatedAnnexes,
        embedding: embeddings[i],
        ...curatedSeedProvenance(),
      })
      .onConflictDoUpdate({
        target: articles.id,
        set: {
          title: d.title,
          summary: d.summary,
          fullText: d.fullText,
          sourceUrl: SOURCE_URL,
          relatedAnnexes: d.relatedAnnexes,
          embedding: embeddings[i],
          ...curatedSeedProvenance(),
        },
      });
  }

  console.log(`Seeded ${docRegisterData.length} Register of Information fields.`);
}
