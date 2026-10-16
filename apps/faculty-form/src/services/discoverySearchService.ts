import { API_ENDPOINTS, DEFAULT_CONFIG } from '@/config/endpoints';
import { getAuthHeaders } from '@/store/authStore';
import { getDiscoverySearchErrorMessage } from './discoverySearchErrors';
// Types based on the new improved EBSCO API response structure
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

export interface EBSCORecord {
  AccessLevel: string;
  pubType: string;
  PubTypeId: string;
  ResultId: number;
  DbId: string;
  DbLabel: string;
  An: string;
  PLink: string;
  PDF: string;
  HTML: string;
  FullText: string;
  ImageInfo: string;
  FullTextCustomLinks?: EBSCOFullTextLink[];
  Items: {
    Ti?: EBSCOItemGroup[];
    Au?: EBSCOItemGroup[];
    Src?: EBSCOItemGroup[];
    Su?: EBSCOItemGroup[];
    Ab?: EBSCOItemGroup[];
    SrcInfo?: EBSCOItemGroup[];
    URL?: EBSCOItemGroup[];
  };
  RecordInfo?: {
    BibEntity?: {
      Titles?: Array<{ TitleFull: string; Type: string }>;
      Languages?: Array<{ Code: string; Text: string }>;
      Subjects?: Array<{ SubjectFull: string; Type: string }>;
      Identifiers?: Array<{ Type: string; Value: string }>;
      PhysicalDescription?: unknown[];
    };
    BibRelationships?: {
      HasContributorRelationships?: Array<{
        NameFull: string;
      }>;
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
      CopyInformationList?: Array<{
        Sublocation: string;
        ShelfLocator: string;
      }>;
    };
  }>;
}

export interface EBSCOSearchResponse {
  status: string;
  code: number;
  data: {
    request: {
      QueryString: string;
      SearchCriteriaWithActions: {
        QueriesWithAction: Array<{
          Query: { BooleanOperator: string; Term: string };
          RemoveAction: string;
        }>;
      };
    };
    statistics: {
      TotalHits: number;
      TotalSearchTime: number;
    };
    recordFormat: string;
    records: EBSCORecord[];
    facets: unknown[];
    availableCriteria: unknown[];
    appliedLimiters?: Array<{
      Id: string;
      LimiterValue: { Value: string; RemoveAction: string };
      RemoveAction: string;
    }>;
  };
}

// Simplified item format for our UI
export interface DiscoverySearchResult {
  id: string;
  title: string;
  authors: string[];
  publicationType: string;
  publicationInfo?: string;
  subjects?: string[];
  abstract?: string;
  isbn?: string;
  issn?: string;
  doi?: string;
  url?: string;
  fullTextUrl?: string; // Priority URL from FullTextCustomLinks
  callNumber?: string;
  location?: string;
  database: string;
  pLink: string;
  // Enhanced metadata
  languages?: string[];
  publicationDate?: {
    year?: string;
    month?: string;
    day?: string;
  };
  journalTitle?: string;
  issueNumber?: string;
  volumeNumber?: string;
  fileDescription?: string;
  additionalUrls?: string[];
  hasFullText: boolean; // Whether FullTextCustomLinks is available
}

/**
 * Limiter configuration
 */
export interface SearchLimiters {
  fullText?: boolean;        // FT:y
  peerReviewed?: boolean;    // RV:y
  fiveCollege?: boolean;     // FC:y
  location?: string;         // LB3:[LOCATION]
}

/**
 * Field-based query for EBSCO (e.g., AU:Author, TI:Title, SO:Source)
 */
export interface FieldQuery {
  field?: string;      // Field code (AU, TI, SO, etc.) - optional, searches all if omitted
  term: string;        // Search term
  boolean?: 'AND' | 'OR' | 'NOT';  // Boolean operator (optional for first query)
}

/**
 * Search the library's EBSCO Discovery Service
 */
