export interface RegistryEntry {
  id: string;
  name: string;
  url: string;
  effectiveDate: string;
  jurisdiction: string;
  sectionPrefix: string;
}

export const CIMA_REGISTRY: RegistryEntry[] = [
  {
    id: "cima-monetary-authority",
    name: "Monetary Authority Act (2020 Revision)",
    url: "https://www.cima.ky/upimages/lawsregulations/MonetaryAuthorityLaw2020Revision_1579789069_1599483258.pdf",
    effectiveDate: "2020-01-14",
    jurisdiction: "KY",
    sectionPrefix: "s",
  },
  {
    id: "cima-banks-trust",
    name: "Banks and Trust Companies Act (2025 Revision)",
    url: "https://www.cima.ky/upimages/lawsregulations/BanksandTrustCompaniesAct2025Revision_1738876804.pdf",
    effectiveDate: "2025-02-07",
    jurisdiction: "KY",
    sectionPrefix: "s",
  },
  {
    id: "cima-mutual-funds",
    name: "Mutual Funds Act (2025 Revision)",
    url: "https://www.cima.ky/upimages/lawsregulations/MutualFundsAct2025Revision_1739307105.pdf",
    effectiveDate: "2025-02-11",
    jurisdiction: "KY",
    sectionPrefix: "s",
  },
  {
    id: "cima-private-funds",
    name: "Private Funds Act (2025 Revision)",
    url: "https://www.cima.ky/upimages/lawsregulations/PrivateFundsAct2025Revision_1739307005.pdf",
    effectiveDate: "2025-02-11",
    jurisdiction: "KY",
    sectionPrefix: "s",
  },
  {
    id: "cima-securities",
    name: "Securities Investment Business Act (2020 Revision)",
    url: "https://www.cima.ky/upimages/lawsregulations/1579810300SecuritiesInvestmentBusinessLaw2020Revision_1579810300_1599485102.pdf",
    effectiveDate: "2020-01-23",
    jurisdiction: "KY",
    sectionPrefix: "s",
  },
  {
    id: "cima-insurance",
    name: "Insurance Act (2010)",
    url: "https://www.cima.ky/upimages/lawsregulations/1499345418InsuranceLaw2010_1599481339.pdf",
    effectiveDate: "2010-11-01",
    jurisdiction: "KY",
    sectionPrefix: "s",
  },
  {
    id: "cima-aml",
    name: "Anti-Money Laundering Regulations (2025 Revision)",
    url: "https://www.cima.ky/upimages/lawsregulations/Anti-MoneyLaunderingRegulations2025Revision,LG6,S1_1738770781.pdf",
    effectiveDate: "2025-02-06",
    jurisdiction: "KY",
    sectionPrefix: "s",
  },
  {
    id: "cima-vasp",
    name: "Virtual Asset (Service Providers) Act (2024 Revision)",
    url: "https://www.cima.ky/upimages/lawsregulations/VirtualAssetServiceProvidersAct2024Revision_1716397271.pdf",
    effectiveDate: "2024-05-22",
    jurisdiction: "KY",
    sectionPrefix: "s",
  },
  {
    id: "cima-proceeds-crime",
    name: "Proceeds of Crime Act (2024 Revision)",
    url: "https://www.cima.ky/upimages/lawsregulations/ProceedsofCrimeAct_2024Revision_1713968966.pdf",
    effectiveDate: "2024-04-24",
    jurisdiction: "KY",
    sectionPrefix: "s",
  },
  {
    id: "cima-beneficial-ownership",
    name: "Beneficial Ownership Transparency Act (2023)",
    url: "https://www.cima.ky/upimages/lawsregulations/BeneficialOwnershipTransparencyAct,2023_1705419742.pdf",
    effectiveDate: "2023-01-17",
    jurisdiction: "KY",
    sectionPrefix: "s",
  },
];

export function getCimaEntry(legislationId: string): RegistryEntry | undefined {
  return CIMA_REGISTRY.find((e) => e.id === legislationId);
}
