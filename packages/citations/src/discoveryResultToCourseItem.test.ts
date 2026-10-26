import { describe, expect, it } from 'vitest';
import { discoveryResultToCourseItem } from './discoveryResultToCourseItem';

describe('discoveryResultToCourseItem', () => {
  it('maps a plain structural EDS result into faculty item fields', () => {
    const item = discoveryResultToCourseItem({
      id: 'synthetic-an',
      dbId: 'synthetic-database',
      title: 'Synthetic Journal Article',
      authors: ['Test Author', 'Second Test Author'],
      publicationType: 'Academic Journal',
      publicationInfo: 'Synthetic Publisher',
      publicationDate: { year: '2025' },
      abstract: 'This abstract must not become a faculty note.',
      isbn: '9780000000000',
      issn: '1234-5678',
      doi: '10.1000/synthetic',
      journalTitle: 'Synthetic Journal',
      volumeNumber: '12',
      issueNumber: '3',
      pLink: 'https://example.test/record/synthetic',
      database: 'Synthetic Database',
      hasFullText: false,
    });

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
        plink: 'https://example.test/record/synthetic',
      },
      status: 'draft',
    });
    expect(item).not.toHaveProperty('notes');
    expect(item).not.toHaveProperty('libraryNotes');
    expect(JSON.stringify(item)).not.toContain('This abstract');
  });
});
