import { describe, expect, it, vi } from 'vitest';

import type { DiscoverySearchResult, FieldQuery } from '@/services/discoverySearchService';

import {
  executeCitationBatchSearch,
  prepareCitationBatchSearches,
} from './citationBatchSearch';

function makeResult(id: string, title: string): DiscoverySearchResult {
  return {
    id,
    title,
    authors: [],
    publicationType: 'Academic Journal',
    database: 'EBSCO Discovery Service',
    pLink: `https://example.test/${id}`,
    hasFullText: false,
  };
}

describe('prepareCitationBatchSearches', () => {
  it('turns a multiline citation paste into per-citation field queries', () => {
    const searches = prepareCitationBatchSearches(`Melanie Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” Caribbean Quarterly 60, 2 (June 2014): 5-28

Słupińska, K., Duda, J., & Biercewicz, K. (2021). Planning an experiment in a
virtual environment reality as a place of research on human behaviour using
methods of neuroscience measurement – bibliometric analysis and methodological
approach. Procedia Computer Science, 192, 3123–3133.
https://doi.org/10.1016/j.procs.2021.09.085`);

    expect(searches).toHaveLength(2);

    expect(searches[0]).toMatchObject({
      rawCitation:
        'Melanie Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” Caribbean Quarterly 60, 2 (June 2014): 5-28',
      builtQuery:
        'AU (Melanie Newton) AND TI (The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean) AND SO (Caribbean Quarterly)',
    });

    expect(searches[1]).toMatchObject({
      rawCitation:
        'Słupińska, K., Duda, J., & Biercewicz, K. (2021). Planning an experiment in a virtual environment reality as a place of research on human behaviour using methods of neuroscience measurement – bibliometric analysis and methodological approach. Procedia Computer Science, 192, 3123–3133. https://doi.org/10.1016/j.procs.2021.09.085',
      builtQuery:
        'TI (Planning an experiment in a virtual environment reality as a place of research on human behaviour using methods of neuroscience measurement – bibliometric analysis and methodological approach) AND SO (Procedia Computer Science)',
    });

    expect(searches[1].fieldQueries.map((query) => query.field)).toEqual(['TI', 'SO']);
  });

  it('builds a title-plus-source query for slash-style edited book citations', () => {
    const [search] = prepareCitationBatchSearches(
      'Vascular Mechanisms in CNS Trauma / edited by Eng H. Lo, Josephine Lok, MingMing Ning, Michael J. Whalen (1st ed. 2014.). Springer New York'
    );

    expect(search).toMatchObject({
      rawCitation:
        'Vascular Mechanisms in CNS Trauma / edited by Eng H. Lo, Josephine Lok, MingMing Ning, Michael J. Whalen (1st ed. 2014.). Springer New York',
      builtQuery: 'TI (Vascular Mechanisms in CNS Trauma) AND SO (Springer New York)',
    });

    expect(search.fieldQueries).toEqual([
      { field: 'TI', term: 'Vascular Mechanisms in CNS Trauma', boolean: undefined },
      { field: 'SO', term: 'Springer New York', boolean: 'AND' },
    ]);
  });

  it('drops the author-year preface when a citation title is a slash-style edited book', () => {
    const [search] = prepareCitationBatchSearches(
      'Lo, E. H., Lok, J., Ning, M., Whalen, M. J., & SpringerLink (Online service). (2014). Vascular Mechanisms in CNS Trauma / edited by Eng H. Lo, Josephine Lok, MingMing Ning, Michael J. Whalen (1st ed. 2014.). Springer New York.'
    );

    expect(search).toMatchObject({
      rawCitation:
        'Lo, E. H., Lok, J., Ning, M., Whalen, M. J., & SpringerLink (Online service). (2014). Vascular Mechanisms in CNS Trauma / edited by Eng H. Lo, Josephine Lok, MingMing Ning, Michael J. Whalen (1st ed. 2014.). Springer New York.',
      builtQuery: 'TI (Vascular Mechanisms in CNS Trauma) AND SO (Springer New York)',
    });

    expect(search.fieldQueries).toEqual([
      { field: 'TI', term: 'Vascular Mechanisms in CNS Trauma', boolean: undefined },
      { field: 'SO', term: 'Springer New York', boolean: 'AND' },
    ]);
  });
});

