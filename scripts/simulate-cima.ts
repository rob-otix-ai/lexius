import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const acts = [
  { id: "cima-monetary-authority", url: "https://www.cima.ky/upimages/lawsregulations/MonetaryAuthorityLaw2020Revision_1579789069_1599483258.pdf" },
  { id: "cima-banks-trust", url: "https://www.cima.ky/upimages/lawsregulations/BanksandTrustCompaniesAct2025Revision_1738876804.pdf" },
  { id: "cima-mutual-funds", url: "https://www.cima.ky/upimages/lawsregulations/MutualFundsAct2025Revision_1739307105.pdf" },
  { id: "cima-private-funds", url: "https://www.cima.ky/upimages/lawsregulations/PrivateFundsAct2025Revision_1739307005.pdf" },
  { id: "cima-securities", url: "https://www.cima.ky/upimages/lawsregulations/1579810300SecuritiesInvestmentBusinessLaw2020Revision_1579810300_1599485102.pdf" },
  { id: "cima-insurance", url: "https://www.cima.ky/upimages/lawsregulations/1499345418InsuranceLaw2010_1599481339.pdf" },
  { id: "cima-aml", url: "https://www.cima.ky/upimages/lawsregulations/Anti-MoneyLaunderingRegulations2025Revision,LG6,S1_1738770781.pdf" },
  { id: "cima-vasp", url: "https://www.cima.ky/upimages/lawsregulations/VirtualAssetServiceProvidersAct2024Revision_1716397271.pdf" },
  { id: "cima-proceeds-crime", url: "https://www.cima.ky/upimages/lawsregulations/ProceedsofCrimeAct_2024Revision_1713968966.pdf" },
  { id: "cima-beneficial-ownership", url: "https://www.cima.ky/upimages/lawsregulations/BeneficialOwnershipTransparencyAct,2023_1705419742.pdf" },
];

async function extractText(buffer: ArrayBuffer): Promise<{ text: string; pageCount: number }> {
  const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let t = "";
    for (const item of content.items as any[]) {
      if ("str" in item) {
        t += item.str;
        if (item.hasEOL) t += "\n";
      }
    }
    pages.push(t);
  }
  return { text: pages.join("\n\n"), pageCount: doc.numPages };
}

interface Section {
  number: string;
  body: string;
}

function parseSections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let cur: { number: string; lines: string[] } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.includes("...")) continue;
    if (/^Page \d+/.test(line)) continue;
    if (/^Revised as at/.test(line)) continue;
    if (line === "c") continue;
    if (/^Section \d+/.test(line) && line.length < 30) continue;

    const m = line.match(/^(\d+[A-Z]?)\.\s+(.+)/);
    if (m && line.length > 15) {
      if (cur && cur.lines.length > 0) {
        const body = cur.lines.join("\n").trim();
        if (body.length > 20) sections.push({ number: cur.number, body });
      }
      cur = { number: m[1], lines: [m[2]] };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur && cur.lines.length > 0) {
    const body = cur.lines.join("\n").trim();
    if (body.length > 20) sections.push({ number: cur.number, body });
  }
  return sections;
}

async function main() {
  console.log(
    "ID".padEnd(30) +
    "Pg".padEnd(5) +
    "Chars".padEnd(8) +
    "Sects".padEnd(7) +
    "Dupes".padEnd(7) +
    "Short".padEnd(7) +
    "Huge".padEnd(7) +
    "Leaked".padEnd(8) +
    "Gaps".padEnd(6) +
    "Pens",
  );
  console.log("-".repeat(100));

  let totalSections = 0;
  let totalPenalties = 0;
  const allIssues: string[] = [];

  for (const act of acts) {
    try {
      const resp = await fetch(act.url);
      if (!resp.ok) {
        console.log(act.id.padEnd(30) + `DOWNLOAD FAILED: ${resp.status}`);
        allIssues.push(`${act.id}: download failed ${resp.status}`);
        continue;
      }
      const buf = await resp.arrayBuffer();
      const { text, pageCount } = await extractText(buf);
      const sections = parseSections(text);

      // Duplicate section numbers
      const nums = sections.map((s) => s.number);
      const dupes = [...new Set(nums.filter((n, i) => nums.indexOf(n) !== i))];

      // Short sections
      const short = sections.filter((s) => s.body.length < 50);

      // Huge sections (swallowed next section?)
      const huge = sections.filter((s) => s.body.length > 10000);

      // Leaked page headers
      const leaked = sections.filter(
        (s) => s.body.includes("Revised as at") || /\bPage \d+\b/.test(s.body),
      );

      // Numbering gaps
      const numericNums = nums
        .map((n) => parseInt(n))
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b);
      const gaps: number[] = [];
      for (let i = 1; i < numericNums.length; i++) {
        if (numericNums[i] - numericNums[i - 1] > 5) gaps.push(numericNums[i - 1]);
      }

      // Penalties
      const pens = sections.filter((s) =>
        /fine|penalty|imprisonment|offence/i.test(s.body),
      ).length;

      totalSections += sections.length;
      totalPenalties += pens;

      console.log(
        act.id.padEnd(30) +
        String(pageCount).padEnd(5) +
        String(text.length).padEnd(8) +
        String(sections.length).padEnd(7) +
        String(dupes.length).padEnd(7) +
        String(short.length).padEnd(7) +
        String(huge.length).padEnd(7) +
        String(leaked.length).padEnd(8) +
        String(gaps.length).padEnd(6) +
        String(pens),
      );

      if (dupes.length > 0) allIssues.push(`${act.id}: ${dupes.length} duplicate section numbers (${dupes.slice(0, 5).join(",")})`);
      if (short.length > 5) allIssues.push(`${act.id}: ${short.length} very short sections`);
      if (huge.length > 0) allIssues.push(`${act.id}: ${huge.length} huge sections (${huge.map((s) => "s." + s.number + "=" + s.body.length).join(",")})`);
      if (leaked.length > 0) allIssues.push(`${act.id}: ${leaked.length} sections with leaked page headers`);
      if (gaps.length > 3) allIssues.push(`${act.id}: ${gaps.length} numbering gaps`);
    } catch (e: any) {
      console.log(act.id.padEnd(30) + `ERROR: ${e.message.slice(0, 60)}`);
      allIssues.push(`${act.id}: ${e.message.slice(0, 80)}`);
    }
  }

  console.log("-".repeat(100));
  console.log(`TOTAL: ${totalSections} sections, ${totalPenalties} with penalty text`);

  if (allIssues.length > 0) {
    console.log(`\n=== ${allIssues.length} ISSUES FOUND ===`);
    for (const issue of allIssues) {
      console.log(`  - ${issue}`);
    }
  } else {
    console.log("\n=== ALL CLEAN ===");
  }
}

main().catch(console.error);
