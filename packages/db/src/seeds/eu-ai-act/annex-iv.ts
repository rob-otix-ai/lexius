import { articles } from "../../schema/index.js";
import type { Database } from "../../index.js";
import type { EmbeddingFn } from "../run.js";
import { curatedSeedProvenance } from "../helpers/index.js";

const LEGISLATION_ID = "eu-ai-act";

const annexIvData = [
  {
    id: "eu-ai-act-doc-1",
    number: "doc-1",
    title: "General description of the AI system",
    summary:
      "Intended purpose, developer identity, version, how the system interacts with hardware/software, system architecture, key design choices, and rationale.",
    fullText:
      "A general description of the AI system including: (a) its intended purpose, the name and address of the provider; (b) how the AI system interacts with hardware or software; (c) the versions of relevant software or firmware; (d) a general description of the architecture explaining the main elements and their interactions.",
    sourceUrl:
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689#anx_IV",
    relatedAnnexes: ["IV"],
  },
  {
    id: "eu-ai-act-doc-2",
    number: "doc-2",
    title: "Detailed description of elements and development process",
    summary:
      "Development methods, design specifications, data requirements, training methodologies, validation and testing procedures used, including information about training data sets and their characteristics.",
    fullText:
      "A detailed description of the elements of the AI system and of the process for its development, including: (a) the methods and steps taken for the development; (b) the design specifications, including the general logic and algorithms; (c) key design choices and the rationale for those choices; (d) the data requirements in terms of data sets used for training, validation and testing.",
    sourceUrl:
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689#anx_IV",
    relatedAnnexes: ["IV"],
  },
  {
    id: "eu-ai-act-doc-3",
    number: "doc-3",
    title: "Monitoring, functioning and control of the AI system",
    summary:
      "Capabilities and limitations, degree of accuracy, foreseeable unintended outcomes and risks, human oversight measures, and specifications for input data.",
    fullText:
      "Detailed information about the monitoring, functioning and control of the AI system, including: (a) the capabilities and limitations of the system; (b) the degrees of accuracy for specific persons or groups; (c) the foreseeable unintended outcomes and sources of risks; (d) human oversight measures and technical specifications for input data.",
    sourceUrl:
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689#anx_IV",
    relatedAnnexes: ["IV"],
  },
  {
    id: "eu-ai-act-doc-4",
    number: "doc-4",
    title: "Description of the appropriateness of performance metrics",
    summary:
      "Performance metrics used for the AI system, the expected level of performance, and the benchmarks and testing methodologies used to validate accuracy, robustness, and compliance.",
    fullText:
      "A description of the appropriateness of the performance metrics for the specific AI system, including: (a) the metrics used to measure accuracy, robustness, and cybersecurity; (b) expected levels of performance for the intended purpose; (c) any known limitations.",
    sourceUrl:
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689#anx_IV",
    relatedAnnexes: ["IV"],
  },
  {
    id: "eu-ai-act-doc-5",
    number: "doc-5",
    title: "Risk management system",
    summary:
      "Description of the risk management system implemented in accordance with Article 9, including the identification and analysis of known and foreseeable risks, risk mitigation measures, and residual risk assessment.",
    fullText:
      "A description of the risk management system in accordance with Article 9, including: (a) identified and analysed risks; (b) estimation and evaluation of risks; (c) management and mitigation measures adopted; (d) residual risks and their acceptability.",
    sourceUrl:
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689#anx_IV",
    relatedAnnexes: ["IV"],
  },
  {
    id: "eu-ai-act-doc-6",
    number: "doc-6",
    title: "Description of changes made throughout the lifecycle",
    summary:
      "Record of all substantial changes made to the AI system throughout its lifecycle, including modifications to technology, purpose, pre-trained components, training data, and performance affecting compliance.",
    fullText:
      "A description of any change made to the system through its lifecycle, including changes to: (a) technology and approach; (b) intended purpose or deployment context; (c) training or testing data; (d) performance metrics.",
    sourceUrl:
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689#anx_IV",
    relatedAnnexes: ["IV"],
  },
  {
    id: "eu-ai-act-doc-7",
    number: "doc-7",
    title: "List of harmonised standards and common specifications applied",
    summary:
      "References to harmonised standards applied in full or in part, common specifications, or other standards and technical specifications used to demonstrate conformity.",
    fullText:
      "A list of the harmonised standards applied in full or in part, the references of which have been published in the Official Journal of the European Union; where no such harmonised standards have been applied, a detailed description of the solutions adopted to meet the requirements.",
    sourceUrl:
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689#anx_IV",
    relatedAnnexes: ["IV"],
  },
  {
    id: "eu-ai-act-doc-8",
    number: "doc-8",
    title: "Copy of the EU declaration of conformity",
    summary:
      "A copy of the EU declaration of conformity referred to in Article 47, demonstrating that the AI system complies with the requirements of the regulation.",
    fullText:
      "A copy of the EU declaration of conformity referred to in Article 47.",
    sourceUrl:
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689#anx_IV",
    relatedAnnexes: ["IV"],
  },
  {
    id: "eu-ai-act-doc-9",
    number: "doc-9",
    title: "Description of the post-market monitoring system",
    summary:
      "Detailed description of the post-market monitoring system established in accordance with Article 72, including a post-market monitoring plan.",
    fullText:
      "A detailed description of the system in place to evaluate the AI system performance in the post-market phase in accordance with Article 72, including the post-market monitoring plan referred to in Article 72(3).",
    sourceUrl:
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689#anx_IV",
    relatedAnnexes: ["IV"],
  },
];

export async function seedAnnexIv(db: Database, embed: EmbeddingFn) {
  console.log("Seeding Annex IV entries...");

  const textsToEmbed = annexIvData.map((a) => `${a.title}. ${a.summary}`);
  const embeddings = await embed(textsToEmbed);

  for (let i = 0; i < annexIvData.length; i++) {
    const a = annexIvData[i];
    await db
      .insert(articles)
      .values({
        id: a.id,
        legislationId: LEGISLATION_ID,
        number: a.number,
        title: a.title,
        summary: a.summary,
        fullText: a.fullText,
        sourceUrl: a.sourceUrl,
        relatedAnnexes: a.relatedAnnexes,
        embedding: embeddings[i],
        ...curatedSeedProvenance(),
      })
      .onConflictDoUpdate({
        target: articles.id,
        set: {
          title: a.title,
          summary: a.summary,
          fullText: a.fullText,
          sourceUrl: a.sourceUrl,
          relatedAnnexes: a.relatedAnnexes,
          embedding: embeddings[i],
          ...curatedSeedProvenance(),
        },
      });
  }

  console.log(`Seeded ${annexIvData.length} Annex IV entries.`);
}
