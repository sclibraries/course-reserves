import type {
  DiscoverySearchResult,
  FieldQuery,
  SearchLimiters,
} from '@/services/discoverySearchService';

import { parseCitation, type ParsedCitation } from './citationParser';
import { extractCitationsFromSyllabus } from './syllabusCitationExtractor';

export interface CitationSearchStrategy {
  fieldQueries: FieldQuery[];
  builtQuery: string;
  queryToSearch: string | FieldQuery[];
}

export interface PreparedCitationSearch {
  id: string;
  rawCitation: string;
  parsedCitation: ParsedCitation;
  fieldQueries: FieldQuery[];
  builtQuery: string;
  queryToSearch: string | FieldQuery[];
  queryStrategies: CitationSearchStrategy[];
}

export interface CitationBatchSearchGroup extends PreparedCitationSearch {
  results: DiscoverySearchResult[];
  totalHits: number;
  searchTime: number;
  attemptedQueries: string[];
  matchedQuery: string;
  error?: string;
}

export interface CitationBatchSearchOptions {
  onProgress?: (completed: number, total: number) => void;
  wait?: (milliseconds: number) => Promise<void>;
}

const MAX_CONCURRENT_CITATIONS = 3;
const RATE_LIMIT_BACKOFF_MS = [250, 500];

type SearchDiscoveryLike = (
  query: string | FieldQuery[],
  page?: number,
  queryString?: string,
  limiters?: SearchLimiters,
  appliedLimiters?: string[]
) => Promise<{
  results: DiscoverySearchResult[];
  totalHits: number;
  searchTime: number;
  queryString: string;
  appliedLimiters: string[];
}>;

export function prepareCitationBatchSearches(rawText: string): PreparedCitationSearch[] {
  return prepareCitationSearches(extractCitationsFromSyllabus(rawText).citations);
}

export function prepareCitationSearches(citations: string[], ids?: string[]): PreparedCitationSearch[] {
  return citations.map((rawCitation, index) => {
    const parsedCitation = parseCitation(rawCitation);
    const queryStrategies = buildCitationQueryStrategies(parsedCitation, rawCitation);
    const primaryStrategy = queryStrategies[0];

    return {
      id: ids?.[index] || `citation-${index + 1}`,
      rawCitation,
      parsedCitation,
      fieldQueries: primaryStrategy.fieldQueries,
      builtQuery: primaryStrategy.builtQuery,
      queryToSearch: primaryStrategy.queryToSearch,
      queryStrategies,
    };
  });
}

export async function executeCitationBatchSearch(
  searches: PreparedCitationSearch[],
  searchFn: SearchDiscoveryLike,
  limiters?: SearchLimiters,
  options: CitationBatchSearchOptions = {}
): Promise<CitationBatchSearchGroup[]> {
  const groups = new Array<CitationBatchSearchGroup>(searches.length);
  let nextSearchIndex = 0;
  let completed = 0;
  const wait = options.wait || delay;

  const worker = async () => {
    while (nextSearchIndex < searches.length) {
      const index = nextSearchIndex;
      nextSearchIndex += 1;
      groups[index] = await executeOneCitationSearch(searches[index], searchFn, limiters, wait);
      completed += 1;
      options.onProgress?.(completed, searches.length);
    }
  };

  await Promise.all(Array.from(
    { length: Math.min(MAX_CONCURRENT_CITATIONS, searches.length) },
    () => worker()
  ));
  return groups;
}