export async function searchDiscovery(
  query: string | FieldQuery[],
  page: number = 1,
  queryString?: string, // Use QueryString from previous search for pagination
  limiters?: SearchLimiters,
  appliedLimiters?: string[] // Array of limiter IDs currently applied (from EBSCO response)
): Promise<{
  results: DiscoverySearchResult[];
  totalHits: number;
  searchTime: number;
  queryString: string;
  appliedLimiters: string[];
}> {
  const isFieldQuery = Array.isArray(query);
  
  if (!queryString) {
    // Validate simple query
    if (!isFieldQuery && !query.trim()) {
      return { results: [], totalHits: 0, searchTime: 0, queryString: '', appliedLimiters: [] };
    }
    // Validate field queries
    if (isFieldQuery && query.length === 0) {
      return { results: [], totalHits: 0, searchTime: 0, queryString: '', appliedLimiters: [] };
    }
  }

  let searchUrl = `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.EBSCO_SEARCH}`;
  
  // Use queryString if provided (for limiter changes), otherwise build query
  if (queryString) {
    // Using QueryString from EBSCO (for limiter changes or pagination)
    searchUrl += `?query=${queryString}`;
    // Add GoToPage action only if page > 1
    if (page > 1) {
      searchUrl += `&action=GoToPage(${page})`;
    }
  } else if (isFieldQuery) {
    // Build field-based query as single query parameter
    // Format: query=TI (term) AND AU (term) AND SO (term)
    const queryParts = query.map((q, index) => {
      let part = '';
      
      // Add boolean operator (except for first query)
      if (q.boolean && index > 0) {
        part += ` ${q.boolean} `;
      }
      
      // Add field code if specified
      if (q.field) {
        part += `${q.field} `;
      }
      
      // Add search term in parentheses
      part += `(${q.term})`;
      
      return part;
    });
    
    const queryValue = queryParts.join('');
    searchUrl += `?query=${encodeURIComponent(queryValue)}`;
  } else {
    // Fresh search with simple query parameter
    searchUrl += `?query=${encodeURIComponent(query)}`;
  }

  // Add or remove limiters - all use actions
  const actions: string[] = [];
  
  if (limiters) {
    const currentLimiters = appliedLimiters || [];
    
    // Full Text
    if (limiters.fullText && !currentLimiters.includes('FT')) {
      actions.push('addlimiter(FT:y)');
    } else if (!limiters.fullText && currentLimiters.includes('FT')) {
      actions.push('removelimiter(FT)');
    }
    
    // Peer Reviewed
    if (limiters.peerReviewed && !currentLimiters.includes('RV')) {
      actions.push('addlimiter(RV:y)');
    } else if (!limiters.peerReviewed && currentLimiters.includes('RV')) {
      actions.push('removelimiter(RV)');
    }
    
    // Five College
    if (limiters.fiveCollege && !currentLimiters.includes('FC')) {
      actions.push('addlimiter(FC:y)');
    } else if (!limiters.fiveCollege && currentLimiters.includes('FC')) {
      actions.push('removelimiter(FC)');
    }
    
    // Location - special format with "Five Colleges Catalog-" prefix
    if (limiters.location && !currentLimiters.includes('LB')) {
      actions.push(`addlimiter(LB:Five Colleges Catalog-${limiters.location})`);
    } else if (!limiters.location && currentLimiters.includes('LB')) {
      actions.push('removelimiter(LB)');
    }
  }
  
  // Append actions if any
  if (actions.length > 0) {
    searchUrl += `&action=${actions.join(',')}`;
  }

  console.log('🔍 Searching EBSCO Discovery:', searchUrl, `(Page ${page})`);

  try {
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        ...DEFAULT_CONFIG.headers,
        ...getAuthHeaders(),
      },
      mode: 'cors',
      credentials: 'omit'
    });

    if (!response.ok) {
      throw new Error(await getDiscoverySearchErrorMessage(response));
    }

    const data: EBSCOSearchResponse = await response.json();

    if (data.status !== 'success' || data.code !== 200) {
      throw new Error('Invalid response from EBSCO search');
    }

    const results = parseEBSCORecords(data.data.records);
    
    // Extract applied limiter IDs from response
    const appliedLimiterIds = data.data.appliedLimiters?.map((limiter) => limiter.Id) || [];

    return {
      results,
      totalHits: data.data.statistics.TotalHits,
      searchTime: data.data.statistics.TotalSearchTime,
      queryString: data.data.request.QueryString,
      appliedLimiters: appliedLimiterIds
    };
  } catch (error) {
    console.error('Discovery search failed:', error);
    throw error;
  }
}

/**
 * Parse EBSCO records into our simplified format
 */
