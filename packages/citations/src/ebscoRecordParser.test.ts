import { describe, expect, it } from 'vitest';
import { parseEBSCORecord, parseEBSCORecords, type EBSCORecord } from './ebscoRecordParser';

const record: EBSCORecord = {
  AccessLevel: 'open',
  pubType: 'Academic Journal',
  PubTypeId: 'academic-journal',
  ResultId: 'synthetic-result-1',
  DbId: 'synthetic-database',
  DbLabel: 'Synthetic Database',
  An: 'synthetic-an-1',
  PLink: 'https://example.test/record/1',
  PDF: 'available',
  Items: {
    Ti: [{ Label: 'Title', Group: 'Ti', Data: 'Synthetic article', CleanData: ['Synthetic article'] }],
    Au: [{ Label: 'Author', Group: 'Au', Data: 'Example Author', CleanData: ['Example Author'] }],
    Su: [],
    Ab: [{ Label: 'Abstract', Group: 'Ab', Data: 'Summary', CleanData: ['Synthetic abstract'] }],
    URL: [{ Label: 'URL', Group: 'URL', Data: 'https://example.test/full', CleanData: ['https://example.test/full'] }],
    Src: [{ Label: 'Source', Group: 'Src', Data: 'Example Review', CleanData: ['Example Review'] }],
    Edition: [{ Label: 'Edition', Group: 'Edition', Data: '2nd', CleanData: '2nd edition' }],
    Publisher: [{ Label: 'Publisher', Group: 'Publisher', Data: 'Test Press', CleanData: 'Test Press' }],
    SrcInfo: [
      { Label: 'File description', Group: 'SrcInfo', Data: 'PDF', CleanData: 'PDF full text' },
      { Label: 'Relation', Group: 'SrcInfo', Data: 'Related', CleanData: ['https://example.test/related'] },
    ],
  },
  FullTextCustomLinks: [{ Category: 'full text', Icon: 'pdf', MouseOverText: 'Open PDF', Name: 'PDF', Text: 'Full text', Url: 'https://example.test/pdf' }],
  CustomLinks: [{ Category: 'other', Icon: '', MouseOverText: 'Open issue', Name: 'Issue', Text: 'Issue link', Url: 'https://example.test/issue' }],
  RecordInfo: {
    BibEntity: {
      Titles: [{ TitleFull: 'Fallback title', Type: 'main' }],
      Languages: [{ Code: 'eng', Text: 'English' }],
      Subjects: [{ SubjectFull: 'Synthetic subject', Type: 'topic' }],
      Identifiers: [
        { Type: 'DOI', Value: '10.1000/synthetic' },
        { Type: 'ISBN', Value: '9780000000001' },
      ],
    },
    BibRelationships: {
      HasContributorRelationships: [{ NameFull: 'Contributor Name' }],
      IsPartOfRelationships: {
        date: [{ Y: '2024', M: '6', D: '18', Type: 'publication' }],
        Identifiers: [{ Type: 'ISSN', Value: '1234-5678' }],
        Titles: [{ TitleFull: 'Synthetic Journal', Type: 'journal' }],
        numbering: [
          { Type: 'volume', Value: '12' },
          { Type: 'issue', Value: '3' },
        ],
      },
    },
  },
  Holdings: [
    { HoldingSimple: { CopyInformationList: [{ Sublocation: 'Smith Online', ShelfLocator: 'Digital collection' }] } },
    { HoldingSimple: { CopyInformationList: [{ Sublocation: 'Five Colleges', ShelfLocator: 'Library database' }] } },
  ],
};

describe('parseEBSCORecord', () => {
  it('maps CleanData, BibRelationships, numbering, CustomLinks, and holdings to the shared result', () => {
    expect(parseEBSCORecord(record)).toEqual({
      id: 'synthetic-an-1',
      dbId: 'synthetic-database',
      title: 'Synthetic article',
      authors: ['Example Author'],
      publicationType: 'Academic Journal',
      publicationInfo: 'Example Review',
      subjects: ['Synthetic subject'],
      abstract: 'Synthetic abstract',
      isbn: '9780000000001',
      issn: '1234-5678',
      doi: '10.1000/synthetic',
      url: 'https://example.test/full',
      fullTextUrl: 'https://example.test/pdf',
      fullTextLinks: [
        { Category: 'full text', Icon: 'pdf', MouseOverText: 'Open PDF', Name: 'PDF', Text: 'Full text', Url: 'https://example.test/pdf' },
        { Category: 'other', Icon: '', MouseOverText: 'Open issue', Name: 'Issue', Text: 'Issue link', Url: 'https://example.test/issue' },
      ],
      callNumber: 'Digital collection',
      location: 'Smith Online',
      holdings: [
        { Sublocation: 'Smith Online', ShelfLocator: 'Digital collection' },
        { Sublocation: 'Five Colleges', ShelfLocator: 'Library database' },
      ],
      database: 'Synthetic Database',
      pLink: 'https://example.test/record/1',
      languages: ['English'],
      publicationDate: { year: '2024', month: '6', day: '18' },
      journalTitle: 'Synthetic Journal',
      issueNumber: '3',
      volumeNumber: '12',
      edition: '2nd edition',
      publisher: 'Test Press',
      fileDescription: 'PDF full text',
      additionalUrls: ['https://example.test/related'],
      hasFullText: true,
    });
  });

  it('uses bib title and contributors when CleanData title and authors are absent', () => {
    const parsed = parseEBSCORecord({
      ...record,
      Items: {},
      PDF: '',
      HTML: '',
      FullText: '',
      FullTextCustomLinks: [],
      CustomLinks: [],
      RecordInfo: {
        BibEntity: { Titles: [{ TitleFull: 'Bibliographic title', Type: 'main' }] },
        BibRelationships: { HasContributorRelationships: [{ NameFull: 'Contributor Name' }] },
      },
      Holdings: [],
    });

    expect(parsed.title).toBe('Bibliographic title');
    expect(parsed.authors).toEqual(['Contributor Name']);
    expect(parsed.hasFullText).toBe(false);
  });

  it('parses record batches in their original order', () => {
    expect(parseEBSCORecords([record, { ...record, An: 'synthetic-an-2' }]).map(({ id }) => id))
      .toEqual(['synthetic-an-1', 'synthetic-an-2']);
  });

  it('keeps every copy from every EDS holdings group', () => {
    const parsed = parseEBSCORecord({
      ...record,
      Holdings: [
        { HoldingSimple: { CopyInformationList: [
          { Sublocation: 'Synthetic College Online', ShelfLocator: 'Digital library' },
          { Sublocation: 'Smith College Online', ShelfLocator: 'JSTOR DDA' },
        ] } },
        { HoldingSimple: { CopyInformationList: [
          { Sublocation: 'Five Colleges Online', ShelfLocator: 'Academic collection' },
        ] } },
      ],
    });

    expect(parsed.holdings).toEqual([
      { Sublocation: 'Synthetic College Online', ShelfLocator: 'Digital library' },
      { Sublocation: 'Smith College Online', ShelfLocator: 'JSTOR DDA' },
      { Sublocation: 'Five Colleges Online', ShelfLocator: 'Academic collection' },
    ]);
  });

  it('recognizes EDS full-text fields as electronic access', () => {
    expect(parseEBSCORecord({ ...record, FullText: 'https://example.test/full-text', FullTextCustomLinks: [], CustomLinks: [] }).hasFullText)
      .toBe(true);
  });
});
