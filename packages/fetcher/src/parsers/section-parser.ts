import { createHash } from "node:crypto";
import type { ParsedArticle } from "./types.js";

const SECTION_START = /^(\d+[A-Z]?)\.\s+/;
const STATIC_SKIP = /^(?:Page \d+|Revised as at|^c$)/;
const TOC_ENTRY = /\.\.\./;

/**
 * Detect the act title from the first page for dynamic header filtering.
 * CIMA PDFs have the act name on every page header. Page 1 typically has
 * the title in uppercase across two lines:
 *   MONETARY AUTHORITY LAW
 *   (2020 Revision)
 * Running headers on subsequent pages use mixed case:
 *   Monetary Authority Law (2020 Revision)
 * We extract the core name (without revision) and match case-insensitively.
 */
function detectActTitle(text: string): string | null {
  const firstPage = text.split("\n\n")[0] || "";
  const lines = firstPage
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  // The act title is usually the 2nd or 3rd non-empty line on page 1
  // (after "CAYMAN ISLANDS"). It may be split across two lines:
  // line N: "MONETARY AUTHORITY LAW" or "Some Act"
  // line N+1: "(2020 Revision)" — optional
  for (let i = 1; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    if (
      line.length > 10 &&
      !line.startsWith("Supplement") &&
      !line.startsWith("CAYMAN") &&
      /Act|Law|Regulations/i.test(line)
    ) {
      // Check if next line is a revision tag like "(2020 Revision)"
      const next = lines[i + 1];
      let fullTitle = line;
      if (next && /^\(\d{4}\s+Revision\)$/i.test(next)) {
        fullTitle = `${line} ${next}`;
      }
      return fullTitle;
    }
  }
  return null;
}

/**
 * Build a case-insensitive skip test for the detected act title.
 * Header lines in CIMA PDFs contain the act title as a substring,
 * often combined with "Section N", "SCHEDULE N", etc.
 */
function buildHeaderFilter(actTitle: string | null): (line: string) => boolean {
  if (!actTitle) return () => false;
  const lower = actTitle.toLowerCase();
  return (line: string) => line.toLowerCase().includes(lower);
}

export function parseSections(text: string): ParsedArticle[] {
  const actTitle = detectActTitle(text);
  const isHeader = buildHeaderFilter(actTitle);
  const lines = text.split("\n");
  const raw: Array<{ number: string; title: string; bodyLines: string[] }> = [];
  let current: { number: string; title: string; bodyLines: string[] } | null =
    null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip filters
    if (STATIC_SKIP.test(line)) continue;
    if (TOC_ENTRY.test(line)) continue;
    if (isHeader(line)) continue;
    if (/^Section \d+/.test(line) && line.length < 30) continue;

    const match = line.match(SECTION_START);
    if (match && line.length > 15) {
      if (current) raw.push(current);

      const rest = line.slice(match[0].length);
      const isTitle = /^[A-Z][a-z]/.test(rest) && rest.length < 80;

      current = {
        number: match[1],
        title: isTitle ? rest : "",
        bodyLines: isTitle ? [] : [rest],
      };
      continue;
    }

    if (current) {
      current.bodyLines.push(line);
    }
  }

  if (current) raw.push(current);

  // Merge consecutive entries with the same section number
  // (common-law title/body duplication)
  const merged: typeof raw = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const next = raw[i + 1];

    if (next && next.number === entry.number) {
      // Merge: entry is the title, next is the body
      merged.push({
        number: entry.number,
        title: entry.title || entry.bodyLines.join(" ").slice(0, 80),
        bodyLines: [...entry.bodyLines, ...next.bodyLines],
      });
      i++; // skip next
    } else {
      merged.push(entry);
    }
  }

  // Build final sections
  const sections: ParsedArticle[] = [];
  for (const entry of merged) {
    const body = entry.bodyLines.join("\n").trim();
    if (body.length < 20) continue;

    const title = entry.title || body.split(/[.\n]/)[0].slice(0, 80);
    const hash = createHash("sha256").update(body).digest("hex");

    sections.push({ number: entry.number, title, body, sourceHash: hash });
  }

  // Deduplicate non-consecutive entries with the same section number.
  // Schedule/fee tables reuse section numbers — keep the longest body
  // (the real section from the main act body).
  const deduped = new Map<string, ParsedArticle>();
  for (const section of sections) {
    const existing = deduped.get(section.number);
    if (!existing || section.body.length > existing.body.length) {
      deduped.set(section.number, section);
    }
  }

  return Array.from(deduped.values());
}