function parseEBSCORecords(records: EBSCORecord[]): DiscoverySearchResult[] {
  return records.map(record => {
    const items = record.Items;
    const bibEntity = record.RecordInfo?.BibEntity;
    const bibRelationships = record.RecordInfo?.BibRelationships;
    const isPartOf = bibRelationships?.IsPartOfRelationships;

    // Extract title from CleanData (already parsed by backend)
    const titleData = items.Ti?.[0]?.CleanData;
    const title = (typeof titleData === 'string' ? titleData : titleData?.[0]) || 
                  bibEntity?.Titles?.[0]?.TitleFull || 
                  'Untitled';

    // Extract authors from CleanData array
    const authorData = items.Au?.[0]?.CleanData;
    const authors = Array.isArray(authorData) ? authorData : 
                    (typeof authorData === 'string' ? [authorData] : []);

    // Use top-level pubType as recommended
    const publicationType = record.pubType || 'Unknown';

    // Extract source/publication info
    const sourceData = items.Src?.[0]?.CleanData;
    const publicationInfo = typeof sourceData === 'string' ? sourceData : sourceData?.[0];

    // Extract subjects from CleanData array
    const subjectData = items.Su?.[0]?.CleanData;
    const subjects = Array.isArray(subjectData) ? subjectData :
                     (typeof subjectData === 'string' ? [subjectData] : 
                     bibEntity?.Subjects?.map(s => s.SubjectFull));

    // Extract abstract from CleanData
    const abstractData = items.Ab?.[0]?.CleanData;
    const abstract = typeof abstractData === 'string' ? abstractData : abstractData?.[0];

    // Extract identifiers from BibEntity and IsPartOfRelationships
    const identifiers = bibEntity?.Identifiers || [];
    const doi = identifiers.find(id => id.Type === 'doi')?.Value;
    const isbn = isPartOf?.Identifiers?.find(id => id.Type.includes('isbn'))?.Value;
    const issn = isPartOf?.Identifiers?.find(id => id.Type.includes('issn'))?.Value;

    // Extract languages
    const languages = bibEntity?.Languages?.map(lang => lang.Text).filter(Boolean);

    // Extract publication date from IsPartOfRelationships
    const dateInfo = isPartOf?.date?.[0];
    const publicationDate = dateInfo ? {
      year: dateInfo.Y,
      month: dateInfo.M,
      day: dateInfo.D
    } : undefined;

    // Extract journal/source title and numbering
    const journalTitle = isPartOf?.Titles?.[0]?.TitleFull;
    const issueNumber = isPartOf?.numbering?.find(n => n.Type === 'issue')?.Value;
    const volumeNumber = isPartOf?.numbering?.find(n => n.Type === 'volume')?.Value;

    // Extract file description from SrcInfo
    const fileDescData = items.SrcInfo?.find(item => item.Label === 'File Description')?.CleanData;
    const fileDescription = typeof fileDescData === 'string' ? fileDescData : fileDescData?.[0];

    // Extract URLs - prioritize FullTextCustomLinks
    const fullTextLink = record.FullTextCustomLinks?.[0];
    const fullTextUrl = fullTextLink?.Url;
    const hasFullText = !!fullTextUrl;

    // Extract standard URL from Items
    const urlData = items.URL?.[0]?.CleanData;
    const url = typeof urlData === 'string' ? urlData : urlData?.[0];

    // Extract additional URLs from SrcInfo Relation field
    const relationData = items.SrcInfo?.find(item => item.Label === 'Relation')?.CleanData;
    const additionalUrls = Array.isArray(relationData) ? relationData : 
                          (typeof relationData === 'string' ? [relationData] : []);

    // Extract call number and location from Holdings
    const holdings = record.Holdings?.[0]?.HoldingSimple?.CopyInformationList?.[0];
    const callNumber = holdings?.ShelfLocator;
    const location = holdings?.Sublocation;

    return {
      id: record.An,
      title,
      authors,
      publicationType,
      publicationInfo,
      subjects,
      abstract,
      isbn,
      issn,
      doi,
      url,
      fullTextUrl,
      callNumber,
      location,
      database: record.DbLabel,
      pLink: record.PLink,
      languages,
      publicationDate,
      journalTitle,
      issueNumber,
      volumeNumber,
      fileDescription,
      additionalUrls,
      hasFullText
    };
  });
}

/**
 * Parse citation text to extract potential search terms
 * This handles various citation formats including MLA, APA, Chicago
 */
export function extractSearchTermsFromCitation(citation: string): string {
  // Remove common patterns that aren't useful for search
  const cleaned = citation
    .replace(/\[videorecording\]/gi, '')
    .replace(/\[film\]/gi, '')
    .replace(/\[electronic resource\]/gi, '')
    .replace(/DVD/gi, '')
    .replace(/item paged MN/gi, '')
    .replace(/\b\d+th\s+ed\b/gi, '') // "9th ed"
    .replace(/\b\d+st\s+ed\b/gi, '')
    .replace(/\b\d+nd\s+ed\b/gi, '')
    .replace(/\b\d+rd\s+ed\b/gi, '')
    .replace(/ISBN[:\s-]*[\dX-]{10,17}/gi, '') // Remove ISBN
    .replace(/https?:\/\/[^\s]+/gi, ''); // Remove URLs

  // Try to extract author and title from common citation formats
  // Format 1: "AUTHOR, First. Title. Publisher, Year."
  // Format 2: "Author, First. Title: Subtitle. Location: Publisher, Year."
  
  // Look for author (starts with caps, has comma)
  const authorMatch = cleaned.match(/^([A-Z][A-Za-z]+,\s*[A-Za-z\s.]+?)\./);
  
  // Look for title (usually after author, before publisher/location)
  // Title often ends with period, comes before colon or "New York:" type patterns
  const titleMatch = cleaned.match(/\.\s*([A-Z][^.]+?)(?:\.|:|New York|London|Chicago|Press|Publisher)/);
  
  if (authorMatch && titleMatch) {
    const author = authorMatch[1].trim();
    const title = titleMatch[1].trim();
    return `${author} ${title}`;
  }
  
  // If structured extraction fails, try to get just the title
  // Usually the longest capitalized phrase
  const sentences = cleaned.split(/[.:]/).map(s => s.trim());
  const likelyTitle = sentences.find(s => 
    s.length > 15 && 
    s.length < 150 && 
    /^[A-Z]/.test(s) &&
    !/^(New York|London|Chicago|Press|Publisher|ISBN|Vol|pp)/i.test(s)
  );
  
  if (likelyTitle) {
    return likelyTitle;
  }

  // Fallback: return cleaned text up to first period or slash
  const titleMatch2 = cleaned.match(/^([^/.]+)/);
  if (titleMatch2) {
    return titleMatch2[1].trim();
  }

  return cleaned.trim();
}
