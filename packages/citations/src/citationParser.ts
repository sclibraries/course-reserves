/**
 * Citation Parser for EBSCO Discovery Search
 *
 * Faculty paste a full citation, we extract Author / Title / Source
 * into separate fields so they can review, adjust, then search.
 */

export interface ParsedCitation {
  author: string;
  title: string;
  source: string;
}

const SOURCE_METADATA_MARKER_PATTERN = /(?:^|,\s*|\s+)(?:vol|pp|no|issue|pages?)\.?.*$/iu;
const TRAILING_SOURCE_NUMBERS_PATTERN = /(?:,?\s*\d+(?:\(\d+(?:\/\d+)?\))?(?:\/\d+)?)+\s*$/u;

// All quote characters we might encounter (straight + curly)
const QUOTE_CHARS = ['"', '\u201C', '\u201D'];

function isQuote(ch: string): boolean {
  return QUOTE_CHARS.includes(ch);
}

/**
 * Parse a citation string into author, title, and source components.
 *
 * Supports common academic citation patterns:
 * - Articles:  Author, "Title," Journal Vol (Year): Pages
 * - Chapters:  Author, "Title," in Editor eds., BookTitle (Place: Publisher, Year), Pages
 */
export function parseCitation(citation: string): ParsedCitation {
  const trimmed = normalizeCitation(citation);

  if (!trimmed) {
    return { author: '', title: '', source: '' };
  }

  // Find the first and last quote characters (any type)
  let firstQuote = -1;
  let lastQuote = -1;

  for (let i = 0; i < trimmed.length; i++) {
    if (isQuote(trimmed[i])) {
      firstQuote = i;
      break;
    }
  }

  for (let i = trimmed.length - 1; i >= 0; i--) {
    if (isQuote(trimmed[i])) {
      lastQuote = i;
      break;
    }
  }

  // If we found a quoted section, use it to split the citation
  if (firstQuote !== -1 && lastQuote !== -1 && lastQuote > firstQuote) {
    const author = cleanAuthor(trimmed.substring(0, firstQuote));
    const title = cleanTitle(trimmed.substring(firstQuote + 1, lastQuote));
    const afterTitle = trimmed.substring(lastQuote + 1);
    const source = cleanSource(afterTitle);

    return { author, title, source };
  }

  const yearBasedCitation = parseYearBasedCitation(trimmed);
  if (yearBasedCitation) {
    return yearBasedCitation;
  }

  const slashEditedBookCitation = parseSlashEditedBookCitation(trimmed);
  if (slashEditedBookCitation) {
    return slashEditedBookCitation;
  }

  // No quotes found — try comma-based splitting as fallback
  const parts = trimmed.split(',').map((p) => p.trim());

  if (parts.length >= 3) {
    return {
      author: parts[0],
      title: parts.slice(1, -1).join(', ').trim(),
      source: parts[parts.length - 1].trim(),
    };
  }

  if (parts.length === 2) {
    return { author: parts[0], title: parts[1], source: '' };
  }

  return { author: '', title: trimmed, source: '' };
}

// ── helpers ──────────────────────────────────────────────────────────

function normalizeCitation(text: string): string {
  return stripTrailingIdentifiers(text.replace(/\s+/gu, ' ').trim());
}

function stripTrailingIdentifiers(text: string): string {
  return text
    .replace(/\s+(?:https?:\/\/\S+|doi:\s*\S+)\s*$/giu, '')
    .trim();
}

function parseYearBasedCitation(citation: string): ParsedCitation | null {
  const match = citation.match(/^(?<author>.+?)\s*\((?<year>\d{4}[a-z]?)\)\.\s*(?<remainder>.+)$/iu);
  if (!match?.groups) {
    return null;
  }

  const author = cleanAuthor(match.groups.author);
  const { title, source } = splitYearBasedRemainder(match.groups.remainder);

  if (!title && !source) {
    return null;
  }

  return { author, title, source };
}

function parseSlashEditedBookCitation(citation: string): ParsedCitation | null {
  const match = citation.match(/^(?<title>.+?)\s*\/\s*edited by\s+(?<remainder>.+)$/iu);
  if (!match?.groups) {
    return null;
  }

  const title = cleanTitle(match.groups.title);
  const remainder = match.groups.remainder.trim();

  let sourceText = remainder.replace(/^.*?\([^)]*\)\.?\s*/u, '').trim();

  if (sourceText === remainder) {
    const lastSentenceBoundary = remainder.lastIndexOf('. ');
    sourceText = lastSentenceBoundary === -1 ? '' : remainder.slice(lastSentenceBoundary + 2).trim();
  }

  return {
    author: '',
    title,
    source: cleanSource(sourceText),
  };
}

