const HEADER_PATTERN = /^.{1,80}$/u;
const COPYRIGHT_PATTERN = /^©|^Copyright/iu;
const JUNK_SUFFIX_PATTERN = /\s+(MN|paged|request|stacks|e-?book|acquisitions|acq|physical|item|link up|available online)\s*$/giu;
const ACADEMIC_MARKER_PATTERN = /(?:^|[\s,;:])(?:vol|pp|no|journal|chapter|press|ed|eds|issue|pages?)\.?(?=[\s,;:]|$)/iu;
const CITATION_MARKER_PATTERN = /["“”]|\b[12]\d{3}\b|https?:\/\/|\b(?:pp?|vol|no|issue|pages?|eds?)\.?\b|\d+\s*[-–—]\s*\d+|\b(?:university\s+press|press|publishing)\b/iu;
const INLINE_CITATION_BOUNDARY_PATTERN = /(?<=[.;])\s+(?=(?:[\p{L}][\p{L}\p{M}'’-]+,\s+[\p{L}]|[\p{L}][\p{L}\p{M}'’.-]+(?:\s+[\p{L}][\p{L}\p{M}'’.-]+)+,\s*["“”]|In\s+re\s+[\p{Lu}]|Ex\s+parte\s+[\p{Lu}]|U\.?S\.?\s+v\.|[\p{Lu}][\p{L}\p{M}\s.'’-]+\s+v\.\s+[\p{Lu}]|\d+\s+[A-Z][\w.]+\s+\d+))/u;
const AUTHOR_FIRST_PATTERN = /^[\p{L}][\p{L}\p{M}'’.-]+(?:\s+[\p{L}][\p{L}\p{M}'’.-]+)+,/u;
const AUTHOR_FIRST_QUOTED_PATTERN = /^[\p{L}][\p{L}\p{M}'’.-]+(?:\s+[\p{L}][\p{L}\p{M}'’.-]+)+,\s*["“”]/u;
const INVERTED_AUTHOR_PATTERN = /^[\p{L}][\p{L}\p{M}'’-]+,\s+[\p{L}][\p{L}\p{M}'’.-]*(?:\s+[\p{L}][\p{L}\p{M}'’.-]*)*/u;
const QUOTED_TITLE_PATTERN = /["“”][^"“”]+["“”]/u;
const EDITOR_PATTERN = /(?:\bedited\s+by\b|\beds?\.(?=[\s,;:]|$))/iu;
const PUBLISHER_PATTERN = /\b(?:university\s+press|press|publishing)\b/iu;
const PAGE_RANGE_PATTERN = /\b(?:pp?\.?\s*)?\d+\s*[-–—]\s*\d+\b/iu;
const URL_PATTERN = /https?:\/\/[^\s\]]+/iu;
const BRACKETED_URL_PATTERN = /^(?<text>.+?)\s*\[(?<url>https?:\/\/[^\]]+)\]\s*$/iu;
const MEDIA_PATTERN = /^(?:Film\s*:|.*\(\s*film\s*\))/iu;

export interface SyllabusEntry {
  text: string;
  heading: string | null;
  type: 'citation' | 'media' | 'web';
  url: string | null;
}

export interface CitationExtractionResult {
  citations: string[];
  skipped: string[];
  entries: SyllabusEntry[];
}

export function extractCitationsFromSyllabus(syllabusText: string): CitationExtractionResult {
  const rawText = syllabusText.trim();

  if (!rawText) {
    return { citations: [], skipped: [] };
  }

  const lines = rawText.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1 && isOneEntryPerLineDocument(lines)) {
    return extractOneEntryPerLine(lines);
  }

  let candidateBlocks = extractLineBasedBlocks(rawText);

  if (candidateBlocks.length <= 1 && rawText.length > 100) {
    const inlineSplitCitations = extractInlineCitations(rawText);

    if (inlineSplitCitations.length > candidateBlocks.length) {
      candidateBlocks = inlineSplitCitations;
    }
  }

  return candidateBlocks.reduce<CitationExtractionResult>((result, block) => {
    const text = cleanCitationText(block);
    if (looksLikeCitation(text)) {
      result.citations.push(text);
      result.entries.push({ text, heading: null, type: 'citation', url: findUrl(text) });
    }
    else if (block.trim()) result.skipped.push(text || block.trim());
    return result;
  }, { citations: [], skipped: [], entries: [] });
}

function isOneEntryPerLineDocument(lines: string[]): boolean {
  return lines.filter(isEntryLine).length > lines.length / 2;
}

function isEntryLine(line: string): boolean {
  return MEDIA_PATTERN.test(line)
    || Boolean(BRACKETED_URL_PATTERN.test(line))
    || (looksLikeCitation(line) && startsNewCitation(line) && !isContinuation(line));
}

function extractOneEntryPerLine(lines: string[]): CitationExtractionResult {
  const result: CitationExtractionResult = { citations: [], skipped: [], entries: [] };
  let heading: string | null = null;

  lines.forEach((line, index) => {
    if (isShortHeader(line) && isEntryLine(lines[index + 1] || '')) {
      heading = line;
      return;
    }

    const entry = extractEntry(line, heading);
    if (!entry) {
      result.skipped.push(cleanCitationText(line) || line);
      return;
    }

    result.entries.push(entry);
    if (entry.type === 'citation') result.citations.push(entry.text);
  });

  return result;
}

function extractEntry(line: string, heading: string | null): SyllabusEntry | null {
  if (MEDIA_PATTERN.test(line)) {
    const url = findUrl(line);
    const text = line
      .replace(/^Film\s*:\s*/iu, '')
      .replace(/\(\s*film\s*\)/giu, '')
      .replace(/\s*\[https?:\/\/[^\]]+\]/giu, '')
      .replace(/https?:\/\/\S+/giu, '')
      .replace(/\s+-\s+.*$/u, '')
      .trim();
    return { text, heading, type: 'media', url };
  }

  const web = line.match(BRACKETED_URL_PATTERN);
  if (web?.groups) {
    return { text: web.groups.text.trim(), heading, type: 'web', url: web.groups.url };
  }

  if (looksLikeCitation(line)) {
    const text = cleanCitationText(line);
    return { text, heading, type: 'citation', url: findUrl(text) };
  }

  return null;
}

