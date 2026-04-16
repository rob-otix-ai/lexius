import { articles } from "../../schema/index.js";
import type { Database } from "../../index.js";
import type { EmbeddingFn } from "../run.js";
import { curatedSeedProvenance } from "../helpers/index.js";

const LEGISLATION_ID = "dora";
const BASE_URL =
  "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2554";

const articleData = [
  {
    number: "1",
    title: "Subject matter",
    summary:
      "Establishes uniform requirements concerning the security of network and information systems supporting the business processes of financial entities. Sets out harmonised rules on ICT risk management, incident reporting, digital operational resilience testing, information-sharing arrangements, and ICT third-party risk. Creates an oversight framework for Critical ICT Third-Party Service Providers (CTPPs).",
  },
  {
    number: "2",
    title: "Scope",
    summary:
      "Applies to 20+ categories of financial entities (FEs) including credit institutions, payment institutions, investment firms, crypto-asset service providers, central securities depositories, CCPs, trading venues, insurance undertakings, IORPs, credit rating agencies, and crowdfunding service providers. Also covers ICT third-party service providers when designated as critical. Excludes some small IORPs, micro-insurance and post-office giro institutions.",
  },
  {
    number: "3",
    title: "Definitions",
    summary:
      "Defines key DORA terms including 'digital operational resilience', 'ICT-related incident', 'major ICT-related incident', 'significant cyber threat', 'ICT third-party service provider', 'critical or important function', 'microenterprise', and 'ICT service'. These definitions determine scope thresholds, reporting triggers, and proportionality tiers throughout the regulation.",
  },
  {
    number: "4",
    title: "Proportionality principle",
    summary:
      "Requires financial entities to implement DORA rules in a manner proportionate to their size, overall risk profile, and the nature, scale and complexity of their services, activities and operations. Competent authorities must consider proportionality when supervising compliance. Proportionality does not override the specific obligations that apply to each category.",
  },
  {
    number: "5",
    title: "Governance and organisation",
    summary:
      "Requires the management body of the financial entity to define, approve, oversee and be accountable for the implementation of all arrangements related to the ICT risk management framework. Management must maintain knowledge of ICT risk, approve policies, allocate budget, review incident reports, and ensure clear roles and responsibilities for ICT functions. Training on ICT risk is mandatory for members of the management body.",
  },
  {
    number: "6",
    title: "ICT risk management framework",
    summary:
      "Financial entities must have a sound, comprehensive and well-documented ICT risk management framework (RMF) as an integral part of their overall risk management system. The RMF must include strategies, policies, procedures, ICT protocols and tools necessary to protect information and ICT assets. It must be reviewed at least once a year and after major ICT-related incidents.",
  },
  {
    number: "7",
    title: "ICT systems, protocols and tools",
    summary:
      "ICT systems, protocols and tools used by financial entities must be appropriate to the magnitude of operations, reliable, of adequate capacity, technologically resilient, and capable of handling additional information processing needed under stressed conditions. They must keep pace with technological evolution.",
  },
  {
    number: "8",
    title: "Identification",
    summary:
      "Financial entities must identify, classify and adequately document all ICT-supported business functions, roles, responsibilities, information assets and ICT assets. They must identify sources of ICT risk, in particular the risk exposure to and from other financial entities, and perform risk assessments on each major change in network and information systems infrastructure. The inventory must be updated regularly.",
  },
  {
    number: "9",
    title: "Protection and prevention",
    summary:
      "Financial entities must continuously monitor and control the security and functioning of ICT systems and tools, and minimise the impact of ICT risk through appropriate security tools, policies and procedures. This includes ensuring the security of the means of transfer of data, strong authentication, encryption, network segmentation, patch management, and physical security of ICT assets.",
  },
  {
    number: "10",
    title: "Detection",
    summary:
      "Requires mechanisms to promptly detect anomalous activities, including ICT network performance issues and ICT-related incidents, and to identify potential material single points of failure. Detection mechanisms must allow multiple layers of control, define alert thresholds, enable triggering of incident response processes, and provide for automated alerting mechanisms for staff in charge of incident response.",
  },
  {
    number: "11",
    title: "Response and recovery",
    summary:
      "Financial entities must put in place a comprehensive ICT business continuity policy and associated ICT response and recovery plans. These plans must ensure continuity of critical or important functions, restore operations after disruptions, and limit damage. Plans must be tested at least yearly and after substantive infrastructure changes. A crisis communication plan is also required.",
  },
  {
    number: "12",
    title: "Backup policies and procedures, restoration and recovery procedures and methods",
    summary:
      "Financial entities must develop and document backup policies and procedures specifying the scope of data subject to backup and minimum frequency, based on the criticality of information and confidentiality level. Restoration and recovery procedures must be established and periodically tested. Backup systems must be sufficiently segregated from the source ICT systems to avoid compromise.",
  },
  {
    number: "13",
    title: "Learning and evolving",
    summary:
      "Financial entities must have capabilities and staff to gather information on vulnerabilities and cyber threats, and on ICT-related incidents, in particular cyber-attacks. They must analyse the likely impacts and implement post-incident reviews after a major ICT-related incident. Lessons learned from testing and incidents must be integrated into the ICT risk management process to drive continuous improvement.",
  },
  {
    number: "14",
    title: "Communication",
    summary:
      "Requires crisis communication plans enabling responsible disclosure of major ICT-related incidents or vulnerabilities to clients, counterparts and the public, as appropriate. At least one person must be tasked with implementing the communication strategy and acting as the spokesperson for the financial entity towards the public and the media.",
  },
  {
    number: "15",
    title: "Further harmonisation of ICT risk management tools, methods, processes and policies",
    summary:
      "Empowers the European Supervisory Authorities (ESAs) to develop Regulatory Technical Standards (RTS) further specifying ICT security policies, procedures, protocols and tools. Also covers human resources policy, identity management, access controls, project management, and ICT change management. These RTS ensure a consistent level of digital operational resilience across the Union.",
  },
  {
    number: "16",
    title: "Simplified ICT risk management framework",
    summary:
      "Provides a simplified ICT risk management regime for small and non-interconnected investment firms, payment institutions exempted pursuant to PSD2, electronic money institutions exempted pursuant to EMD2, and certain small IORPs. Microenterprises qualify for this lighter framework. The simplified framework still requires governance, identification, protection, detection, response, recovery, testing and third-party risk management, but with reduced intensity.",
  },
  {
    number: "17",
    title: "ICT-related incident management process",
    summary:
      "Financial entities must define, establish and implement an ICT-related incident management process to detect, manage and notify ICT-related incidents. Procedures must identify, track, log, categorise and classify incidents according to their priority and severity. The process must ensure consistent and integrated monitoring, handling and follow-up of ICT-related incidents.",
  },
  {
    number: "18",
    title: "Classification of ICT-related incidents and cyber threats",
    summary:
      "Financial entities must classify ICT-related incidents and determine their impact based on criteria including the number and relevance of clients or counterparts affected, duration, geographical spread, data losses, severity of impact on ICT systems, criticality of the services affected, and economic impact. Significant cyber threats must be assessed based on the criticality of services at risk and the potential systemic impact.",
  },
  {
    number: "19",
    title: "Reporting of major ICT-related incidents and voluntary notification of significant cyber threats",
    summary:
      "Financial entities must report major ICT-related incidents to the relevant competent authority within time limits defined by RTS (initial, intermediate and final reports). They may voluntarily notify significant cyber threats. Where a major incident has an impact on clients, the financial entity must inform them without undue delay. The competent authority forwards reports to the ESAs, ECB and, where relevant, the single point of contact under NIS2.",
  },
  {
    number: "20",
    title: "Harmonisation of reporting content and templates",
    summary:
      "Empowers the ESAs to develop RTS and ITS establishing the content of reports for major ICT-related incidents and notifications for significant cyber threats, the time limits for each report type, the format of the templates, and the standard forms for notifying clients. Ensures harmonised, comparable and usable incident data across the Union.",
  },
  {
    number: "21",
    title: "Centralisation of reporting of major ICT-related incidents",
    summary:
      "Empowers the ESAs, through the Joint Committee, to prepare a joint report assessing the feasibility of further centralisation of incident reporting through the establishment of a single EU Hub for major ICT-related incident reporting by financial entities. The report must examine scenarios, costs, benefits and necessary resources.",
  },
  {
    number: "22",
    title: "Supervisory feedback",
    summary:
      "Competent authorities must provide relevant anonymised information and intelligence on ICT-related incidents to the reporting financial entity, including providing guidance and remedies where possible. ESAs must publish annually an anonymised aggregated report on major ICT-related incidents with lessons learned.",
  },
  {
    number: "23",
    title: "Operational or security payment-related incidents concerning credit institutions, payment institutions, account information service providers, and electronic money institutions",
    summary:
      "Extends DORA's incident management and reporting obligations to operational or security payment-related incidents for payment service providers covered by PSD2. Aligns the DORA incident framework with the PSD2 reporting regime to avoid duplication while strengthening coverage of payment operations.",
  },
  {
    number: "24",
    title: "General requirements for the performance of digital operational resilience testing",
    summary:
      "Financial entities must establish, maintain and review a sound and comprehensive digital operational resilience testing programme, as an integral part of the ICT risk management framework. Tests must cover all critical ICT systems and applications. Financial entities must ensure that the tests are undertaken by independent parties, either internal or external, without conflicts of interest.",
  },
  {
    number: "25",
    title: "Testing of ICT tools and systems",
    summary:
      "The DORA testing programme must include a range of assessments, tests, methodologies, practices and tools — including vulnerability assessments and scans, open source analyses, network security assessments, gap analyses, physical security reviews, questionnaires, scenario-based testing, compatibility testing, performance testing, end-to-end testing and penetration testing. All ICT systems supporting critical or important functions must be tested at least yearly.",
  },
  {
    number: "26",
    title: "Advanced testing of ICT tools, systems and processes based on TLPT",
    summary:
      "Financial entities that are significant and whose ICT infrastructure supports critical or important functions must carry out advanced Threat-Led Penetration Testing (TLPT) at least every three years. TLPT must cover live production systems, include all critical or important functions, and be performed on several or all financial entities of a group. Competent authorities identify financial entities required to perform TLPT.",
  },
  {
    number: "27",
    title: "Requirements for testers for the carrying out of TLPT",
    summary:
      "Testers performing TLPT must meet strict requirements on suitability, reputation, technical and organisational capabilities, specific expertise in threat intelligence and penetration testing, certification, and professional indemnity insurance. External testers are generally required; internal testers may be used subject to additional conditions including competent authority approval and rotation requirements.",
  },
  {
    number: "28",
    title: "General principles for sound management of ICT third-party risk",
    summary:
      "Financial entities must manage ICT third-party risk as an integral component of their ICT risk management framework. They must maintain and update a Register of Information on all contractual arrangements for ICT services, distinguishing those supporting critical or important functions. Before entering into contracts and throughout the relationship, financial entities must conduct due diligence, assess risks, and ensure the provider meets appropriate standards.",
  },
  {
    number: "29",
    title: "Preliminary assessment of ICT concentration risk at entity level",
    summary:
      "When assessing ICT third-party risk, financial entities must take into account concentration risk, including the risk of contracting with providers that are not easily substitutable, having multiple contracts with the same provider or closely connected providers, and the risk at the level of the financial entity's group. Sub-outsourcing to providers in third countries must be subject to particular scrutiny.",
  },
  {
    number: "30",
    title: "Key contractual provisions",
    summary:
      "Requires written contracts with ICT third-party service providers to include minimum clauses: clear description of services, locations of data processing and service provision, service level agreements, accessibility and assistance, assistance to the financial entity at no additional cost in case of ICT incidents, cooperation with competent authorities, termination rights, exit strategies, and — for services supporting critical or important functions — additional clauses on full service descriptions, monitoring reports, business contingency plans, ICT security standards and training, and audit and inspection rights.",
  },
  {
    number: "31",
    title: "Designation of critical ICT third-party service providers",
    summary:
      "The ESAs, through the Joint Committee, designate ICT third-party service providers that are critical for financial entities (CTPPs) based on criteria including systemic impact of a failure, reliance of financial entities on the provider, substitutability, and the number of Member States in which financial entities use the provider. Designated CTPPs are subject to Union-level oversight by a Lead Overseer (EBA, EIOPA or ESMA).",
  },
  {
    number: "35",
    title: "Powers of the Lead Overseer",
    summary:
      "Grants the Lead Overseer powers to request information, conduct general investigations and on-site inspections, issue recommendations on ICT risk management, subcontracting, sub-outsourcing and subcontracting chains, and impose periodic penalty payments to compel CTPPs to comply with oversight requirements. Periodic penalties may be imposed up to 1% of the daily average worldwide turnover of the CTPP for up to six months.",
  },
  {
    number: "45",
    title: "Information-sharing arrangements on cyber threat information and intelligence",
    summary:
      "Financial entities may exchange cyber threat information and intelligence among themselves within trusted communities, including indicators of compromise, tactics, techniques and procedures, cyber security alerts and configuration tools. Exchanges must be implemented through information-sharing arrangements protecting the sensitive nature of the information, with rules of conduct on confidentiality, competition law, and personal data protection.",
  },
  {
    number: "50",
    title: "Administrative penalties and remedial measures",
    summary:
      "Competent authorities must have all supervisory, investigatory and sanctioning powers necessary to enforce DORA, including the power to impose administrative penalties and remedial measures. Member States may decide not to lay down rules on administrative penalties where infringements are already subject to criminal penalties under national law. Penalties must be effective, proportionate and dissuasive.",
  },
  {
    number: "51",
    title: "Exercise of the power to impose administrative penalties and remedial measures",
    summary:
      "When determining the type and level of administrative penalties or remedial measures, competent authorities must take into account all relevant circumstances, including the materiality, gravity and duration of the breach, the degree of responsibility, the financial strength of the financial entity, the profits gained or losses avoided, prior breaches, and the level of cooperation with the competent authority. Proportionality applies particularly for SMEs.",
  },
  {
    number: "52",
    title: "Criminal penalties",
    summary:
      "Member States may decide to lay down criminal penalties for the breaches of DORA instead of administrative ones, provided such criminal law rules are notified to the Commission and the ESAs. Where Member States choose criminal penalties, they must ensure adequate measures are in place so that competent authorities have the powers to enforce DORA and cooperate with judicial authorities.",
  },
  {
    number: "64",
    title: "Entry into force and date of application",
    summary:
      "DORA entered into force on 16 January 2023, the twentieth day following its publication in the Official Journal of the European Union (L 333 of 27 December 2022). It applies from 17 January 2025. From that date, financial entities and designated critical ICT third-party service providers must fully comply with all DORA obligations, and the Oversight Framework becomes operational.",
  },
];

export const ARTICLE_IDS: ReadonlySet<string> = new Set(
  articleData.map((a) => `${LEGISLATION_ID}-art-${a.number}`),
);

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
        ...curatedSeedProvenance(),
      })
      .onConflictDoUpdate({
        target: articles.id,
        set: {
          title: a.title,
          summary: a.summary,
          fullText: a.summary,
          sourceUrl: `${BASE_URL}#art_${a.number}`,
          embedding: embeddings[i],
          ...curatedSeedProvenance(),
        },
      });
  }

  console.log(`Seeded ${articleData.length} articles.`);
}
