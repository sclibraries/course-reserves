import type { CourseItem } from '@/store/courseReservesStore';
import type { CitationBatchSearchGroup } from '@course-reserves/citations';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';

export interface EditableCitation {
  id: string;
  text: string;
  heading?: string | null;
}

export interface SkippedCitationBlock {
  id: string;
  text: string;
}

export interface CitationChoice {
  item: Partial<CourseItem>;
  source: 'written' | 'match';
  resultId?: string;
  addedItemId?: string;
}

export interface PasteWorkspace {
  citations: EditableCitation[];
  skipped: SkippedCitationBlock[];
  groups: CitationBatchSearchGroup<DiscoverySearchResult>[];
  choices: Record<string, CitationChoice>;
}

export const EMPTY_PASTE_WORKSPACE: PasteWorkspace = { citations: [], skipped: [], groups: [], choices: {} };
