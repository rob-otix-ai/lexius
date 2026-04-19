import { legislations } from "../schema/index.js";
import type { Database } from "../index.js";

const cimaLegislations = [
  {
    id: "cima-monetary-authority",
    name: "Monetary Authority Act (2020 Revision)",
    jurisdiction: "KY",
    effectiveDate: new Date("2020-01-14"),
    sourceUrl: "https://www.cima.ky/upimages/lawsregulations/MonetaryAuthorityLaw2020Revision_1579789069_1599483258.pdf",
    version: "2020",
  },
  {
    id: "cima-banks-trust",
    name: "Banks and Trust Companies Act (2025 Revision)",
    jurisdiction: "KY",
    effectiveDate: new Date("2025-02-07"),
    sourceUrl: "https://www.cima.ky/upimages/lawsregulations/BanksandTrustCompaniesAct2025Revision_1738876804.pdf",
    version: "2025",
  },
  {
    id: "cima-mutual-funds",
    name: "Mutual Funds Act (2025 Revision)",
    jurisdiction: "KY",
    effectiveDate: new Date("2025-02-11"),
    sourceUrl: "https://www.cima.ky/upimages/lawsregulations/MutualFundsAct2025Revision_1739307105.pdf",
    version: "2025",
  },
  {
    id: "cima-private-funds",
    name: "Private Funds Act (2025 Revision)",
    jurisdiction: "KY",
    effectiveDate: new Date("2025-02-11"),
    sourceUrl: "https://www.cima.ky/upimages/lawsregulations/PrivateFundsAct2025Revision_1739307005.pdf",
    version: "2025",
  },
  {
    id: "cima-securities",
    name: "Securities Investment Business Act (2020 Revision)",
    jurisdiction: "KY",
    effectiveDate: new Date("2020-01-23"),
    sourceUrl: "https://www.cima.ky/upimages/lawsregulations/1579810300SecuritiesInvestmentBusinessLaw2020Revision_1579810300_1599485102.pdf",
    version: "2020",
  },
  {
    id: "cima-insurance",
    name: "Insurance Act (2010)",
    jurisdiction: "KY",
    effectiveDate: new Date("2010-11-01"),
    sourceUrl: "https://www.cima.ky/upimages/lawsregulations/1499345418InsuranceLaw2010_1599481339.pdf",
    version: "2010",
  },
  {
    id: "cima-aml",
    name: "Anti-Money Laundering Regulations (2025 Revision)",
    jurisdiction: "KY",
    effectiveDate: new Date("2025-02-06"),
    sourceUrl: "https://www.cima.ky/upimages/lawsregulations/Anti-MoneyLaunderingRegulations2025Revision,LG6,S1_1738770781.pdf",
    version: "2025",
  },
  {
    id: "cima-vasp",
    name: "Virtual Asset (Service Providers) Act (2024 Revision)",
    jurisdiction: "KY",
    effectiveDate: new Date("2024-05-22"),
    sourceUrl: "https://www.cima.ky/upimages/lawsregulations/VirtualAssetServiceProvidersAct2024Revision_1716397271.pdf",
    version: "2024",
  },
  {
    id: "cima-proceeds-crime",
    name: "Proceeds of Crime Act (2024 Revision)",
    jurisdiction: "KY",
    effectiveDate: new Date("2024-04-24"),
    sourceUrl: "https://www.cima.ky/upimages/lawsregulations/ProceedsofCrimeAct_2024Revision_1713968966.pdf",
    version: "2024",
  },
  {
    id: "cima-beneficial-ownership",
    name: "Beneficial Ownership Transparency Act (2023)",
    jurisdiction: "KY",
    effectiveDate: new Date("2023-01-17"),
    sourceUrl: "https://www.cima.ky/upimages/lawsregulations/BeneficialOwnershipTransparencyAct,2023_1705419742.pdf",
    version: "2023",
  },
];

export async function seedCimaLegislations(db: Database) {
  console.log("Seeding CIMA legislations...");

  for (const leg of cimaLegislations) {
    await db
      .insert(legislations)
      .values(leg)
      .onConflictDoUpdate({
        target: legislations.id,
        set: {
          name: leg.name,
          jurisdiction: leg.jurisdiction,
          effectiveDate: leg.effectiveDate,
          sourceUrl: leg.sourceUrl,
          version: leg.version,
        },
      });
  }

  console.log(`Seeded ${cimaLegislations.length} CIMA legislations.`);
}
