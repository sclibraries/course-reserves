import { describe, expect, it, vi } from 'vitest';

import type { CitationFieldQuery, CitationSearchResult } from './citationBatchSearch';

import {
  executeCitationBatchSearch,
  prepareCitationBatchSearches,
  prepareCitationSearches,
} from './citationBatchSearch';

function makeResult(id: string, title: string): CitationSearchResult & { id: string } {
  return { id, title };
}

describe('prepareCitationBatchSearches', () => {
  it('turns a multiline citation paste into per-citation field queries', () => {
    const searches = prepareCitationBatchSearches(`Test Author, “A Synthetic Citation Parsing Title,” Example Journal 60, 2 (June 2014): 5-28

Test Author A., Sample Author B., & Example Author C. (2021). Planning a synthetic study using example
research methods. Example Computer Journal, 192, 3123–3133.
https://doi.org/10.1234/example.2021.0001`);

    expect(searches).toHaveLength(2);

    expect(searches[0]).toMatchObject({
      rawCitation:
        'Test Author, “A Synthetic Citation Parsing Title,” Example Journal 60, 2 (June 2014): 5-28',
      builtQuery:
        'AU (Test Author) AND TI (A Synthetic Citation Parsing Title) AND SO (Example Journal)',
    });

    expect(searches[1]).toMatchObject({
      rawCitation:
        'Test Author A., Sample Author B., & Example Author C. (2021). Planning a synthetic study using example research methods. Example Computer Journal, 192, 3123–3133. https://doi.org/10.1234/example.2021.0001',
      builtQuery:
        'TI (Planning a synthetic study using example research methods) AND SO (Example Computer Journal)',
    });

    expect(searches[1].fieldQueries.map((query) => query.field)).toEqual(['TI', 'SO']);
  });

  it('builds a title-plus-source query for slash-style edited book citations', () => {
    const [search] = prepareCitationBatchSearches(
      'Synthetic Research Topics / edited by Example Editor A., Sample Editor B., and Test Editor C. (1st ed. 2014.). Example Press New York'
    );

    expect(search).toMatchObject({
      rawCitation:
        'Synthetic Research Topics / edited by Example Editor A., Sample Editor B., and Test Editor C. (1st ed. 2014.). Example Press New York',
      builtQuery: 'TI (Synthetic Research Topics) AND SO (Example Press New York)',
    });

    expect(search.fieldQueries).toEqual([
      { field: 'TI', term: 'Synthetic Research Topics', boolean: undefined },
      { field: 'SO', term: 'Example Press New York', boolean: 'AND' },
    ]);
  });

  it('drops the author-year preface when a citation title is a slash-style edited book', () => {
    const [search] = prepareCitationBatchSearches(
      'Example, A., Sample, B., Test, C., and Demo Catalog (online service). (2014). Synthetic Research Topics / edited by Example Editor A., Sample Editor B., and Test Editor C. (1st ed. 2014.). Example Press New York.'
    );

    expect(search).toMatchObject({
      rawCitation:
        'Example, A., Sample, B., Test, C., and Demo Catalog (online service). (2014). Synthetic Research Topics / edited by Example Editor A., Sample Editor B., and Test Editor C. (1st ed. 2014.). Example Press New York.',
      builtQuery: 'TI (Synthetic Research Topics) AND SO (Example Press New York)',
    });

    expect(search.fieldQueries).toEqual([
      { field: 'TI', term: 'Synthetic Research Topics', boolean: undefined },
      { field: 'SO', term: 'Example Press New York', boolean: 'AND' },
    ]);
  });
});

describe('prepareCitationSearches', () => {
  it('prepares the edited citation lines directly without running extraction again', () => {
    const editedCitation = 'Example, A. (2014). A newly edited synthetic title. Example Journal, 60(2), 5-28.';

    expect(prepareCitationSearches([editedCitation])[0]).toMatchObject({
      id: 'citation-1', rawCitation: editedCitation,
    });
  });
});