describe('executeCitationBatchSearch', () => {
  it('returns grouped results for each prepared citation and preserves order', async () => {
    const searches = prepareCitationBatchSearches(`Melanie Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” Caribbean Quarterly 60, 2 (June 2014): 5-28

Sarah Ahmed, “Affective Economies,” Social Text 22, 2 (2004): 117-139.`);

    const searchFn = vi
      .fn<
        (query: string | FieldQuery[]) => Promise<{
          results: DiscoverySearchResult[];
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
    const searches = prepareCitationBatchSearches(`Melanie Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” Caribbean Quarterly 60, 2 (June 2014): 5-28

Sarah Ahmed, “Affective Economies,” Social Text 22, 2 (2004): 117-139.`);

    const searchFn = vi
      .fn<
        (query: string | FieldQuery[]) => Promise<{
          results: DiscoverySearchResult[];
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

  it('falls back from author-title-source to title-source to DOI to title-only when needed', async () => {
    const [search] = prepareCitationBatchSearches(
      'Feng, Z. (2025). Electrical Brain Stimulation: Mechanisms and Modulation of Neuronal Activity. Springer Nature. https://doi.org/10.1007/978-981-95-4145-4'
    );

    const searchFn = vi
      .fn<
        (query: string | FieldQuery[]) => Promise<{
          results: DiscoverySearchResult[];
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
        results: [makeResult('feng-doi', 'Electrical Brain Stimulation via DOI')],
        totalHits: 1,
        searchTime: 6,
        queryString: 'doi-match',
        appliedLimiters: [],
      })
      .mockResolvedValueOnce({
        results: [makeResult('feng-1', 'Electrical Brain Stimulation')],
        totalHits: 1,
        searchTime: 5,
        queryString: 'title-only',
        appliedLimiters: [],
      });

    const [group] = await executeCitationBatchSearch([search], searchFn);

    expect(searchFn).toHaveBeenCalledTimes(3);
    expect(searchFn).toHaveBeenNthCalledWith(1, [
      { field: 'AU', term: 'Feng, Z.' },
      { field: 'TI', term: 'Electrical Brain Stimulation: Mechanisms and Modulation of Neuronal Activity', boolean: 'AND' },
      { field: 'SO', term: 'Springer Nature', boolean: 'AND' },
    ], 1, undefined, undefined, undefined);
    expect(searchFn).toHaveBeenNthCalledWith(2, [
      { field: 'TI', term: 'Electrical Brain Stimulation: Mechanisms and Modulation of Neuronal Activity' },
      { field: 'SO', term: 'Springer Nature', boolean: 'AND' },
    ], 1, undefined, undefined, undefined);
    expect(searchFn).toHaveBeenNthCalledWith(3, '10.1007/978-981-95-4145-4', 1, undefined, undefined, undefined);
    expect(group.results).toHaveLength(1);
    expect(group.totalHits).toBe(1);
    expect(group.results[0].title).toBe('Electrical Brain Stimulation via DOI');
    expect(group.matchedQuery).toBe('DOI (10.1007/978-981-95-4145-4)');
    expect(group.attemptedQueries).toEqual([
      'AU (Feng, Z.) AND TI (Electrical Brain Stimulation: Mechanisms and Modulation of Neuronal Activity) AND SO (Springer Nature)',
      'TI (Electrical Brain Stimulation: Mechanisms and Modulation of Neuronal Activity) AND SO (Springer Nature)',
      'DOI (10.1007/978-981-95-4145-4)',
    ]);
  });
});