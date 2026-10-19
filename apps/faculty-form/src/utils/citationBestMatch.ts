import type { DiscoverySearchResult } from '@/services/discoverySearchService';

const STOP_WORDS = new Set(['a', 'an', 'and', 'at', 'from', 'in', 'of', 'on', 'the', 'to']);

export interface CitationBestMatch {
  best: DiscoverySearchResult | undefined;
  others: DiscoverySearchResult[];
}

export function findCitationBestMatch(citationText: string, results: DiscoverySearchResult[]): CitationBestMatch {
  if (results.length === 0) return { best: undefined, others: [] };

  const citationWords = new Set(normalizeWords(extractCitationTitle(citationText)));
  let bestIndex = 0;
  let bestScore = -1;

  results.forEach((result, index) => {
    const resultWords = new Set(normalizeWords(result.title));
    const score = calculateWordOverlap(citationWords, resultWords);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return {
    best: results[bestIndex],
    others: results.filter((_, index) => index !== bestIndex),
  };
}

function extractCitationTitle(citationText: string): string {
  const quotedTitle = citationText.match(/“([^”]+)”|"([^"]+)"/u);
  return (quotedTitle?.[1] || quotedTitle?.[2] || citationText.split('.', 1)[0]).trim();
}

function normalizeWords(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));
}

function calculateWordOverlap(left: Set<string>, right: Set<string>): number {
  const unionSize = new Set([...left, ...right]).size;
  if (unionSize === 0) return 0;

  let sharedWords = 0;
  left.forEach((word) => {
    if (right.has(word)) sharedWords += 1;
  });
  return sharedWords / unionSize;
}
