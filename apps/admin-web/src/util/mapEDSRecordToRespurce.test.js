import { beforeAll, describe, expect, it, vi } from 'vitest';
import { adminMaterialTypeService } from '../services/admin/adminMaterialTypeService';
import { mapEdsRecordToResource } from './mapEDSRecordToRespurce';

vi.mock('../services/admin/adminMaterialTypeService', () => ({
  adminMaterialTypeService: {
    getMaterialTypes: vi.fn(),
  },
}));

const record = {
  AccessLevel: 'fulltext',
  pubType: 'Academic Journal',
  PubTypeId: 'SYNTH-PUBTYPE',
  ResultId: 'SYNTH-RESULT',
  DbId: 'SYNTH-DB',
  DbLabel: 'Synthetic Database',
  An: 'SYNTH-AN-17',
  PLink: 'https://example.test/permalink',
  FullTextCustomLinks: [{
    Category: 'fulltext',
    Icon: 'article',
    MouseOverText: 'Full text',
    Name: 'Synthetic article',
    Text: 'Read article',
    Url: 'https://example.test/full-text',
  }],
  Items: {
    Ti: [{ Label: 'Title', Group: 'Ti', Data: 'Synthetic title', CleanData: ['Synthetic title &amp; edition'] }],
    Au: [{ Label: 'Author', Group: 'Au', Data: 'Authors', CleanData: ['Alice Example', 'Bob Example'] }],
    Ab: [{ Label: 'Abstract', Group: 'Ab', Data: 'Abstract', CleanData: ['Student description'] }],
    URL: [{ Label: 'URL', Group: 'URL', Data: 'https://example.test/item', CleanData: 'https://example.test/item' }],
    Pub: [{ Label: 'Publication', Group: 'Pub', Data: 'Synthetic Press', CleanData: 'Synthetic Press' }],
  },
  RecordInfo: {
    BibEntity: {
      Identifiers: [
        { Type: 'ISBN-13', Value: '9780000000017' },
        { Type: 'ISBN-10', Value: '0000000017' },
        { Type: 'ISSN', Value: '1234-5678' },
        { Type: 'DOI', Value: '10.9000/synthetic-doi' },
      ],
      PhysicalDescription: { Pagination: '7', StartPage: '21' },
      Titles: [{ TitleFull: 'BibEntity fallback title', Type: 'main' }],
    },
    BibRelationships: {
      HasContributorRelationships: [{ NameFull: 'BibEntity fallback author' }],
      IsPartOfRelationships: {
        date: [{ Y: '2024', M: '4', D: '5', Type: 'publication' }],
        Identifiers: [
          { Type: 'ISSN', Value: '8765-4321' },
          { Type: 'DOI', Value: '10.9000/later-doi' },
        ],
        Titles: [{ TitleFull: 'Journal of Synthetic Records', Type: 'journal' }],
        numbering: [
          { Type: 'Volume', Value: '12' },
          { Type: 'Issue', Value: '3' },
          { Type: 'Volume', Value: '13' },
          { Type: 'Issue', Value: '4' },
        ],
      },
    },
  },
  Holdings: [{
    HoldingSimple: {
      CopyInformationList: [{ ShelfLocator: 'QA 76.9 .T4', Sublocation: 'Synthetic Library' }],
    },
  }, {
    HoldingSimple: {
      CopyInformationList: [{ ShelfLocator: 'Later call number', Sublocation: 'Later location' }],
    },
  }],
};

