const HEADER_PATTERN = /^(Textbook|Introduction|Tort Law|Contract Law|Property Law|Intellectual Property|Environmental Law|Legal Procedure|Free Speech|Reserves for|The Economics of|Reading[s]?:?|Required|Optional|Recommended|Syllabus|Course Materials|ECO \d+|ECON \d+|LAW \d+|Spring \d+|Fall \d+|Week \d+)s?\b/iu;
const COPYRIGHT_PATTERN = /^©|^Copyright/iu;
const JUNK_SUFFIX_PATTERN = /\s+(MN|paged|request|stacks|e-?book|acquisitions|acq|physical|item|link up|available online)\s*$/giu;
const ACADEMIC_MARKER_PATTERN = /(?:^|[\s,;:])(?:vol|pp|no|journal|chapter|press|ed|eds|issue|pages?)\.?(?=[\s,;:]|$)/iu;
const INLINE_CITATION_BOUNDARY_PATTERN = /(?<=[.;])\s+(?=(?:[\p{L}][\p{L}\p{M}'’-]+,\s+[\p{L}]|[\p{L}][\p{L}\p{M}'’.-]+(?:\s+[\p{L}][\p{L}\p{M}'’.-]+)+,\s*["“”]|In\s+re\s+[\p{Lu}]|Ex\s+parte\s+[\p{Lu}]|U\.?S\.?\s+v\.|[\p{Lu}][\p{L}\p{M}\s.'’-]+\s+v\.\s+[\p{Lu}]|\d+\s+[A-Z][\w.]+\s+\d+))/u;
const AUTHOR_FIRST_PATTERN = /^[\p{L}][\p{L}\p{M}'’.-]+(?:\s+[\p{L}][\p{L}\p{M}'’.-]+)+,/u;
const AUTHOR_FIRST_QUOTED_PATTERN = /^[\p{L}][\p{L}\p{M}'’.-]+(?:\s+[\p{L}][\p{L}\p{M}'’.-]+)+,\s*["“”]/u;
const INVERTED_AUTHOR_PATTERN = /^[\p{L}][\p{L}\p{M}'’-]+,\s+[\p{L}][\p{L}\p{M}'’.-]*(?:\s+[\p{L}][\p{L}\p{M}'’.-]*)*/u;
const QUOTED_TITLE_PATTERN = /["“”][^"“”]+["“”]/u;
const EDITOR_PATTERN = /(?:\bedited\s+by\b|\beds?\.(?=[\s,;:]|$))/iu;
const PUBLISHER_PATTERN = /\b(?:university\s+press|press|publishing)\b/iu;
const PAGE_RANGE_PATTERN = /\b(?:pp?\.?\s*)?\d+\s*[-–—]\s*\d+\b/iu;

export interface CitationExtractionResult {
  citations: string[];
  skipped: string[];
}

export function extractCitationsFromSyllabus(syllabusText: string): CitationExtractionResult {
  const rawText = syllabusText.trim();

  if (!rawText) {
    return { citations: [], skipped: [] };
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
    if (looksLikeCitation(text)) result.citations.push(text);
    else if (block.trim()) result.skipped.push(text || block.trim());
    return result;
  }, { citations: [], skipped: [] });
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

    if (HEADER_PATTERN.test(line) || COPYRIGHT_PATTERN.test(line)) {
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
  if (!text || text.length < 15 || HEADER_PATTERN.test(text)) {
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