function findUrl(text: string): string | null {
  return text.match(URL_PATTERN)?.[0] || null;
}

function isShortHeader(line: string): boolean {
  return HEADER_PATTERN.test(line) && !CITATION_MARKER_PATTERN.test(line);
}

function extractLineBasedBlocks(rawText: string): string[] {
  const lines = rawText.split('\n');
  const blocks: string[] = [];
  let currentCitation = '';

  const pushCurrent = () => {
    if (!currentCitation) return;
    blocks.push(currentCitation.trim());
    currentCitation = '';
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      pushCurrent();
      continue;
    }

    if (isShortHeader(line) || COPYRIGHT_PATTERN.test(line)) {
      pushCurrent();
      blocks.push(line);
      continue;
    }

    if (currentCitation && startsNewCitation(line) && !isContinuation(line) && looksLikeCitation(cleanCitationText(currentCitation))) {
      pushCurrent();
      currentCitation = line;
      continue;
    }

    currentCitation = currentCitation ? `${currentCitation} ${line}` : line;
  }

  pushCurrent();

  return blocks;
}

function extractInlineCitations(rawText: string): string[] {
  const normalizedText = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');

  const segments = normalizedText
    .split(INLINE_CITATION_BOUNDARY_PATTERN)
    .map((citation) => citation.trim())
    .filter(Boolean);

  return mergeBrokenContributorSegments(segments);
}