async function executeOneCitationSearch(
  search: PreparedCitationSearch,
  searchFn: SearchDiscoveryLike,
  limiters: SearchLimiters | undefined,
  wait: (milliseconds: number) => Promise<void>
): Promise<CitationBatchSearchGroup> {
  const attemptedQueries: string[] = [];

  try {
    for (const strategy of search.queryStrategies) {
      attemptedQueries.push(strategy.builtQuery);
      const response = await searchWithRateLimitBackoff(strategy, searchFn, limiters, wait);
      const hasMatches = response.totalHits > 0 || response.results.length > 0;
      const isLastStrategy = strategy === search.queryStrategies[search.queryStrategies.length - 1];

      if (hasMatches || isLastStrategy) {
        return {
          ...search,
          fieldQueries: strategy.fieldQueries,
          builtQuery: search.queryStrategies[0]?.builtQuery || search.builtQuery,
          queryToSearch: strategy.queryToSearch,
          results: response.results,
          totalHits: response.totalHits,
          searchTime: response.searchTime,
          attemptedQueries,
          matchedQuery: strategy.builtQuery,
        };
      }
    }
  } catch (error) {
    return {
      ...search,
      results: [],
      totalHits: 0,
      searchTime: 0,
      attemptedQueries,
      matchedQuery: search.queryStrategies[0]?.builtQuery || search.builtQuery,
      error: error instanceof Error ? error.message : 'Search failed',
    };
  }

  return {
    ...search,
    results: [],
    totalHits: 0,
    searchTime: 0,
    attemptedQueries,
    matchedQuery: search.queryStrategies[0]?.builtQuery || search.builtQuery,
  };
}

async function searchWithRateLimitBackoff(
  strategy: CitationSearchStrategy,
  searchFn: SearchDiscoveryLike,
  limiters: SearchLimiters | undefined,
  wait: (milliseconds: number) => Promise<void>
) {
  let retries = 0;
  while (true) {
    try {
      return await searchFn(strategy.queryToSearch, 1, undefined, limiters, undefined);
    } catch (error) {
      const isRateLimited = typeof error === 'object' && error !== null && 'status' in error && error.status === 429;
      if (!isRateLimited || retries >= RATE_LIMIT_BACKOFF_MS.length) throw error;
      await wait(RATE_LIMIT_BACKOFF_MS[retries]);
      retries += 1;
    }
  }
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function buildCitationQueryStrategies(parsedCitation: ParsedCitation, rawCitation: string): CitationSearchStrategy[] {
  const strategies: CitationSearchStrategy[] = [];
  const seenQueries = new Set<string>();
  const doi = extractDoi(rawCitation);

  const addStrategy = (fieldDefinitions: Array<{ field: string; term: string }>) => {
    const populatedFields = fieldDefinitions.filter((definition) => definition.term.trim().length > 0);
    if (populatedFields.length === 0) {
      return;
    }

    const fieldQueries = populatedFields.map((definition, index) => ({
      field: definition.field,
      term: definition.term.trim(),
      boolean: index > 0 ? 'AND' as const : undefined,
    }));

    const builtQuery = fieldQueries
      .map((query, index) => {
        const prefix = index > 0 && query.boolean ? `${query.boolean} ` : '';
        return `${prefix}${query.field} (${query.term})`;
      })
      .join(' ');

    if (!builtQuery || seenQueries.has(builtQuery)) {
      return;
    }

    seenQueries.add(builtQuery);
    strategies.push({
      fieldQueries,
      builtQuery,
      queryToSearch: fieldQueries,
    });
  };

  addStrategy([
    { field: 'AU', term: parsedCitation.author },
    { field: 'TI', term: parsedCitation.title },
    { field: 'SO', term: parsedCitation.source },
  ]);

  addStrategy([
    { field: 'TI', term: parsedCitation.title },
    { field: 'SO', term: parsedCitation.source },
  ]);

  if (doi && !seenQueries.has(`DOI (${doi})`)) {
    seenQueries.add(`DOI (${doi})`);
    strategies.push({
      fieldQueries: [],
      builtQuery: `DOI (${doi})`,
      queryToSearch: doi,
    });
  }

  addStrategy([
    { field: 'TI', term: parsedCitation.title },
  ]);

  if (strategies.length === 0) {
    strategies.push({
      fieldQueries: [],
      builtQuery: rawCitation,
      queryToSearch: rawCitation,
    });
  }

  return strategies;
}

function extractDoi(text: string): string | null {
  const doiMatch = text.match(/(?:https?:\/\/doi\.org\/|doi:\s*|\b)(10\.\d{4,9}\/[A-Za-z0-9._;()/:-]+)(?=$|\s)/iu);
  return doiMatch?.[1] ?? null;
}
