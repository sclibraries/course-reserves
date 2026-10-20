import { describe, expect, it } from 'vitest';
import { parseEBSCORecord } from './discoveryRecordParser';

describe('parseEBSCORecord holdings', () => {
  it('keeps every copy from every EDS holdings group', () => {
    const record = parseEBSCORecord({
      AccessLevel: 'open',
      pubType: 'eBook',
      PubTypeId: 'ebook',
      ResultId: 1,
      DbId: 'synthetic-database',
      DbLabel: 'Synthetic Database',
      An: 'synthetic-an',
      PLink: '',
      Items: {},
      Holdings: [
        { HoldingSimple: { CopyInformationList: [
          { Sublocation: 'Mount Holyoke College Online', ShelfLocator: 'Digital library' },
          { Sublocation: 'Smith College Online', ShelfLocator: 'JSTOR DDA' },
        ] } },
        { HoldingSimple: { CopyInformationList: [
          { Sublocation: 'UMass Amherst Online', ShelfLocator: 'Academic collection' },
        ] } },
      ],
    });

    expect(record.holdings).toEqual([
      { Sublocation: 'Mount Holyoke College Online', ShelfLocator: 'Digital library' },
      { Sublocation: 'Smith College Online', ShelfLocator: 'JSTOR DDA' },
      { Sublocation: 'UMass Amherst Online', ShelfLocator: 'Academic collection' },
    ]);
  });

  it('recognizes EDS full-text fields as electronic access', () => {
    const record = parseEBSCORecord({
      AccessLevel: 'open',
      pubType: 'eBook',
      PubTypeId: 'ebook',
      ResultId: 2,
      DbId: 'synthetic-database',
      DbLabel: 'Synthetic Database',
      An: 'synthetic-an',
      PLink: '',
      Items: {},
      FullText: 'https://example.edu/synthetic-full-text',
    });

    expect(record.hasFullText).toBe(true);
  });
});
