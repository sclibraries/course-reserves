import { API_ENDPOINTS, DEFAULT_CONFIG } from '@/config/endpoints';
import { getAuthHeaders } from '@/store/authStore';
import { DiscoveryRateLimitError, getDiscoverySearchErrorMessage } from './discoverySearchErrors';
import { parseDiscoveryFacets, parseEBSCORecord, parseEBSCORecords } from './discoveryRecordParser';
import type {
  DiscoverySearchResponse,
  DiscoverySearchResult,
  EBSCOSearchResponse,
  EBSCORecord,
  FieldQuery,
  SearchLimiters,
} from './discoverySearchTypes';

export type {
  DiscoveryFacets,
  DiscoverySearchResult,
  DiscoverySearchResponse,
  EBSCOFullTextLink,
  EBSCORecord,
  FieldQuery,
  SearchLimiters,
} from './discoverySearchTypes';

export async function searchDiscovery(
  query: string | FieldQuery[],
  page = 1,
  queryString?: string,
  limiters?: SearchLimiters,
  appliedLimiters: string[] = []
): Promise<DiscoverySearchResponse> {
  if (!queryString && ((!Array.isArray(query) && !query.trim()) || (Array.isArray(query) && query.length === 0))) {
    return emptySearchResponse();
  }

  const actions = buildSearchActions(page, Boolean(queryString), limiters, appliedLimiters);
  const params = new URLSearchParams();
  params.set('query', queryString || buildQuery(query));
  params.set('includefacets', 'y');
  if (actions.length > 0) params.set('action', actions.join(','));

  const searchUrl = `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.EBSCO_SEARCH}?${params.toString().replace(/\+/g, '%20')}`;
  try {
    const response = await fetch(searchUrl, requestOptions());
    if (!response.ok) throw await discoveryHttpError(response);
    const data: EBSCOSearchResponse = await response.json();
    if (data.status !== 'success' || data.code !== 200) throw new Error('Unable to search the library right now. Please try again.');

    return {
      results: parseEBSCORecords(data.data.records || []),
      totalHits: data.data.statistics.TotalHits,
      searchTime: data.data.statistics.TotalSearchTime,
      queryString: data.data.request.QueryString,
      appliedLimiters: data.data.appliedLimiters?.map((limiter) => limiter.Id) || [],
      facets: parseDiscoveryFacets(data.data.facets),
    };
  } catch (error) {
    console.error('Discovery search failed:', error);
    throw error;
  }
}

export async function retrieveDiscoveryRecord(dbId: string, an: string): Promise<DiscoverySearchResult> {
  const params = new URLSearchParams({ dbId, an });
  const url = `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.EBSCO_RETRIEVE}?${params.toString().replace(/\+/g, '%20')}`;
  const response = await fetch(url, requestOptions());
  if (!response.ok) throw await discoveryHttpError(response);

  const payload = await response.json();
  if (payload?.status !== 'success' || payload?.code !== 200 || !payload?.data?.record) {
    throw new Error('Unable to retrieve this library record right now. Please try again.');
  }
  return parseEBSCORecord(payload.data.record as EBSCORecord);
}

function buildQuery(query: string | FieldQuery[]): string {
  if (!Array.isArray(query)) return query;
  return query.map((part, index) => {
    const operator = index > 0 && part.boolean ? ` ${part.boolean} ` : '';
    const field = part.field ? `${part.field} ` : '';
    return `${operator}${field}(${part.term})`;
  }).join('');
}

function buildSearchActions(page: number, usingQueryString: boolean, limiters?: SearchLimiters, applied: string[] = []): string[] {
  const actions: string[] = [];
  if (usingQueryString && page > 1) actions.push(`GoToPage(${page})`);
  if (!limiters) return actions;

  addLimiterAction(actions, limiters.fullText, applied, 'FT', 'FT:y');
  addLimiterAction(actions, limiters.peerReviewed, applied, 'RV', 'RV:y');
  addLimiterAction(actions, limiters.fiveCollege, applied, 'FC', 'FC:y');
  if (limiters.location && !applied.includes('LB')) actions.push(`addlimiter(LB:Five Colleges Catalog-${limiters.location})`);
  if (limiters.publicationYear && !applied.includes('DT1')) actions.push(`addlimiter(DT1:${limiters.publicationYear})`);
  if (limiters.sourceType) actions.push(`AddFacetFilter(SourceType:${limiters.sourceType})`);
  return actions;
}

function addLimiterAction(actions: string[], enabled: boolean | undefined, applied: string[], id: string, value: string): void {
  if (enabled && !applied.includes(id)) actions.push(`addlimiter(${value})`);
  if (!enabled && applied.includes(id)) actions.push(`removelimiter(${id})`);
}

function requestOptions(): RequestInit {
  return {
    method: 'GET',
    headers: { ...DEFAULT_CONFIG.headers, ...getAuthHeaders() },
    mode: 'cors',
    credentials: 'omit',
  };
}

async function discoveryHttpError(response: Response): Promise<Error> {
  const message = await getDiscoverySearchErrorMessage(response);
  return response.status === 429 ? new DiscoveryRateLimitError(message) : new Error(message);
}

function emptySearchResponse(): DiscoverySearchResponse {
  return {
    results: [], totalHits: 0, searchTime: 0, queryString: '', appliedLimiters: [],
    facets: { sourceTypes: [], publicationYears: [] },
  };
}
