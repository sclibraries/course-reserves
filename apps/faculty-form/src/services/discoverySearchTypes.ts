import type { CitationFieldQuery, CitationSearchResult } from '@course-reserves/citations';

export interface EBSCOItemGroup {
  Label: string;
  Group: string;
  Data: string;
  CleanData: string | string[];
}

export interface EBSCOFullTextLink {
  Category: string;
  Icon: string;
  MouseOverText: string;
  Name: string;
  Text: string;
  Url: string;
}

export interface EDSHoldingCopy {
  Sublocation?: string;
  ShelfLocator?: string;
}

export interface EBSCORecord {
  AccessLevel: string;
  pubType: string;
  PubTypeId: string;
  ResultId: number | string;
  DbId: string;
  DbLabel: string;
  An: string;
  PLink: string;
  PDF?: string;
  HTML?: string;
  FullText?: string;
  ImageInfo?: string | Record<string, string>;
  FullTextCustomLinks?: EBSCOFullTextLink[];
  CustomLinks?: EBSCOFullTextLink[];
  Items: Record<string, EBSCOItemGroup[]>;
  RecordInfo?: {
    BibEntity?: {
      Titles?: Array<{ TitleFull: string; Type: string }>;
      Languages?: Array<{ Code: string; Text: string }>;
      Subjects?: Array<{ SubjectFull: string; Type: string }>;
      Identifiers?: Array<{ Type: string; Value: string }>;
      PhysicalDescription?: unknown;
    };
    BibRelationships?: {
      HasContributorRelationships?: Array<{ NameFull: string }>;
      IsPartOfRelationships?: {
        date?: Array<{ Y: string; M: string; D: string; Type: string }>;
        Identifiers?: Array<{ Type: string; Value: string }>;
        Titles?: Array<{ TitleFull: string; Type: string }>;
        numbering?: Array<{ Type: string; Value: string }>;
      };
    };
  };
  Holdings?: Array<{
    HoldingSimple?: {
      CopyInformationList?: EDSHoldingCopy[];
    };
  }>;
}

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

export interface DiscoverySearchResult extends CitationSearchResult {
  id: string;
  dbId: string;
  authors: string[];
  publicationType: string;
  publicationInfo?: string;
  subjects?: string[];
  abstract?: string;
  isbn?: string;
  issn?: string;
  doi?: string;
  url?: string;
  fullTextUrl?: string;
  callNumber?: string;
  location?: string;
  holdings?: EDSHoldingCopy[];
  database: string;
  pLink: string;
  languages?: string[];
  publicationDate?: { year?: string; month?: string; day?: string };
  journalTitle?: string;
  issueNumber?: string;
  volumeNumber?: string;
  edition?: string;
  publisher?: string;
  fileDescription?: string;
  additionalUrls?: string[];
  fullTextLinks?: EBSCOFullTextLink[];
  hasFullText: boolean;
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
