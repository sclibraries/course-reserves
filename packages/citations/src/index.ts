export { extractCitationsFromSyllabus } from './syllabusCitationExtractor';
export type { CitationExtractionResult } from './syllabusCitationExtractor';
export { parseCitation } from './citationParser';
export type { ParsedCitation } from './citationParser';
export { findCitationBestMatch } from './citationBestMatch';
export type { CitationBestMatch } from './citationBestMatch';
export {
  executeCitationBatchSearch,
  prepareCitationBatchSearches,
  prepareCitationSearches,
} from './citationBatchSearch';
export type {
  CitationBatchSearchGroup,
  CitationBatchSearchOptions,
  CitationFieldQuery,
  CitationSearchResponse,
  CitationSearchResult,
  CitationSearchStrategy,
  PreparedCitationSearch,
} from './citationBatchSearch';
export { citationToCourseItem, truncateCitationTitle } from './citationToCourseItem';
export type { CitationCourseItem, CitationMaterialType } from './citationToCourseItem';
