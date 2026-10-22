const MAX_TITLE_LENGTH = 200;

export type CitationMaterialType = 'book' | 'article' | 'chapter' | 'video' | 'website' | 'other';

export interface CitationCourseItem {
  title: string;
  materialType: CitationMaterialType;
  status: 'draft';
  notes: string;
}

export function citationToCourseItem(citation: string): CitationCourseItem {
  return {
    title: truncateCitationTitle(citation),
    materialType: inferMaterialType(citation),
    status: 'draft',
    notes: citation,
  };
}

export function truncateCitationTitle(citation: string): string {
  if (citation.length <= MAX_TITLE_LENGTH) return citation;
  return `${citation.slice(0, MAX_TITLE_LENGTH - 3).trimEnd()}...`;
}

function inferMaterialType(citation: string): CitationMaterialType {
  const lowerCaseCitation = citation.toLowerCase();
  if (/\bv\.\s+[A-Z]/iu.test(citation) && /\b\d+\s+[A-Z][\w.]+\s+\d+/u.test(citation)) return 'book';
  if (['video', 'film', 'dvd'].some((term) => lowerCaseCitation.includes(term))) return 'video';
  if (lowerCaseCitation.includes('journal') && !lowerCaseCitation.includes('press')) return 'article';
  if (lowerCaseCitation.includes('http') || lowerCaseCitation.includes('www.')) return 'website';
  if (lowerCaseCitation.includes('chapter') || /\bin\s+[A-Z].*\(ed[s]?\.\)/iu.test(citation)) return 'chapter';
  if (/\([12]\d{3}\)/u.test(citation) || /^[A-Z][a-zA-Z'-]+,\s+[A-Z]/u.test(citation)) return 'book';
  return 'other';
}
