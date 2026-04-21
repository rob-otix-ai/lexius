import { eq } from "drizzle-orm";
import { obligations } from "../../schema/index.js";
import type { Database } from "../../index.js";
import type { EmbeddingFn } from "../run.js";
import {
  articleStringToIds,
  curatedSeedProvenance,
  SEED_REVIEWER,
} from "../helpers/index.js";
import { ARTICLE_IDS } from "./articles.js";

const LEGISLATION_ID = "dora";
const DEFAULT_DEADLINE = new Date("2025-01-17");

const obligationData = [
  // ===== Pillar 1 — ICT Risk Management (full-framework) =====
  {
    id: `${LEGISLATION_ID}-obl-rmf-governance`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Management body governance and accountability for ICT risk",
    article: "Art. 5",
    deadline: DEFAULT_DEADLINE,
    details:
      "The management body must define, approve, oversee and be accountable for the implementation of all arrangements related to the ICT risk management framework. Members must maintain sufficient knowledge of ICT risk, approve policies, allocate appropriate budget, review major incident reports, and undertake specific ICT risk training. Clear roles and responsibilities must be assigned for ICT functions.",
    category: "governance",
  },
  {
    id: `${LEGISLATION_ID}-obl-rmf-framework`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Establish and maintain a comprehensive ICT risk management framework",
    article: "Art. 6",
    deadline: DEFAULT_DEADLINE,
    details:
      "Implement a sound, comprehensive and well-documented ICT risk management framework as an integral part of the overall risk management system. The framework must include strategies, policies, procedures, ICT protocols and tools necessary to protect all information and ICT assets. It must be reviewed at least yearly and after any major ICT-related incident, and audited by internal audit with appropriate ICT knowledge.",
    category: "risk-management",
  },
  {
    id: `${LEGISLATION_ID}-obl-rmf-identification`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Identify and classify ICT-supported functions, assets and risks",
    article: "Art. 8",
    deadline: DEFAULT_DEADLINE,
    details:
      "Identify, classify and adequately document all ICT-supported business functions, roles, responsibilities, information assets and ICT assets. Map dependencies across financial entities and third parties, identify sources of ICT risk, and perform risk assessments on each major change in network and information systems. Review the classification at least once a year.",
    category: "risk-management",
  },
  {
    id: `${LEGISLATION_ID}-obl-rmf-protection`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Implement ICT protection and prevention measures",
    article: "Art. 9",
    deadline: DEFAULT_DEADLINE,
    details:
      "Continuously monitor and control the security and functioning of ICT systems. Implement policies and tools covering information security, network security (including segmentation), strong authentication, encryption of data in transit and at rest, secure configuration and patch management, change management, physical security of ICT assets, and the secure handling of confidential data.",
    category: "risk-management",
  },
  {
    id: `${LEGISLATION_ID}-obl-rmf-detection`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Establish detection mechanisms for anomalous activities",
    article: "Art. 10",
    deadline: DEFAULT_DEADLINE,
    details:
      "Put in place mechanisms to promptly detect anomalous activities, network performance issues, and ICT-related incidents. Establish multiple layers of control, define alert thresholds and criteria to trigger the incident response process, automate alerting to staff responsible for incident response, and identify potential material single points of failure.",
    category: "risk-management",
  },
  {
    id: `${LEGISLATION_ID}-obl-rmf-response-recovery`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Maintain ICT business continuity policy and response and recovery plans",
    article: "Art. 11",
    deadline: DEFAULT_DEADLINE,
    details:
      "Establish a comprehensive ICT business continuity policy and associated ICT response and recovery plans that ensure continuity of critical or important functions, restore operations quickly after disruptions, and limit damage. Plans must be tested at least yearly and after substantive infrastructure changes. Results must be reported to the management body.",
    category: "risk-management",
  },
  {
    id: `${LEGISLATION_ID}-obl-rmf-backup`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Implement backup, restoration and recovery procedures",
    article: "Art. 12",
    deadline: DEFAULT_DEADLINE,
    details:
      "Develop and document backup policies and procedures specifying the scope and minimum frequency of backups based on the criticality and confidentiality of information. Restoration and recovery procedures must be established, segregated from source systems to avoid compromise, and periodically tested. Redundant ICT capacities must be adequate to ensure business continuity.",
    category: "risk-management",
  },
  {
    id: `${LEGISLATION_ID}-obl-rmf-learning`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Implement learning and evolving processes",
    article: "Art. 13",
    deadline: DEFAULT_DEADLINE,
    details:
      "Gather information on vulnerabilities and cyber threats and on ICT-related incidents, particularly cyber-attacks, and analyse their likely impacts. Carry out post-incident reviews after every major ICT-related incident, integrate lessons learned into the ICT risk management framework, and deliver regular ICT security awareness and digital operational resilience training to all staff and the management body.",
    category: "risk-management",
  },
  {
    id: `${LEGISLATION_ID}-obl-rmf-communication`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Maintain a crisis communication plan",
    article: "Art. 14",
    deadline: DEFAULT_DEADLINE,
    details:
      "Establish crisis communication plans enabling responsible disclosure of major ICT-related incidents or vulnerabilities to clients, counterparts and the public, as appropriate. Designate at least one person responsible for implementing the communication strategy and acting as spokesperson towards the public and the media.",
    category: "governance",
  },

  // ===== Pillar 2 — Incident Management (full-framework) =====
  {
    id: `${LEGISLATION_ID}-obl-incident-process`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Establish an ICT-related incident management process",
    article: "Art. 17",
    deadline: DEFAULT_DEADLINE,
    details:
      "Define, establish and implement an ICT-related incident management process to detect, manage and notify ICT-related incidents. Procedures must identify, track, log, categorise and classify incidents according to priority and severity, ensuring consistent and integrated monitoring, handling and follow-up. Records must support root-cause analysis.",
    category: "incident-response",
  },
  {
    id: `${LEGISLATION_ID}-obl-incident-classification`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Classify ICT-related incidents and cyber threats",
    article: "Art. 18",
    deadline: DEFAULT_DEADLINE,
    details:
      "Classify ICT-related incidents using the criteria set out in Article 18 and the RTS adopted by the ESAs: number and relevance of clients or counterparts affected, duration, geographical spread, data losses, severity of impact on ICT systems, criticality of services affected, and economic impact. Assess significant cyber threats based on the criticality of services at risk and potential systemic impact.",
    category: "incident-response",
  },
  {
    id: `${LEGISLATION_ID}-obl-incident-reporting`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Report major ICT-related incidents to the competent authority",
    article: "Art. 19",
    deadline: DEFAULT_DEADLINE,
    details:
      "Report major ICT-related incidents to the relevant competent authority within the time limits set by the adopted RTS (initial, intermediate and final reports). Where the incident affects clients, inform them without undue delay and communicate measures taken to mitigate the adverse effects. Significant cyber threats may be notified voluntarily.",
    category: "incident-response",
  },
  {
    id: `${LEGISLATION_ID}-obl-incident-final-report`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Submit final incident reports using harmonised templates",
    article: "Art. 20",
    deadline: DEFAULT_DEADLINE,
    details:
      "Use the harmonised content, templates and timelines specified in the RTS/ITS adopted under Article 20 for major ICT-related incident reporting and significant cyber threat notifications. Ensure reports contain all required fields, follow the standard forms, and are submitted through the channels designated by the competent authority.",
    category: "incident-response",
  },

  // ===== Pillar 3 — Digital Operational Resilience Testing (full-framework) =====
  {
    id: `${LEGISLATION_ID}-obl-test-programme`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Maintain an annual digital operational resilience testing programme",
    article: "Art. 24",
    deadline: DEFAULT_DEADLINE,
    details:
      "Establish, maintain and review a sound and comprehensive digital operational resilience testing programme as an integral part of the ICT risk management framework. Include a variety of assessments, tests, methodologies and tools. Prioritise tests based on risk, ensure independence of testers, and follow a risk-based approach considering the evolving ICT risk landscape.",
    category: "testing",
  },
  {
    id: `${LEGISLATION_ID}-obl-test-general`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Conduct annual tests of ICT tools and systems supporting critical functions",
    article: "Art. 25",
    deadline: DEFAULT_DEADLINE,
    details:
      "All ICT systems and applications supporting critical or important functions must be tested at least yearly. Testing must include vulnerability assessments and scans, open source analyses, network security assessments, gap analyses, physical security reviews, questionnaires, scenario-based tests, compatibility and performance tests, end-to-end tests, and penetration testing, as appropriate.",
    category: "testing",
  },
  {
    id: `${LEGISLATION_ID}-obl-test-tlpt`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Perform advanced Threat-Led Penetration Testing (TLPT)",
    article: "Art. 26, Art. 27",
    deadline: DEFAULT_DEADLINE,
    details:
      "Financial entities identified by the competent authority as significant must carry out TLPT at least every three years, covering live production systems and all critical or important functions. TLPT must be performed by certified testers meeting the requirements of Article 27 on reputation, capabilities, expertise, certification and professional indemnity insurance. Internal testers may only be used under specific conditions.",
    category: "testing",
  },

  // ===== Pillar 4 — Third-Party Risk (full-framework) =====
  {
    id: `${LEGISLATION_ID}-obl-tpr-register`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Maintain and submit the Register of Information",
    article: "Art. 28",
    deadline: DEFAULT_DEADLINE,
    details:
      "Maintain and update a Register of Information on all contractual arrangements with ICT third-party service providers, distinguishing those supporting critical or important functions. Report the register annually to the competent authority in the harmonised ITS format. Before entering into a new arrangement, conduct due diligence on the provider and assess ICT concentration risk.",
    category: "third-party-risk",
  },
  {
    id: `${LEGISLATION_ID}-obl-tpr-concentration`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Assess ICT concentration risk at entity level",
    article: "Art. 29",
    deadline: DEFAULT_DEADLINE,
    details:
      "Take into account ICT concentration risk when assessing third-party arrangements, including reliance on providers that are not easily substitutable, multiple contracts with the same or closely connected providers, and group-level exposures. Apply particular scrutiny to sub-outsourcing to providers in third countries, and report concentration indicators in the Register of Information.",
    category: "third-party-risk",
  },
  {
    id: `${LEGISLATION_ID}-obl-tpr-contracts`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Ensure ICT third-party contracts contain mandatory DORA clauses",
    article: "Art. 30",
    deadline: DEFAULT_DEADLINE,
    details:
      "All ICT third-party contracts must be in writing and include clear descriptions of services, data processing locations, service level agreements, accessibility and assistance obligations, cooperation with competent authorities, termination rights, and exit strategies. Contracts for services supporting critical or important functions must also include full service descriptions, monitoring reports, business contingency plans, ICT security standards and training, and comprehensive audit and inspection rights.",
    category: "third-party-risk",
  },

  // ===== Simplified framework =====
  {
    id: `${LEGISLATION_ID}-obl-simplified-governance`,
    role: "financial-entity",
    riskLevel: "simplified-framework",
    obligation: "Management body oversight of the simplified ICT risk management framework",
    article: "Art. 16(1), Art. 5",
    deadline: DEFAULT_DEADLINE,
    details:
      "Under the simplified regime, the management body remains accountable for ICT risk governance. It must define and approve the simplified ICT risk management framework, monitor its implementation, ensure appropriate resources are allocated, and review ICT-related incidents affecting the entity. The oversight must be proportionate to the entity's size and risk profile.",
    category: "governance",
  },
  {
    id: `${LEGISLATION_ID}-obl-simplified-rmf`,
    role: "financial-entity",
    riskLevel: "simplified-framework",
    obligation: "Implement a simplified ICT risk management framework",
    article: "Art. 16",
    deadline: DEFAULT_DEADLINE,
    details:
      "Entities covered by Article 16 must apply a simplified ICT risk management framework covering governance, identification of critical ICT-supported functions, protection and prevention measures, detection mechanisms, response and recovery arrangements, and backup and restoration. The framework must be documented and reviewed periodically, with incident reporting and third-party risk management still applicable at reduced intensity.",
    category: "risk-management",
  },

  // ===== CTPP obligations =====
  {
    id: `${LEGISLATION_ID}-obl-ctpp-cooperation`,
    role: "ctpp",
    riskLevel: "ctpp",
    obligation: "Cooperate with the Lead Overseer",
    article: "Art. 31, Art. 35",
    deadline: DEFAULT_DEADLINE,
    details:
      "Designated Critical ICT Third-Party Service Providers (CTPPs) must cooperate fully with the Lead Overseer, providing all requested information, giving access to systems and premises for general investigations and on-site inspections, and enabling examination of subcontracting chains. CTPPs must maintain a Union-based point of contact where established outside the Union.",
    category: "oversight",
  },
  {
    id: `${LEGISLATION_ID}-obl-ctpp-recommendations`,
    role: "ctpp",
    riskLevel: "ctpp",
    obligation: "Comply with Lead Overseer recommendations",
    article: "Art. 35",
    deadline: DEFAULT_DEADLINE,
    details:
      "CTPPs must respond to and, where accepted, implement recommendations issued by the Lead Overseer on ICT risk management, subcontracting, sub-outsourcing arrangements, ICT security practices, and other oversight matters. Where a CTPP intends not to follow a recommendation, it must provide a reasoned explanation. Financial entities using CTPPs that do not endorse recommendations must consider the ICT risk involved.",
    category: "oversight",
  },
  {
    id: `${LEGISLATION_ID}-obl-ctpp-penalty-awareness`,
    role: "ctpp",
    riskLevel: "ctpp",
    obligation: "Awareness of periodic penalty payment exposure",
    article: "Art. 35(6)",
    deadline: DEFAULT_DEADLINE,
    details:
      "CTPPs that fail to comply with measures imposed by the Lead Overseer under Article 35 may be subject to periodic penalty payments of up to 1% of the daily average worldwide turnover achieved in the preceding business year, imposed on a daily basis for up to six months. CTPPs must therefore establish governance and controls to ensure timely compliance with Lead Overseer measures.",
    category: "oversight",
  },

  // ===== Universal (full-framework) =====
  {
    id: `${LEGISLATION_ID}-obl-info-sharing`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Participate in cyber threat information-sharing arrangements",
    article: "Art. 45",
    deadline: DEFAULT_DEADLINE,
    details:
      "Financial entities may exchange cyber threat information and intelligence among themselves within trusted communities, including indicators of compromise, TTPs, alerts and tools. Exchanges must be implemented through information-sharing arrangements protecting the sensitive nature of the information and complying with confidentiality, competition law and personal data protection rules. Participation and withdrawal must be notified to competent authorities.",
    category: "information-sharing",
  },
  {
    id: `${LEGISLATION_ID}-obl-proportionality`,
    role: "financial-entity",
    riskLevel: "full-framework",
    obligation: "Apply the proportionality principle to DORA implementation",
    article: "Art. 4",
    deadline: DEFAULT_DEADLINE,
    details:
      "Implement DORA rules taking into account the financial entity's size, overall risk profile, and the nature, scale and complexity of its services, activities and operations. Proportionality applies to the design of the ICT risk management framework, testing programme and third-party risk controls, but does not waive the specific obligations that apply to each category of financial entity.",
    category: "governance",
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
    const derivedFrom = articleStringToIds(
      LEGISLATION_ID,
      o.article,
      ARTICLE_IDS,
    );
    await db
      .insert(obligations)
      .values({
        id: o.id,
        legislationId: LEGISLATION_ID,
        role: o.role,
        riskLevel: o.riskLevel,
        obligation: o.obligation,
        article: o.article,
        deadline: o.deadline,
        details: o.details,
        category: o.category,
        derivedFrom,
        embedding: embeddings[i],
        ...curatedSeedProvenance(),
      })
      .onConflictDoUpdate({
        target: obligations.id,
        set: {
          role: o.role,
          riskLevel: o.riskLevel,
          obligation: o.obligation,
          article: o.article,
          deadline: o.deadline,
          details: o.details,
          category: o.category,
          derivedFrom,
          embedding: embeddings[i],
          ...curatedSeedProvenance(),
        },
        // Seed idempotency: only overwrite rows still owned by the seed.
        // Any row whose curated_by has been changed by a real curator is
        // owned by that human — re-seed leaves it alone.
        setWhere: eq(obligations.curatedBy, SEED_REVIEWER),
      });
  }

  console.log(`Seeded ${obligationData.length} obligations.`);
}
