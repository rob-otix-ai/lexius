import { riskCategories } from "../../schema/index.js";
import type { Database } from "../../index.js";
import type { EmbeddingFn } from "../run.js";
import { curatedSeedProvenance } from "../helpers/index.js";

const LEGISLATION_ID = "dora";

const riskCategoryData = [
  {
    id: `${LEGISLATION_ID}-risk-full-framework`,
    name: "full-framework",
    level: 4,
    description:
      "Standard financial entity subject to the full DORA ICT Risk Management Framework under Articles 5-23 (governance, RMF, incident management) and Articles 24-30 (resilience testing and third-party risk). Applies to credit institutions, investment firms, insurance undertakings, CCPs, CSDs, trading venues, and other in-scope financial entities that do not qualify for the simplified regime.",
    keywords: [
      "credit institution",
      "bank",
      "investment firm",
      "insurance undertaking",
      "reinsurance",
      "central counterparty",
      "CCP",
      "central securities depository",
      "CSD",
      "trading venue",
      "payment institution",
      "electronic money institution",
      "crypto-asset service provider",
      "CASP",
      "MiCA",
      "crowdfunding service provider",
      "credit rating agency",
      "administrator of critical benchmarks",
      "AIFM",
      "UCITS management company",
    ],
    examples: [
      "Credit institutions authorised under CRD",
      "Investment firms authorised under MiFID II that are not classified as small and non-interconnected",
      "Insurance and reinsurance undertakings under Solvency II",
      "Central counterparties (CCPs) under EMIR",
      "Central securities depositories (CSDs) under CSDR",
      "Trading venues (regulated markets, MTFs, OTFs)",
      "Crypto-asset service providers authorised under MiCA",
      "Data reporting service providers (APAs, ARMs, CTPs)",
      "Managers of alternative investment funds (AIFMs)",
      "UCITS management companies",
      "Credit rating agencies under the CRA Regulation",
    ],
    relevantArticles: [
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "17",
      "18",
      "19",
      "24",
      "25",
      "26",
      "28",
      "29",
      "30",
    ],
  },
  {
    id: `${LEGISLATION_ID}-risk-simplified-framework`,
    name: "simplified-framework",
    level: 2,
    description:
      "Microenterprise or small and non-interconnected entity covered by the simplified ICT risk management regime under Article 16. Covers small and non-interconnected investment firms, PSD2-exempted payment institutions, EMD2-exempted e-money institutions, and small IORPs. Obligations still include governance oversight and basic ICT risk management, but at reduced intensity proportionate to size and risk profile.",
    keywords: [
      "microenterprise",
      "small and non-interconnected investment firm",
      "small IORP",
      "exempted payment institution",
      "exempted electronic money institution",
      "simplified regime",
      "proportionality",
      "Article 16",
    ],
    examples: [
      "Microenterprises (fewer than 10 staff and annual turnover or balance sheet below EUR 2 million) that are financial entities",
      "Small and non-interconnected investment firms under IFR/IFD Class 3",
      "Payment institutions exempted under Article 32 of PSD2",
      "Electronic money institutions exempted under Article 9 of EMD2",
      "Institutions for occupational retirement provision (IORPs) with fewer than 100 members",
    ],
    relevantArticles: ["4", "16"],
  },
  {
    id: `${LEGISLATION_ID}-risk-ctpp`,
    name: "ctpp",
    level: 5,
    description:
      "Critical ICT Third-Party Service Provider designated under Article 31 and subject to the Union-level Oversight Framework led by the Lead Overseer (EBA, EIOPA or ESMA). CTPPs must cooperate with the Lead Overseer, comply with recommendations, pay oversight fees, and may be subject to periodic penalty payments of up to 1% of daily average worldwide turnover for up to six months.",
    keywords: [
      "critical ICT third-party service provider",
      "CTPP",
      "lead overseer",
      "oversight framework",
      "cloud service provider",
      "hyperscaler",
      "systemic provider",
      "Article 31",
      "Article 35",
    ],
    examples: [
      "Major cloud infrastructure providers (IaaS) designated as critical",
      "Hyperscale cloud platforms (PaaS/SaaS) designated by the ESAs Joint Committee",
      "Shared data processing centres used widely across the financial sector",
      "Core banking system vendors with systemic reach",
      "Market data and connectivity providers designated as critical",
    ],
    relevantArticles: ["28", "29", "30", "31", "35"],
  },
  {
    id: `${LEGISLATION_ID}-risk-out-of-scope`,
    name: "out-of-scope",
    level: 0,
    description:
      "Entity not covered by DORA under Article 2. DORA does not impose direct obligations on these entities, although they may still be affected indirectly as ICT third-party service providers to financial entities or through other regulatory frameworks such as NIS2.",
    keywords: [
      "out of scope",
      "not covered",
      "Article 2 exemption",
      "NIS2 only",
      "non-financial entity",
    ],
    examples: [
      "Managers of alternative investment funds below AIFMD thresholds (not registered)",
      "Very small IORPs operating pension schemes with fewer than 15 members in total",
      "Natural persons (clients, individual consumers)",
      "Non-financial undertakings outside the scope of Article 2",
      "Post-office giro institutions excluded under Article 2(3)",
    ],
    relevantArticles: ["2"],
  },
];

export async function seedRiskCategories(
  db: Database,
  embed: EmbeddingFn,
) {
  console.log("Seeding risk categories...");

  const textsToEmbed = riskCategoryData.map(
    (r) => `${r.name}: ${r.description}`,
  );
  const embeddings = await embed(textsToEmbed);

  for (let i = 0; i < riskCategoryData.length; i++) {
    const r = riskCategoryData[i];
    await db
      .insert(riskCategories)
      .values({
        ...r,
        legislationId: LEGISLATION_ID,
        embedding: embeddings[i],
        ...curatedSeedProvenance(),
      })
      .onConflictDoUpdate({
        target: riskCategories.id,
        set: {
          name: r.name,
          level: r.level,
          description: r.description,
          keywords: r.keywords,
          examples: r.examples,
          relevantArticles: r.relevantArticles,
          embedding: embeddings[i],
          ...curatedSeedProvenance(),
        },
      });
  }

  console.log(`Seeded ${riskCategoryData.length} risk categories.`);
}
