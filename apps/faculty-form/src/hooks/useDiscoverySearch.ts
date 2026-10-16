import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchDiscovery } from '@/services/discoverySearchService';
import type { DiscoveryFacets, DiscoverySearchResult, SearchLimiters } from '@/services/discoverySearchService';

const emptyFacets: DiscoveryFacets = { sourceTypes: [], publicationYears: [] };

export function useDiscoverySearch({ enabled = true }: { enabled?: boolean } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const filterKey = JSON.stringify(filters);
  const searchKey = `${query}\n${filterKey}`;
  const [results, setResults] = useState<DiscoverySearchResult[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [searchTime, setSearchTime] = useState(0);
  const [facets, setFacets] = useState(emptyFacets);
  const [queryString, setQueryString] = useState('');
  const [appliedLimiters, setAppliedLimiters] = useState<string[]>([]);
  const [loadedPage, setLoadedPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localPageChange = useRef(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    if (localPageChange.current) {
      localPageChange.current = false;
      return undefined;
    }
    let cancelled = false;
    if (!query.trim()) {
      setResults([]);
      setTotalHits(0);
      setFacets(emptyFacets);
      setQueryString('');
      setAppliedLimiters([]);
      setLoadedPage(0);
      setError(null);
      setLoading(false);
      return undefined;
    }

    const loadPages = async () => {
      setLoading(true);
      setError(null);
      setResults([]);
      setLoadedPage(0);
      try {
        const firstPage = await searchDiscovery(query, 1, undefined, filters);
        let allResults = firstPage.results;
        let response = firstPage;
        let currentPage = 1;
        while (currentPage < page && allResults.length < firstPage.totalHits) {
          response = await searchDiscovery(query, currentPage + 1, response.queryString, filters, response.appliedLimiters);
          allResults = [...allResults, ...response.results];
          currentPage += 1;
        }
        if (cancelled) return;
        setResults(allResults);
        setTotalHits(firstPage.totalHits);
        setSearchTime(firstPage.searchTime);
        setFacets(firstPage.facets || emptyFacets);
        setQueryString(firstPage.queryString);
        setAppliedLimiters(response.appliedLimiters);
        setLoadedPage(currentPage);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Unable to search the library right now. Please try again.');
          setResults([]);
          setTotalHits(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadPages();
    return () => { cancelled = true; };
  }, [searchKey, page, enabled, query, filters]);

  const updateParams = useCallback((updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const setQuery = useCallback((value: string) => {
    updateParams({ q: value.trim() || undefined, page: undefined });
  }, [updateParams]);

  const setFilter = useCallback((key: keyof SearchLimiters, value: boolean | string | undefined) => {
    const param = filterParams[key];
    const serialized = typeof value === 'boolean' ? (value ? '1' : undefined) : value;
    updateParams({ [param]: serialized, page: undefined });
  }, [updateParams]);

  const loadMore = useCallback(async () => {
    if (!query || loadingMoreRef.current || loadedPage < 1 || results.length >= totalHits) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = loadedPage + 1;
    try {
      const response = await searchDiscovery(query, nextPage, queryString, filters, appliedLimiters);
      setResults((current) => [...current, ...response.results]);
      setLoadedPage(nextPage);
      setQueryString(response.queryString || queryString);
      setTotalHits(response.totalHits);
      setSearchTime(response.searchTime);
      localPageChange.current = true;
      updateParams({ page: String(nextPage) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load more library results. Please try again.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [query, loadedPage, results.length, totalHits, queryString, filters, appliedLimiters, updateParams]);

  return {
    query, page, filters, results, totalHits, searchTime, facets, loading, loadingMore, error,
    hasMore: results.length < totalHits, setQuery, setFilter, loadMore,
  };
}

function parseFilters(params: URLSearchParams): SearchLimiters {
  return {
    fullText: params.get('ft') === '1',
    peerReviewed: params.get('rv') === '1',
    fiveCollege: params.get('fc') === '1',
    location: params.get('loc') || undefined,
    sourceType: params.get('type') || undefined,
    publicationYear: params.get('year') || undefined,
  };
}

const filterParams: Record<keyof SearchLimiters, string> = {
  fullText: 'ft',
  peerReviewed: 'rv',
  fiveCollege: 'fc',
  location: 'loc',
  sourceType: 'type',
  publicationYear: 'year',
};
