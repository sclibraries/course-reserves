import type { CitationMaterialType } from './citationToCourseItem';

export interface DiscoveryResultLike {
  id: string;
  dbId: string;
  title: string;
  authors: string[];
  publicationType: string;
  publicationInfo?: string;
  isbn?: string;
  doi?: string;
  issn?: string;
  journalTitle?: string;
  volumeNumber?: string;
  issueNumber?: string;
  publicationDate?: { year?: string };
  publisher?: string;
  fullTextUrl?: string;
  url?: string;
  pLink: string;
  fileDescription?: string;
}

export interface DiscoveryCourseItem {
  title: string;
  authors?: string;
  isbn?: string;
  doi?: string;
  issn?: string;
  journalTitle?: string;
  volume?: string;
  issue?: string;
  publicationYear?: string;
  publisher?: string;
  eds: { dbId: string; an: string; plink: string };
  url?: string;
  materialType: CitationMaterialType;
  status: 'draft';
}

export function discoveryResultToCourseItem(result: DiscoveryResultLike): DiscoveryCourseItem {
  return {
    title: result.title || 'Untitled',
    authors: result.authors.length > 0 ? result.authors.join('; ') : undefined,
    isbn: result.isbn,
    doi: result.doi,
    issn: result.issn,
    journalTitle: result.journalTitle,
    volume: result.volumeNumber,
    issue: result.issueNumber,
    publicationYear: result.publicationDate?.year,
    publisher: result.publisher || result.publicationInfo,
    eds: { dbId: result.dbId, an: result.id, plink: result.pLink },
    url: result.fullTextUrl || result.url || result.pLink,
    materialType: mapMaterialType(result),
    status: 'draft',
  };
}

function mapMaterialType(result: DiscoveryResultLike): CitationMaterialType {
  const type = result.publicationType.toLowerCase();
  if (type.includes('chapter') || type.includes('book section')) return 'chapter';
  if (['journal', 'article', 'periodical', 'magazine', 'academic'].some((term) => type.includes(term))) return 'article';
  if (['book', 'ebook', 'monograph'].some((term) => type.includes(term))) return 'book';
  if (['video', 'film', 'dvd', 'streaming'].some((term) => type.includes(term))) return 'video';
  if (type.includes('website') || type.includes('web') || result.fileDescription?.toLowerCase().includes('web')) return 'website';
  return 'other';
}
