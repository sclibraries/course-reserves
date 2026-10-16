import { beforeEach, describe, expect, it, vi } from 'vitest';
import { retrieveDiscoveryRecord, searchDiscovery } from './discoverySearchService';

const searchFailure = (status: number, payload: unknown = {}) => ({
  ok: false,
  status,
  statusText: 'Request failed',
  json: async () => payload,
});

describe('searchDiscovery', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        code: 200,
        data: {
          request: {
            QueryString: 'climate change',
            SearchCriteriaWithActions: {
              QueriesWithAction: [],
            },
          },
          statistics: {
            TotalHits: 0,
            TotalSearchTime: 3,
          },
          recordFormat: 'EP Display',
          records: [],
          facets: [],
          availableCriteria: [],
        },
      }),
    }));

    document.cookie = 'accessToken=faculty-token; Path=/';
  });

  it('sends the faculty bearer token to the EBSCO proxy', async () => {
    await searchDiscovery('climate change');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ebsco-search/search?query=climate%20change'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer faculty-token',
        }),
      })
    );
  });

  it('shows unavailable guidance and its reference for a search_unavailable response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(searchFailure(503, {
      error_code: 'search_unavailable',
      message: 'raw upstream details must not be shown',
      reference: '7F3K2Q',
    }) as Response);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(searchDiscovery('typed query')).rejects.toMatchObject({
      message: 'Library search is temporarily unavailable. Please try again later, or add the item by citation.\nReference: 7F3K2Q',
    });
  });

  it('shows a friendly rate limit message for 429 responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(searchFailure(429) as Response);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(searchDiscovery('typed query')).rejects.toMatchObject({
      message: 'There are too many searches right now. Please wait a moment and try again.',
    });
  });

  it('uses a generic friendly message for other HTTP errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(searchFailure(400, {
      message: 'HTTP 400: raw server error',
    }) as Response);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(searchDiscovery('typed query')).rejects.toMatchObject({
      message: 'Unable to search the library right now. Please try again.',
    });
  });

  it('keeps the EDS database id needed to retrieve the full record', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        code: 200,
        data: {
          request: {
            QueryString: 'climate change',
            SearchCriteriaWithActions: { QueriesWithAction: [] },
          },
          statistics: { TotalHits: 1, TotalSearchTime: 3 },
          recordFormat: 'EP Display',
          records: [{
            AccessLevel: 'open',
            pubType: 'Academic Journal',
            PubTypeId: 'academicJournal',
            ResultId: 1,
            DbId: 'synthetic-database',
            DbLabel: 'Synthetic Database',
            An: 'synthetic-an',
            PLink: 'https://search.ebscohost.com/record/synthetic',
            PDF: '',
            HTML: '',
            FullText: '',
            ImageInfo: '',
            Items: {
              Ti: [{ Label: 'Title', Group: 'Ti', Data: 'Synthetic Article', CleanData: 'Synthetic Article' }],
              Au: [{ Label: 'Author', Group: 'Au', Data: 'Test Author', CleanData: 'Test Author' }],
            },
          }],
          facets: [],
          availableCriteria: [],
        },
      }),
    } as Response);

    const response = await searchDiscovery('climate change');

    expect(response.results[0]).toMatchObject({
      id: 'synthetic-an',
      dbId: 'synthetic-database',
      pLink: 'https://search.ebscohost.com/record/synthetic',
    });
  });

  it('retrieves and maps the full record from the authenticated faculty API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        code: 200,
        data: {
          record: {
            AccessLevel: 'open',
            pubType: 'Academic Journal',
            PubTypeId: 'academicJournal',
            ResultId: 1,
            DbId: 'synthetic-database',
            DbLabel: 'Synthetic Database',
            An: 'synthetic-an',
            PLink: 'https://search.ebscohost.com/record/synthetic',
            FullTextCustomLinks: [{ Category: 'Full Text', Icon: '', MouseOverText: '', Name: 'PDF', Text: 'PDF', Url: 'https://example.edu/full-text' }],
            Items: {
              Ti: [{ Label: 'Title', Group: 'Ti', Data: 'Synthetic Article', CleanData: 'Synthetic Article' }],
              Au: [{ Label: 'Author', Group: 'Au', Data: 'Test Author', CleanData: ['Test Author', 'Second Test Author'] }],
              Ab: [{ Label: 'Abstract', Group: 'Ab', Data: 'Full synthetic abstract.', CleanData: 'Full synthetic abstract.' }],
              Ed: [{ Label: 'Edition', Group: 'Ed', Data: 'Second edition', CleanData: 'Second edition' }],
              Pub: [{ Label: 'Publisher', Group: 'Pub', Data: 'Synthetic Publisher', CleanData: 'Synthetic Publisher' }],
            },
            RecordInfo: {
              BibEntity: {
                Identifiers: [{ Type: 'doi', Value: '10.1000/synthetic' }],
                Subjects: [{ SubjectFull: 'Synthetic subject', Type: 'topic' }],
              },
              BibRelationships: {
                IsPartOfRelationships: {
                  date: [{ Y: '2025', M: '6', D: '10', Type: 'publication' }],
                  Identifiers: [{ Type: 'issn', Value: '1234-5678' }],
                  Titles: [{ TitleFull: 'Synthetic Journal', Type: 'journal' }],
                  numbering: [{ Type: 'volume', Value: '12' }, { Type: 'issue', Value: '3' }],
                },
              },
            },
            Holdings: [{ HoldingSimple: { CopyInformationList: [{ Sublocation: 'Neilson', ShelfLocator: 'QA 1' }] } }],
          },
        },
      }),
    } as Response);

    const record = await retrieveDiscoveryRecord('synthetic-database', 'synthetic-an');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ebsco-search/retrieve?dbId=synthetic-database&an=synthetic-an'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer faculty-token' }) })
    );
    expect(record).toMatchObject({
      title: 'Synthetic Article',
      authors: ['Test Author', 'Second Test Author'],
      edition: 'Second edition',
      publisher: 'Synthetic Publisher',
      publicationDate: { year: '2025', month: '6', day: '10' },
      subjects: ['Synthetic subject'],
      abstract: 'Full synthetic abstract.',
      doi: '10.1000/synthetic',
      issn: '1234-5678',
      location: 'Neilson',
      callNumber: 'QA 1',
      pLink: 'https://search.ebscohost.com/record/synthetic',
      fullTextLinks: [expect.objectContaining({ Url: 'https://example.edu/full-text' })],
    });
  });

  it('requests EDS facets and encodes the upstream query string for pagination', async () => {
    await searchDiscovery('', 2, 'query-1=AND,climate & change');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('query=query-1%3DAND%2Cclimate%20%26%20change'),
      expect.anything()
    );
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('includefacets=y'), expect.anything());
  });

  it('applies the selected source-type facet and publication-year limiter', async () => {
    await searchDiscovery('climate change', 1, undefined, {
      sourceType: 'Academic Journals', publicationYear: '2025',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('action=addlimiter%28DT1%3A2025%29%2CAddFacetFilter%28SourceType%3AAcademic%20Journals%29'),
      expect.anything()
    );
  });
});