function splitYearBasedRemainder(text: string): Pick<ParsedCitation, 'title' | 'source'> {
  const slashEditedBookCitation = parseSlashEditedBookCitation(text);
  if (slashEditedBookCitation) {
    return {
      title: slashEditedBookCitation.title,
      source: slashEditedBookCitation.source,
    };
  }

  const metadataStart = findTrailingMetadataStart(text);
  const remainder = (metadataStart === -1 ? text : text.slice(0, metadataStart))
    .replace(/\s+/gu, ' ')
    .trim();

  const boundary = findTitleSourceBoundary(remainder);
  if (boundary === -1) {
    return {
      title: cleanTitle(remainder),
      source: '',
    };
  }

  const title = cleanTitle(remainder.slice(0, boundary));
  const source = cleanSource(remainder.slice(boundary + 1));

  return { title, source };
}

function findTrailingMetadataStart(text: string): number {
  const metadataPatterns = [
    /,\s*\d[\dA-Za-z/()\-–]*(?:,\s*[\d\-–]+)?\.?\s*$/u,
    /\s+\d[\dA-Za-z/()\-–]*(?:,\s*[\d\-–]+)?\.?\s*$/u,
  ];

  for (const pattern of metadataPatterns) {
    const match = text.match(pattern);
    if (match?.index !== undefined) {
      return match.index;
    }
  }

  return -1;
}

function findTitleSourceBoundary(text: string): number {
  const boundaryPattern = /\.\s+/gu;
  let match: RegExpExecArray | null;

  while ((match = boundaryPattern.exec(text)) !== null) {
    const titleCandidate = text.slice(0, match.index).trim();
    const sourceCandidate = text.slice(match.index + match[0].length).trim();
    const tokenBefore = titleCandidate.split(/\s+/u).pop()?.replace(/[^\p{L}]/gu, '') || '';
    const sourceStartsWithLetter = /^['"\p{L}]/u.test(sourceCandidate);

    if (!sourceStartsWithLetter) {
      continue;
    }

    // Skip abbreviation boundaries such as "J. Neurosci." or "U.S.".
    if (tokenBefore.length <= 1) {
      continue;
    }

    return match.index;
  }

  return -1;
}

/** Clean author text extracted from before the quoted title */
function cleanAuthor(text: string): string {
  const cleaned = text.trim().replace(/[,;:\s]+$/u, '').trim();
  if (hasMultipleAuthors(cleaned)) {
    return '';
  }

  return cleaned.replace(/^&\s+/u, '').trim();
}

function hasMultipleAuthors(text: string): boolean {
  if (/\bet\s+al\.?/iu.test(text)) {
    return true;
  }

  const normalized = text.replace(/\s+/gu, ' ').trim();
  const invertedAuthors = normalized.match(/[^,]+,\s*[^,]+/gu);

  if (invertedAuthors && invertedAuthors.length > 1) {
    return true;
  }

  return /\s(?:&|and)\s/iu.test(normalized);
}

/** Clean up the quoted title text */
function cleanTitle(text: string): string {
  return text.trim().replace(/[,.]\s*$/u, '').trim();
}

/**
 * Extract source (journal name or book title) from text after the quoted title.
 *
 * Example inputs (the text after the closing quote):
 *   ", Example Journal 41 (2013): 154-171."
 *   ", Example Journal 60, 2 (June 2014): 5-28"
 *   ", in Example Editor One and Example Editor Two eds., A Synthetic Book on Modern Topics (Example City: Example University Press, 2000), 37-44"
 *   ". Translated by Example Translator (Example City: Example University Press, 1989), 221-224"
 *   " in Example Discourse: Selected Essays. Translated by Example Translator (Example City: Example University Press, 1989), 221-224"
 */
function cleanSource(text: string): string {
  let cleaned = text.trim();

  // Remove leading punctuation (, . ;)
  cleaned = cleaned.replace(/^[,.\s;]+/u, '').trim();

  // Remove leading "in" (for book chapters)
  cleaned = cleaned.replace(/^in\s+/iu, '').trim();

  // Remove editor info: "Example Editor One and Example Editor Two eds.," or similar
  cleaned = cleaned.replace(/^[^,]*\beds\.?,?\s*/iu, '').trim();

  // Remove "Translated by ..." prefix  (e.g. "Translated by Example Translator.")
  cleaned = cleaned.replace(/^Translated by[^.]+\.\s*/iu, '').trim();

  const publisherInfoIndex = cleaned.indexOf('(');
  let candidate = publisherInfoIndex === -1 ? cleaned : cleaned.slice(0, publisherInfoIndex).trim();

  candidate = candidate
    .replace(SOURCE_METADATA_MARKER_PATTERN, '')
    .trim();

  const source = candidate
    .replace(TRAILING_SOURCE_NUMBERS_PATTERN, '')
    .replace(/[,.:;\s]+$/u, '')
    .trim();

  if (source.length > 1) {
    return source;
  }

  candidate = candidate.replace(/[,.:;\s]+$/u, '').trim();
  if (candidate.length > 1) {
    return candidate;
  }

  // Fallback: strip everything after (year) or page numbers
  cleaned = cleaned
    .replace(/\s*\([^)]*\d{4}[^)]*\).*$/u, '') // Remove (year...) and everything after
    .replace(/\s+\d+.*$/u, '') // Remove numbers and everything after
    .replace(/[,.:;\s]+$/u, '') // Remove trailing punctuation
    .trim();

  return cleaned;
}
