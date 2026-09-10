import type { ItemData } from "@/components/ItemModal";

/**
 * Material type mappings between store and UI formats
 */
export const MATERIAL_TYPE_TO_STORE: Record<string, 'book' | 'article' | 'chapter' | 'video' | 'website' | 'other'> = {
  'Book': 'book',
  'Article': 'article',
  'Journal Article': 'article',
  'Book Chapter': 'chapter',
  'Video': 'video',
  'Website': 'website',
  'Other': 'other'
};

export const MATERIAL_TYPE_FROM_STORE: Record<string, string> = {
  'book': 'Book',
  'article': 'Article',
  'chapter': 'Book Chapter',
  'video': 'Video',
  'website': 'Website',
  'other': 'Other'
};

/**
 * Transform CourseItem to ItemData format for editing
 */
export const transformItemForEditing = (courseItem: {
  id: string;
  materialType: string;
  title: string;
  authors?: string;
  url?: string;
  notes?: string;
  isbn?: string;
  doi?: string;
  pages?: string;
  edition?: string;
  publisher?: string;
  publicationYear?: string;
  journalTitle?: string;
  volume?: string;
  issue?: string;
  displayStartDate?: string;
  displayEndDate?: string;
  hasAttachment?: boolean;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentType?: string;
}): ItemData & { id: string } => {
  return {
    id: courseItem.id,
    materialType: MATERIAL_TYPE_FROM_STORE[courseItem.materialType] || courseItem.materialType,
    title: courseItem.title,
    author: courseItem.authors || '',
    citation: '',
    sourceLink: courseItem.url || '',
    requestType: '',
    publicNote: courseItem.notes || '',
    displayStartDate: courseItem.displayStartDate ? new Date(courseItem.displayStartDate) : undefined,
    displayEndDate: courseItem.displayEndDate ? new Date(courseItem.displayEndDate) : undefined,
    hasAttachment: courseItem.hasAttachment,
    attachmentName: courseItem.attachmentName,
    attachmentSize: courseItem.attachmentSize,
    attachmentType: courseItem.attachmentType,
    isbn: courseItem.isbn,
    doi: courseItem.doi,
    pages: courseItem.pages,
    edition: courseItem.edition,
    publisher: courseItem.publisher,
    publicationYear: courseItem.publicationYear,
    journal: courseItem.journalTitle,
    volume: courseItem.volume,
    issue: courseItem.issue,
  };
};

/**
 * Transform ItemData to CourseItem format for saving
 */
export const transformItemForSaving = (itemData: ItemData) => {
  return {
    title: itemData.title,
    authors: itemData.author,
    isbn: itemData.isbn,
    publisher: itemData.publisher,
    publicationYear: itemData.publicationYear,
    edition: itemData.edition,
    pages: itemData.pages,
    journalTitle: itemData.journal,
    volume: itemData.volume,
    issue: itemData.issue,
    doi: itemData.doi,
    url: itemData.sourceLink,
    materialType: MATERIAL_TYPE_TO_STORE[itemData.materialType] || 'other',
    status: 'draft' as const,
    notes: itemData.publicNote,
    displayStartDate: itemData.displayStartDate ? itemData.displayStartDate.toISOString() : undefined,
    displayEndDate: itemData.displayEndDate ? itemData.displayEndDate.toISOString() : undefined,
    hasAttachment: !!itemData.hasAttachment,
    attachmentName: itemData.attachmentName,
    attachmentSize: itemData.attachmentSize,
    attachmentType: itemData.attachmentType,
  };
};

/**
 * Detect material type from URL
 */
export const detectMaterialTypeFromUrl = (url: string): 'article' | 'video' | 'website' | 'other' => {
  if (url.includes('youtube') || url.includes('video')) {
    return 'video';
  } else if (url.includes('ebsco') || url.includes('journal')) {
    return 'article';
  }
  return 'website';
};
