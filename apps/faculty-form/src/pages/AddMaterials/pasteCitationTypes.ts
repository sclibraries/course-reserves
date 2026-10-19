import type { CourseItem } from '@/store/courseReservesStore';
import type { CitationBatchSearchGroup } from '@/utils/citationBatchSearch';

export interface EditableCitation {
  id: string;
  text: string;
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
  groups: CitationBatchSearchGroup[];
  choices: Record<string, CitationChoice>;
}

export const EMPTY_PASTE_WORKSPACE: PasteWorkspace = { citations: [], skipped: [], groups: [], choices: {} };
