/**
 * Text helpers shared by the checks and the UI counters, so the numbers a
 * merchant sees while typing are the same numbers the audit uses.
 */

/** Length in user-visible characters (code points), not UTF-16 units. */
export function charLength(text: string): number {
  return Array.from(text).length;
}

function sliceChars(text: string, end: number): string {
  return Array.from(text).slice(0, end).join("");
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1] === "x" || entity[1] === "X";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Visible text of a Shopify rich-text description. */
export function htmlToText(html: string): string {
  const withoutHidden = html.replace(
    /<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    " ",
  );
  // Tags become spaces so "<p>one</p><p>two</p>" doesn't merge into "onetwo".
  const withoutTags = withoutHidden.replace(/<[^>]*>/g, " ");
  return collapseWhitespace(decodeEntities(withoutTags));
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Counts tokens that contain at least one letter or digit. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token))
    .length;
}

/** Key used to detect duplicates: case- and whitespace-insensitive. */
export function normalizeForCompare(text: string): string {
  return collapseWhitespace(text.normalize("NFKC")).toLocaleLowerCase("en");
}

export interface LengthRange {
  min: number;
  max: number;
}

const TRAILING_FILLER = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "&",
  "+",
  "-",
  "–",
  "—",
  "|",
  "/",
]);

/** Cuts at a word boundary and drops dangling connectors ("…and", "…with"). */
export function cutAtWord(text: string, max: number): string {
  const words = sliceChars(text, max + 1).split(" ");
  if (charLength(text) > max) words.pop(); // last word was cut mid-way
  while (words.length > 0) {
    const last = words[words.length - 1].replace(/[,;:]+$/, "");
    if (last === "" || TRAILING_FILLER.has(last.toLowerCase())) {
      words.pop();
      continue;
    }
    words[words.length - 1] = last;
    break;
  }
  return words.join(" ");
}

function inRange(text: string, range: LengthRange): boolean {
  const length = charLength(text);
  return length >= range.min && length <= range.max;
}

/**
 * Shortens a title to fit `range`: first by dropping trailing segments
 * ("Name | Tagline - Promo"), then at a word boundary. Returns null when no
 * candidate lands inside the range.
 */
export function fitTitle(title: string, range: LengthRange): string | null {
  const text = collapseWhitespace(title);
  if (inRange(text, range)) return text;
  if (charLength(text) < range.min) return null;

  const separators = [...text.matchAll(/\s+[|–—-]\s+/g)].reverse();
  for (const separator of separators) {
    const candidate = text.slice(0, separator.index);
    if (inRange(candidate, range)) return candidate;
  }

  const cut = cutAtWord(text, range.max);
  return inRange(cut, range) ? cut : null;
}

/**
 * Builds a meta description from prose: whole sentences first, then a cut at
 * the last clause boundary, then a word boundary. Returns null when no
 * candidate lands inside the range (e.g. the source is too short).
 */
export function fitSentences(prose: string, range: LengthRange): string | null {
  const text = collapseWhitespace(prose);
  if (charLength(text) < range.min) return null;

  const sentences = text.split(/(?<=[.!?])\s+/);
  let built = "";
  for (const sentence of sentences) {
    const next = built ? `${built} ${sentence}` : sentence;
    if (charLength(next) > range.max) break;
    built = next;
  }
  if (inRange(built, range)) return built;

  const head = sliceChars(text, range.max);
  const clauseEnd = Math.max(
    head.lastIndexOf(", "),
    head.lastIndexOf("; "),
    head.lastIndexOf(": "),
    head.lastIndexOf(" – "),
    head.lastIndexOf(" — "),
  );
  if (clauseEnd > 0) {
    const clause = `${head.slice(0, clauseEnd).replace(/[.,;:\s]+$/, "")}.`;
    if (inRange(clause, range)) return clause;
  }

  const cut = cutAtWord(text, range.max);
  return inRange(cut, range) ? cut : null;
}
