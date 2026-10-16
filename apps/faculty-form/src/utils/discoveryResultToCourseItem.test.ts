import { describe, expect, it } from 'vitest';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import { discoveryResultToCourseItem } from './discoveryResultToCourseItem';

const result: DiscoverySearchResult = {
  id: 'synthetic-an',
  dbId: 'synthetic-database',
  title: 'Synthetic Journal Article',
  authors: ['Test Author', 'Second Test Author'],
  publicationType: 'Academic Journal',
  publicationInfo: 'Synthetic Publisher',
  publicationDate: { year: '2025' },
  abstract: 'This abstract belongs in the full record, not faculty notes.',
  isbn: '9780000000000',
  issn: '1234-5678',
  doi: '10.1000/synthetic',
  journalTitle: 'Synthetic Journal',
  volumeNumber: '12',
  issueNumber: '3',
  pLink: 'https://search.ebscohost.com/record/synthetic',
  database: 'Synthetic Database',
  hasFullText: false,
};

describe('discoveryResultToCourseItem', () => {
  it('maps structured EDS identity and bibliographic fields without generating notes', () => {
    const item = discoveryResultToCourseItem(result);

    expect(item).toMatchObject({
      title: 'Synthetic Journal Article',
      authors: 'Test Author; Second Test Author',
      materialType: 'article',
      publicationYear: '2025',
      publisher: 'Synthetic Publisher',
      isbn: '9780000000000',
      issn: '1234-5678',
      doi: '10.1000/synthetic',
      journalTitle: 'Synthetic Journal',
      volume: '12',
      issue: '3',
      eds: {
        dbId: 'synthetic-database',
        an: 'synthetic-an',
        plink: 'https://search.ebscohost.com/record/synthetic',
      },
    });
    expect(item).not.toHaveProperty('notes');
    expect(item).not.toHaveProperty('libraryNotes');
    expect(JSON.stringify(item)).not.toContain(result.abstract);
  });
});
