import { riskCategories } from "../../schema/index.js";
import type { Database } from "../../index.js";
import type { EmbeddingFn } from "../run.js";
import { curatedSeedProvenance } from "../helpers/index.js";

const LEGISLATION_ID = "eu-ai-act";

const riskCategoryData = [
  {
    id: `${LEGISLATION_ID}-risk-prohibited`,
    name: "prohibited",
    level: 4,
    description:
      "AI practices that are prohibited under Article 5 because they pose unacceptable risks to fundamental rights and safety.",
    keywords: [
      "social scoring",
      "subliminal manipulation",
      "exploitation of vulnerabilities",
      "real-time remote biometric identification",
      "emotion recognition workplace",
      "emotion recognition school",
      "untargeted facial image scraping",
      "biometric categorisation sensitive attributes",
      "predictive policing profiling",
    ],
    examples: [
      "Government social scoring systems that evaluate citizens based on social behaviour or personality characteristics",
      "AI systems using subliminal techniques beyond a person's consciousness to materially distort behaviour causing significant harm",
      "AI systems exploiting vulnerabilities of specific groups due to age, disability, or social/economic situation",
      "Real-time remote biometric identification systems in publicly accessible spaces for law enforcement (with limited exceptions)",
      "Emotion recognition systems used in workplaces or educational institutions",
      "Untargeted scraping of facial images from the internet or CCTV footage to build facial recognition databases",
      "Biometric categorisation systems inferring race, political opinions, trade union membership, religious beliefs, sex life or sexual orientation",
      "AI systems for making risk assessments of natural persons for predicting criminal offences based solely on profiling or personality traits",
    ],
    relevantArticles: ["5"],
  },
  {
    id: `${LEGISLATION_ID}-risk-high`,
    name: "high-risk",
    level: 3,
    description:
      "AI systems that pose significant risks to health, safety, or fundamental rights. Subject to comprehensive requirements under Articles 6-27 and Annex III.",
    keywords: [
      "biometrics",
      "critical infrastructure",
      "education",
      "vocational training",
      "employment",
      "workers management",
      "essential services",
      "law enforcement",
      "migration",
      "asylum",
      "border control",
      "justice",
      "democratic processes",
      "safety component",
    ],
    examples: [
      "Remote biometric identification systems (not real-time in public spaces for law enforcement)",
      "AI systems used as safety components in the management and operation of critical digital infrastructure, road traffic, water, gas, heating and electricity supply",
      "AI systems used to determine access or admission to educational and vocational training institutions, or to evaluate learning outcomes",
      "AI systems used for recruitment, selection, HR decisions, task allocation based on individual behaviour, and monitoring/evaluation of workers",
      "AI systems used to evaluate eligibility for public assistance benefits, credit scoring, risk assessment for life and health insurance, and emergency services dispatch",
      "AI systems used for individual risk assessments by law enforcement, as polygraphs, to evaluate evidence reliability, or to profile persons during criminal investigations",
      "AI systems used for processing asylum/visa/residence applications, border surveillance, and migration risk assessment",
      "AI systems used to assist judicial authorities in researching and interpreting facts and law, and to influence the outcome of elections or referendums",
    ],
    relevantArticles: [
      "6",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "26",
      "27",
      "43",
    ],
  },
  {
    id: `${LEGISLATION_ID}-risk-limited`,
    name: "limited",
    level: 2,
    description:
      "AI systems with specific transparency obligations under Article 50. Users must be informed about their interaction with AI or AI-generated content.",
    keywords: [
      "chatbot",
      "deepfake",
      "emotion recognition",
      "AI-generated content",
      "synthetic content",
      "transparency",
      "disclosure",
    ],
    examples: [
      "Chatbots and conversational AI systems that interact directly with natural persons",
      "Deepfake systems that generate or manipulate image, audio or video content resembling existing persons, objects, places or events",
      "Emotion recognition systems used outside of prohibited contexts",
      "AI systems generating or manipulating text content published for informing the public on matters of public interest",
    ],
    relevantArticles: ["50"],
  },
  {
    id: `${LEGISLATION_ID}-risk-minimal`,
    name: "minimal",
    level: 1,
    description:
      "All other AI systems that do not fall into prohibited, high-risk, or limited-risk categories. These systems may be developed and used with no additional requirements beyond AI literacy. Voluntary codes of conduct are encouraged.",
    keywords: [
      "spam filter",
      "AI-enabled video game",
      "inventory management",
      "recommendation system",
      "search engine",
    ],
    examples: [
      "AI-powered spam filters",
      "AI in video games",
      "AI-driven inventory management systems",
      "Content recommendation algorithms",
      "AI-assisted search engines",
    ],
    relevantArticles: ["4", "95"],
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