describe('executeCitationBatchSearch', () => {
  it('returns grouped results for each prepared citation and preserves order', async () => {
    const searches = prepareCitationBatchSearches(`Test Author, “A Synthetic Citation Parsing Title,” Example Journal 60, 2 (June 2014): 5-28

Sample Author, “A Synthetic Research Topic,” Example Social Journal 22, 2 (2004): 117-139.`);

    const searchFn = vi
      .fn<
        (query: string | CitationFieldQuery[]) => Promise<{
          results: CitationSearchResult[];
          totalHits: number;
          searchTime: number;
          queryString: string;
          appliedLimiters: string[];
        }>
      >()
      .mockResolvedValueOnce({
        results: [makeResult('1', 'First result')],
        totalHits: 1,
        searchTime: 12,
        queryString: 'first',
        appliedLimiters: [],
      })
      .mockResolvedValueOnce({
        results: [makeResult('2', 'Second result'), makeResult('3', 'Third result')],
        totalHits: 2,
        searchTime: 18,
        queryString: 'second',
        appliedLimiters: [],
      });

    const groups = await executeCitationBatchSearch(searches, searchFn);

    expect(groups).toHaveLength(2);
    expect(groups[0].results).toHaveLength(1);
    expect(groups[0].results[0].title).toBe('First result');
    expect(groups[1].results).toHaveLength(2);
    expect(groups[1].results[1].title).toBe('Third result');
    expect(searchFn).toHaveBeenNthCalledWith(1, searches[0].fieldQueries, 1, undefined, undefined, undefined);
    expect(searchFn).toHaveBeenNthCalledWith(2, searches[1].fieldQueries, 1, undefined, undefined, undefined);
  });

  it('captures per-citation errors instead of aborting the whole batch', async () => {
    const searches = prepareCitationBatchSearches(`Test Author, “A Synthetic Citation Parsing Title,” Example Journal 60, 2 (June 2014): 5-28

Sample Author, “A Synthetic Research Topic,” Example Social Journal 22, 2 (2004): 117-139.`);

    const searchFn = vi
      .fn<
        (query: string | CitationFieldQuery[]) => Promise<{
          results: CitationSearchResult[];
          totalHits: number;
          searchTime: number;
          queryString: string;
          appliedLimiters: string[];
        }>
      >()
      .mockResolvedValueOnce({
        results: [makeResult('1', 'First result')],
        totalHits: 1,
        searchTime: 12,
        queryString: 'first',
        appliedLimiters: [],
      })
      .mockRejectedValueOnce(new Error('EDS unavailable'));

    const groups = await executeCitationBatchSearch(searches, searchFn);

    expect(groups[0].error).toBeUndefined();
    expect(groups[1]).toMatchObject({
      error: 'EDS unavailable',
      results: [],
      totalHits: 0,
    });
  });

  it('limits concurrency to three, backs off after 429, keeps citation order, and continues', async () => {
    const citationPaste = Array.from({ length: 5 }, (_, index) =>
      `Example Author (2020). Synthetic title ${index + 1}. Journal of Synthetic Studies, 1(2), 1-5.`
    ).join('\n\n');
    const searches = prepareCitationBatchSearches(citationPaste);
    const attempts = new Map<string, number>();
    let activeSearches = 0;
    let maximumConcurrent = 0;
    const searchFn = vi.fn(async (query: string | CitationFieldQuery[]) => {
      const title = Array.isArray(query) ? query.find((part) => part.field === 'TI')?.term || '' : query;
      const attempt = attempts.get(title) || 0;
      attempts.set(title, attempt + 1);
      activeSearches += 1;
      maximumConcurrent = Math.max(maximumConcurrent, activeSearches);
      try {
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (title.includes('Synthetic title 1') && attempt === 0) {
          throw Object.assign(new Error('There are too many searches right now. Please wait a moment and try again.'), { status: 429 });
        }
        return {
          results: [makeResult(title, title)], totalHits: 1, searchTime: 1,
          queryString: title, appliedLimiters: [],
        };
      } finally {
        activeSearches -= 1;
      }
    });
    const wait = vi.fn(async () => undefined);
    const progress = vi.fn();

    const groups = await executeCitationBatchSearch(searches, searchFn, undefined, { wait, onProgress: progress });

    expect(maximumConcurrent).toBeGreaterThan(1);
    expect(maximumConcurrent).toBeLessThanOrEqual(3);
    expect(searchFn).toHaveBeenCalledTimes(6);
    expect(wait).toHaveBeenCalledWith(250);
    expect(groups.map((group) => group.rawCitation)).toEqual(searches.map((search) => search.rawCitation));
    expect(groups.every((group) => group.results.length === 1)).toBe(true);
    expect(progress).toHaveBeenLastCalledWith(5, 5);
  });

  it('keeps a friendly failure reference with the affected citation and searches the rest', async () => {
    const searches = prepareCitationBatchSearches(`Test Author, “A Synthetic Citation Parsing Title,” Example Journal 60, 2 (June 2014): 5-28

Sample Author, “A Synthetic Research Topic,” Example Social Journal 22, 2 (2004): 117-139.`);
    const searchFn = vi.fn()
      .mockRejectedValueOnce(new Error('Library search is temporarily unavailable. Please try again later, or add the item by citation.\nReference: 7F3K2Q'))
      .mockResolvedValueOnce({ results: [makeResult('2', 'Second result')], totalHits: 1, searchTime: 1, queryString: 'second', appliedLimiters: [] });

    const groups = await executeCitationBatchSearch(searches, searchFn);

    expect(groups[0].error).toContain('Reference: 7F3K2Q');
    expect(groups[1].results[0].title).toBe('Second result');
  });

  it('falls back from author-title-source to title-source to DOI to title-only when needed', async () => {
    const [search] = prepareCitationBatchSearches(
      'Example, Author (2025). Synthetic Neural Activity Research Methods. Example Press. https://doi.org/10.1234/test.neural.2025'
    );

    const searchFn = vi
      .fn<
        (query: string | CitationFieldQuery[]) => Promise<{
          results: CitationSearchResult[];
          totalHits: number;
          searchTime: number;
          queryString: string;
          appliedLimiters: string[];
        }>
      >()
      .mockResolvedValueOnce({
        results: [],
        totalHits: 0,
        searchTime: 8,
        queryString: 'strict',
        appliedLimiters: [],
      })
      .mockResolvedValueOnce({
        results: [],
        totalHits: 0,
        searchTime: 7,
        queryString: 'relaxed',
        appliedLimiters: [],
      })
      .mockResolvedValueOnce({
        results: [makeResult('example-doi', 'Synthetic Neural Activity Research via DOI')],
        totalHits: 1,
        searchTime: 6,
        queryString: 'doi-match',
        appliedLimiters: [],
      })
      .mockResolvedValueOnce({
        results: [makeResult('example-1', 'Synthetic Neural Activity Research')],
        totalHits: 1,
        searchTime: 5,
        queryString: 'title-only',
        appliedLimiters: [],
      });

    const [group] = await executeCitationBatchSearch([search], searchFn);

    expect(searchFn).toHaveBeenCalledTimes(3);
    expect(searchFn).toHaveBeenNthCalledWith(1, [
      { field: 'AU', term: 'Example, Author' },
      { field: 'TI', term: 'Synthetic Neural Activity Research Methods', boolean: 'AND' },
      { field: 'SO', term: 'Example Press', boolean: 'AND' },
    ], 1, undefined, undefined, undefined);
    expect(searchFn).toHaveBeenNthCalledWith(2, [
      { field: 'TI', term: 'Synthetic Neural Activity Research Methods' },
      { field: 'SO', term: 'Example Press', boolean: 'AND' },
    ], 1, undefined, undefined, undefined);
    expect(searchFn).toHaveBeenNthCalledWith(3, '10.1234/test.neural.2025', 1, undefined, undefined, undefined);
    expect(group.results).toHaveLength(1);
    expect(group.totalHits).toBe(1);
    expect(group.results[0].title).toBe('Synthetic Neural Activity Research via DOI');
    expect(group.matchedQuery).toBe('DOI (10.1234/test.neural.2025)');
    expect(group.attemptedQueries).toEqual([
      'AU (Example, Author) AND TI (Synthetic Neural Activity Research Methods) AND SO (Example Press)',
      'TI (Synthetic Neural Activity Research Methods) AND SO (Example Press)',
      'DOI (10.1234/test.neural.2025)',
    ]);
  });
});
