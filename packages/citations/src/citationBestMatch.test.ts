import { describe, expect, it } from 'vitest';
import { findCitationBestMatch } from './citationBestMatch';

function makeResult(id: string, title: string) {
  return { id, title };
}

describe('findCitationBestMatch', () => {
  it('ranks the quoted citation title above an earlier search result', () => {
    const first = makeResult('first', 'Synthetic Article');
    const best = makeResult('best', 'A Synthetic Citation Parsing Title');
    const last = makeResult('last', 'Example Narrative and Synthetic History');

    expect(findCitationBestMatch('Test Author, “A Synthetic Citation Parsing Title,” 2014', [first, best, last]))
      .toEqual({ best, others: [first, last] });
  });

  it('uses the text before the first period when the citation has no quoted title', () => {
    const exact = makeResult('exact', 'Study of quantum-fields: a concise review');
    const partial = makeResult('partial', 'Quantum field notes');

    expect(findCitationBestMatch('A Synthetic Fields Study. Example Journal of Science, 2025.', [partial, exact]).best).toBe(exact);
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
