import { describe, expect, it } from 'vitest';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import { findCitationBestMatch } from './citationBestMatch';

function makeResult(id: string, title: string): DiscoverySearchResult {
  return {
    id,
    dbId: 'synthetic-database',
    title,
    authors: [],
    publicationType: 'Academic Journal',
    database: 'Synthetic Database',
    pLink: `https://example.test/${id}`,
    hasFullText: false,
  };
}

describe('findCitationBestMatch', () => {
  it('ranks the quoted citation title above an earlier search result', () => {
    const first = makeResult('first', 'Synthetic Article');
    const best = makeResult('best', 'The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean');
    const last = makeResult('last', 'Race, Narrative, and Caribbean History');

    expect(findCitationBestMatch('Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” 2014', [first, best, last]))
      .toEqual({ best, others: [first, last] });
  });

  it('uses the text before the first period when the citation has no quoted title', () => {
    const exact = makeResult('exact', 'Study of quantum-fields: a concise review');
    const partial = makeResult('partial', 'Quantum field notes');

    expect(findCitationBestMatch('A Study of Quantum Fields. Journal of Physics, 2025.', [partial, exact]).best).toBe(exact);
  });

  it('keeps the first result when top overlap scores tie', () => {
    const first = makeResult('first', 'Climate study methods');
    const second = makeResult('second', 'Climate study notes');

    expect(findCitationBestMatch('“The climate study”', [first, second]).best).toBe(first);
  });

  it('keeps the first result when titles have no overlapping words', () => {
    const first = makeResult('first', 'Marine ecology');
    const second = makeResult('second', 'Quantum physics');

    expect(findCitationBestMatch('“Climate policy”', [first, second]).best).toBe(first);
  });

  it('ignores diacritics and punctuation when comparing title words', () => {
    const first = makeResult('first', 'Coffee farming');
    const best = makeResult('best', 'Café, au-lait: An Introduction!');

    expect(findCitationBestMatch('“Cafe au lait: an introduction”', [first, best]).best).toBe(best);
  });

  it('returns the only result as best with no other matches', () => {
    const only = makeResult('only', 'A single result');

    expect(findCitationBestMatch('“single result”', [only])).toEqual({ best: only, others: [] });
  });

  it('returns no best match when the search has no results', () => {
    expect(findCitationBestMatch('“single result”', [])).toEqual({ best: undefined, others: [] });
  });
});