const materialTypes = [
  { material_type_id: '1', name: 'book' },
  { material_type_id: '2', name: 'article' },
  { material_type_id: '3', name: 'media' },
  { material_type_id: '4', name: 'website' },
  { material_type_id: '9', name: 'ebook' },
];
describe('mapEdsRecordToResource', () => {
  let mapped;

  beforeAll(async () => {
    adminMaterialTypeService.getMaterialTypes.mockResolvedValue({ data: materialTypes });
    mapped = await mapEdsRecordToResource(record);
  });

  it.each([
    ['title from Items before BibEntity', () => mapped.title, 'Synthetic title & edition'],
    ['authors from Items in record order', () => mapped.metadata.author, 'Alice Example; Bob Example'],
    ['every ISBN in record order', () => mapped.metadata.isbn, '9780000000017; 0000000017'],
    ['ISSN', () => mapped.metadata.issn, '1234-5678'],
    ['DOI', () => mapped.metadata.doi, '10.9000/synthetic-doi'],
    ['full publication date', () => mapped.metadata.publication_date, '2024-04-05'],
    ['journal title', () => mapped.metadata.journal_title, 'Journal of Synthetic Records'],
    ['volume', () => mapped.metadata.volume, '12'],
    ['issue', () => mapped.metadata.issue, '3'],
    ['pages from start and count', () => mapped.metadata.pages, '21-27'],
    ['publisher from the Pub group', () => mapped.metadata.publisher, 'Synthetic Press'],
    ['first holding call number', () => mapped.metadata.call_number, 'QA 76.9 .T4'],
    ['first holding location', () => mapped.metadata.location, 'Synthetic Library'],
    ['database', () => mapped.metadata.database, 'Synthetic Database'],
    ['accession number', () => mapped.metadata.accession_number, 'SYNTH-AN-17'],
    ['abstract as Description', () => mapped.description, 'Student description'],
    ['first full text custom link', () => mapped.link, 'https://example.test/full-text'],
    ['article type id', () => mapped.material_type, 2],
    ['article title field', () => mapped.metadata.article_title, 'Synthetic title & edition'],
  ])('maps %s', (_, value, expected) => {
    expect(value()).toBe(expected);
  });

  it('maps an ebook with book fields even when no type-specific definitions exist', async () => {
    const ebook = await mapEdsRecordToResource({ ...record, pubType: 'E-Book' });

    expect(ebook.material_type).toBe(9);
    expect(ebook.metadata.book_title).toBe('Synthetic title & edition');
    expect(ebook.metadata.isbn).toBe('9780000000017; 0000000017');
    expect(ebook.metadata.is_ebook).toBe(true);
  });

  it('maps an EDS No checkbox value to false', async () => {
    const book = await mapEdsRecordToResource({ ...record, pubType: 'Monograph' });

    expect(book.metadata.is_ebook).toBe(false);
  });

  it.each([
    ['full text custom link', record, 'https://example.test/full-text'],
    ['item URL', { ...record, FullTextCustomLinks: [] }, 'https://example.test/item'],
    ['permalink', { ...record, FullTextCustomLinks: [], Items: { ...record.Items, URL: [] } }, 'https://example.test/permalink'],
  ])('uses the %s link source', async (_, sourceRecord, expected) => {
    await expect(mapEdsRecordToResource(sourceRecord)).resolves.toMatchObject({ link: expected });
  });

  it('prefers the parser publisher over the Pub group fallback', async () => {
    const withParsedPublisher = {
      ...record,
      Items: {
        ...record.Items,
        Publisher: [{ Label: 'Publisher', Group: 'Publisher', Data: 'Preferred Press', CleanData: ['Preferred Press'] }],
      },
    };

    await expect(mapEdsRecordToResource(withParsedPublisher)).resolves.toMatchObject({
      metadata: { publisher: 'Preferred Press' },
    });
  });

  const recordWithDate = (date) => ({
    ...record,
    RecordInfo: {
      ...record.RecordInfo,
      BibRelationships: {
        ...record.RecordInfo.BibRelationships,
        IsPartOfRelationships: {
          ...record.RecordInfo.BibRelationships.IsPartOfRelationships,
          date: [date],
        },
      },
    },
  });

  it.each([
    [{ Y: '2024', M: '', D: '' }, '2024'],
    [{ Y: '2024', M: '4', D: '' }, '2024-04'],
    [{ Y: '2024', M: '4', D: '5' }, '2024-04-05'],
  ])('formats publication date %j', async (date, expected) => {
    await expect(mapEdsRecordToResource(recordWithDate(date))).resolves.toMatchObject({
      metadata: { publication_date: expected },
    });
  });
});
