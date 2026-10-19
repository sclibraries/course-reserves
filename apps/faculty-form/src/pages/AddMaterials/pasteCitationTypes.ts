import type { CourseItem } from '@/store/courseReservesStore';
import type { CitationBatchSearchGroup } from '@/utils/citationBatchSearch';

export interface EditableCitation {
  id: string;
  text: string;
}

export interface CitationChoice {
  item: Partial<CourseItem>;
  source: 'written' | 'match';
  label: string;
  resultId?: string;
}

export interface PasteWorkspace {
  citations: EditableCitation[];
  groups: CitationBatchSearchGroup[];
  choices: Record<string, CitationChoice>;
}

export const EMPTY_PASTE_WORKSPACE: PasteWorkspace = { citations: [], groups: [], choices: {} };