function mergeBrokenContributorSegments(segments: string[]): string[] {
  const merged: string[] = [];

  for (const segment of segments) {
    const previousSegment = merged[merged.length - 1];

    if (previousSegment && shouldMergeContributorSegment(previousSegment, segment)) {
      merged[merged.length - 1] = `${previousSegment} ${segment}`.trim();
      continue;
    }

    merged.push(segment);
  }

  return merged;
}

function shouldMergeContributorSegment(previousSegment: string, currentSegment: string): boolean {
  return /\/\s*edited by\b.*\b[\p{Lu}]\.$/iu.test(previousSegment)
    && INVERTED_AUTHOR_PATTERN.test(currentSegment);
}

function looksLikeCitation(text: string): boolean {
  if (!text || text.length < 15 || isShortHeader(text)) {
    return false;
  }

  return isLegalCitation(text) || hasYearDatedAcademicEvidence(text) || hasYearlessBibliographicEvidence(text);
}

function isLegalCitation(text: string): boolean {
  const hasLegalCase = /\bv\.\s+[A-Z]/iu.test(text);
  const hasLegalReporter = /\b\d+\s+[A-Z][a-zA-Z.]+\s+\d+\b/u.test(text);
  return hasLegalCase || hasLegalReporter;
}

function hasYearDatedAcademicEvidence(text: string): boolean {
  const hasYear = /\b[12]\d{3}\b/u.test(text);
  const hasYearInParens = /\([12]\d{3}\)/u.test(text);
  if (hasYearInParens) return true;
  if (!hasYear) return false;

  return ACADEMIC_MARKER_PATTERN.test(text) ||
    INVERTED_AUTHOR_PATTERN.test(text) ||
    (AUTHOR_FIRST_PATTERN.test(text) && QUOTED_TITLE_PATTERN.test(text));
}

function hasYearlessBibliographicEvidence(text: string): boolean {
  const hasAuthor = INVERTED_AUTHOR_PATTERN.test(text) || AUTHOR_FIRST_PATTERN.test(text);
  const hasBibliographicSignal = QUOTED_TITLE_PATTERN.test(text) ||
    EDITOR_PATTERN.test(text) ||
    PUBLISHER_PATTERN.test(text) ||
    PAGE_RANGE_PATTERN.test(text);

  return hasAuthor && hasBibliographicSignal;
}

function startsNewCitation(line: string): boolean {
  const hasLegalCaseStart = (
    /^[A-Z][\w\s.''-]+\s+v\.\s+[A-Z]/iu.test(line) ||
    /^In\s+re\s+[A-Z]/iu.test(line) ||
    /^Ex\s+parte\s+[A-Z]/iu.test(line) ||
    /^U\.?S\.?\s+v\./iu.test(line) ||
    /^\d+\s+[A-Z][\w.]+\s+\d+/u.test(line)
  );

  const hasAcademicStart = (
    INVERTED_AUTHOR_PATTERN.test(line) ||
    /^[\p{Lu}][\p{L}\p{M}'’-]+\s+[\p{Lu}][\p{L}\p{M}'’-]+\s+\([12]\d{3}\)/u.test(line)
  );
  const hasQuotedAcademicStart = AUTHOR_FIRST_QUOTED_PATTERN.test(line);

  const hasYearStart = /^[12]\d{3}\b/u.test(line);

  return hasLegalCaseStart || hasAcademicStart || hasQuotedAcademicStart || hasYearStart;
}

function isContinuation(line: string): boolean {
  return (
    /^[a-z]/u.test(line) ||
    /^Vol\.|^pp\.|^No\.|^Issue|^Pages|^Journal/iu.test(line) ||
    /^[,;:]/u.test(line) ||
    /^(and|the|of|in|on|at|by|for|with|from)\s/iu.test(line)
  );
}

function cleanCitationText(text: string): string {
  return text
    .replace(/\s*©\s*\d{4}.*$/gu, '')
    .replace(JUNK_SUFFIX_PATTERN, '')
    .replace(/\s{2,}/gu, ' ')
    .replace(/\s+([.,;)])/gu, '$1')
    .trim();
}
