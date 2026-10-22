import { parseCitation, type ParsedCitation } from './citationParser';
import { extractCitationsFromSyllabus } from './syllabusCitationExtractor';

export interface CitationSearchResult {
  title: string;
}

export interface CitationFieldQuery {
  field?: string;
  term: string;
  boolean?: 'AND' | 'OR' | 'NOT';
}

export interface CitationSearchResponse<TResult extends CitationSearchResult> {
  results: TResult[];
  totalHits: number;
  searchTime: number;
}

export interface CitationSearchStrategy {
  fieldQueries: CitationFieldQuery[];
  builtQuery: string;
  queryToSearch: string | CitationFieldQuery[];
}

export interface PreparedCitationSearch {
  id: string;
  rawCitation: string;
  parsedCitation: ParsedCitation;
  fieldQueries: CitationFieldQuery[];
  builtQuery: string;
  queryToSearch: string | CitationFieldQuery[];
  queryStrategies: CitationSearchStrategy[];
}

export interface CitationBatchSearchGroup<TResult extends CitationSearchResult = CitationSearchResult> extends PreparedCitationSearch {
  results: TResult[];
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

type SearchDiscoveryLike<TResult extends CitationSearchResult, TLimiters> = (
  query: string | CitationFieldQuery[],
  page?: number,
  queryString?: string,
  limiters?: TLimiters,
  appliedLimiters?: string[]
) => Promise<CitationSearchResponse<TResult>>;

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

export async function executeCitationBatchSearch<TResult extends CitationSearchResult, TLimiters = undefined>(
  searches: PreparedCitationSearch[],
  searchFn: SearchDiscoveryLike<TResult, TLimiters>,
  limiters?: TLimiters,
  options: CitationBatchSearchOptions = {}
): Promise<CitationBatchSearchGroup<TResult>[]> {
  const groups = new Array<CitationBatchSearchGroup<TResult>>(searches.length);
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

async function executeOneCitationSearch<TResult extends CitationSearchResult, TLimiters>(
  search: PreparedCitationSearch,
  searchFn: SearchDiscoveryLike<TResult, TLimiters>,
  limiters: TLimiters | undefined,
  wait: (milliseconds: number) => Promise<void>
): Promise<CitationBatchSearchGroup<TResult>> {
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

async function searchWithRateLimitBackoff<TResult extends CitationSearchResult, TLimiters>(
  strategy: CitationSearchStrategy,
  searchFn: SearchDiscoveryLike<TResult, TLimiters>,
  limiters: TLimiters | undefined,
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
