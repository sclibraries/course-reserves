import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import type { CatalogAvailability } from '@/services/catalogAvailabilityApi';
import { prepareCitationSearches } from '@/utils/citationBatchSearch';
import CitationReviewGroup from './CitationReviewGroup';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('CitationReviewGroup availability', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('shows the same live availability badge for the best pasted-citation match', () => {
    const result: DiscoverySearchResult = {
      id: 'synthetic-an',
      dbId: 'synthetic-database',
      title: 'Synthetic reserve book',
      authors: [],
      publicationType: 'Book',
      database: 'Synthetic database',
      pLink: '',
      hasFullText: false,
    };
    const prepared = prepareCitationSearches(['Synthetic reserve book.'], ['citation-1'])[0];
    const group = {
      ...prepared,
      results: [result],
      totalHits: 1,
      searchTime: 1,
      attemptedQueries: [prepared.builtQuery],
      matchedQuery: prepared.builtQuery,
    };
    const availability: CatalogAvailability = {
      instanceId: 'synthetic-instance',
      copies: [{
        library: 'SC Neilson Library',
        location: 'Smith College Neilson Stacks',
        callNumber: 'QA 76 .A1',
        status: 'Available',
        loanType: 'Standard Loan',
      }],
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(
      <CitationReviewGroup
        citation={{ id: 'citation-1', text: 'Synthetic reserve book.' }}
        index={0}
        group={group}
        isResultDuplicate={() => false}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onAddAsWritten={vi.fn()}
        onOpenRecord={vi.fn()}
        onAddMatch={vi.fn()}
        onUndo={vi.fn()}
        availability={(an) => an === 'synthetic-an'
          ? { entry: availability, loading: false, failed: false }
          : { loading: false, failed: false }}
      />,
    ));

    expect(container.textContent).toContain('Available at Smith · Neilson Stacks');
  });
});
