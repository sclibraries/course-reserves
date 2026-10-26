import type { CitationFieldQuery } from '@course-reserves/citations';
import type { DiscoverySearchResult, EBSCORecord } from '@course-reserves/citations';

export type {
  DiscoverySearchResult,
  EBSCOFullTextLink,
  EBSCOItemGroup,
  EBSCORecord,
  EDSHoldingCopy,
} from '@course-reserves/citations';

export interface EBSCOSearchResponse {
  status: string;
  code: number;
  data: {
    request: { QueryString: string };
    statistics: { TotalHits: number; TotalSearchTime: number };
    records: EBSCORecord[];
    facets?: unknown[];
    appliedLimiters?: Array<{ Id: string }>;
  };
}

export interface DiscoveryFacets {
  sourceTypes: string[];
  publicationYears: string[];
}

export interface DiscoverySearchResponse {
  results: DiscoverySearchResult[];
  totalHits: number;
  searchTime: number;
  queryString: string;
  appliedLimiters: string[];
  facets: DiscoveryFacets;
}

export interface SearchLimiters {
  fullText?: boolean;
  peerReviewed?: boolean;
  fiveCollege?: boolean;
  location?: string;
  sourceType?: string;
  publicationYear?: string;
}

export type FieldQuery = CitationFieldQuery;
