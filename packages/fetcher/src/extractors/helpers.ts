import { createHash } from "node:crypto";

/**
 * Naïve sentence splitter for EU-regulation prose. Splits on sentence-ending
 * punctuation followed by whitespace; preserves paragraph markers ("1.", "3(a)").
 *
 * This is intentionally not an NLP-grade splitter. EU regulation text is
 * mechanically formatted — a simple scanner is enough and keeps the extractor
 * purely in-process.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    buf += ch;
    if (ch === "." || ch === "!" || ch === "?") {
      const next = text[i + 1];
      const prev2 = buf.length >= 3 ? buf.slice(-3, -1) : "";
      // Skip splitting on decimal numbers ("7.5") and numbered-paragraph markers
      // ("1. ") — the latter is matched separately by inferParagraphRef.
      const prevChar = buf.length >= 2 ? buf[buf.length - 2] : "";
      const isDecimal = /\d/.test(prevChar) && /\d/.test(next ?? "");
      const isShortNumber = /^\s*\d{1,3}$/.test(prev2.trim());
      if (isDecimal) continue;
      if (next === undefined || next === "\n" || next === " " || next === "\t") {
        // Don't split on "Art." / "No." style abbreviations before a number.
        const trimmed = buf.trimEnd();
        const tail = trimmed.slice(-4).toLowerCase();
        if (tail === "art." || tail.endsWith(" no.")) continue;
        // Don't split if the sentence is really just "1" or "12." (paragraph marker).
        if (isShortNumber && next === " ") continue;
        const sentence = buf.trim();
        if (sentence) out.push(sentence);
        buf = "";
      }
    } else if (ch === "\n") {
      const sentence = buf.trim();
      if (sentence) out.push(sentence);
      buf = "";
    }
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Walk back from the sentence's position in the article text to find the most
 * recent numbered paragraph marker (`^\d+\.` at the start of a paragraph).
 * Returns empty string if none found.
 */
export function inferParagraphRef(articleText: string, sentence: string): string {
  const idx = articleText.indexOf(sentence);
  if (idx < 0) return "";
  const before = articleText.slice(0, idx);
  // Walk paragraph markers — split on double-newline then single-newline.
  const markers = [...before.matchAll(/(?:^|\n\n|\n)\s*(\d+)\.\s/g)];
  if (!markers.length) return "";
  return markers[markers.length - 1][1];
}

/**
 * Normalise a captured EUR amount to an integer value.
 *
 * - `("35,000,000", undefined)` → 35000000
 * - `("35", "million")` → 35000000
 * - `("7.5", "million")` → 7500000
 * - `("1 500 000", undefined)` → 1500000
 *
 * European notation uses both `,` and `.` as thousand separators; we treat any
 * digit group with thousand-style grouping (3-digit groups) as integer digits.
 * Returns null if parsing fails.
 */
export function normaliseEur(amount: string, magnitude?: string): number | null {
  const cleaned = amount.replace(/\s+/g, "").trim();
  if (!cleaned) return null;

  let base: number;
  // If there's a single "." followed by 1-2 digits and no comma, treat as decimal.
  // Otherwise strip all separators as thousands grouping.
  const decimalMatch = cleaned.match(/^(\d+)[.,](\d{1,2})$/);
  if (decimalMatch) {
    base = parseFloat(`${decimalMatch[1]}.${decimalMatch[2]}`);
  } else {
    // Strip dots and commas (European thousand separators).
    const digits = cleaned.replace(/[.,]/g, "");
    if (!/^\d+$/.test(digits)) return null;
    base = parseInt(digits, 10);
  }

  if (Number.isNaN(base)) return null;

  const mag = magnitude?.toLowerCase();
  if (mag === "million" || mag === "m") {
    base *= 1_000_000;
  } else if (mag === "billion" || mag === "bn") {
    base *= 1_000_000_000;
  } else if (mag === "thousand") {
    base *= 1_000;
  }

  // Integerise fractional EUR amounts (7.5m → 7,500,000).
  if (!Number.isInteger(base)) {
    base = Math.round(base);
  }

  return base;
}

const ROMAN_LOOKUP: Record<string, number> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
};

/**
 * Convert a Roman numeral to a number. Returns null on failure.
 * Used for annex cross-ref canonicalisation.
 */
export function romanToInt(roman: string): number | null {
  const s = roman.toUpperCase();
  if (!/^[IVXLCDM]+$/.test(s)) return null;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = ROMAN_LOOKUP[s[i]];
    const next = ROMAN_LOOKUP[s[i + 1]];
    if (next && cur < next) {
      total -= cur;
    } else {
      total += cur;
    }
  }
  return total || null;
}
