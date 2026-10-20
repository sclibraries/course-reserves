import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import type { CatalogAvailability } from '@/services/catalogAvailabilityApi';
import DiscoveryAvailabilityBadge from './DiscoveryAvailabilityBadge';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function result(overrides: Partial<DiscoverySearchResult> = {}): DiscoverySearchResult {
  return {
    id: 'synthetic-an',
    dbId: 'synthetic-database',
    title: 'Synthetic title',
    authors: [],
    publicationType: 'Book',
    database: 'Synthetic database',
    pLink: '',
    hasFullText: false,
    ...overrides,
  };
}

describe('DiscoveryAvailabilityBadge', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  function renderBadge(record: DiscoverySearchResult, availability?: CatalogAvailability, loading = false, failed = false) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(
      <DiscoveryAvailabilityBadge result={record} availability={availability} loading={loading} failed={failed} />,
    ));
    return container;
  }

  it('shows live Smith availability for a physical catalog record', () => {
    const view = renderBadge(result(), {
      instanceId: 'synthetic-instance',
      copies: [{
        library: 'SC Neilson Library',
        location: 'Smith College Neilson Stacks',
        callNumber: 'QA 76 .A1',
        status: 'Available',
        loanType: 'Standard Loan',
      }],
    });

    expect(view.textContent).toContain('Available at Smith · Neilson Stacks');
    expect(view.textContent).not.toContain('Check availability');
  });

  it('labels EDS full text and Smith local electronic access without a live check', () => {
    const fullText = renderBadge(result({ publicationType: 'Academic Journal', hasFullText: true }));
    expect(fullText.textContent).toContain('Full text available');
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;

    const dda = renderBadge(result({ publicationType: 'eBook', dbId: 'cat09114a' }));
    expect(dda.textContent).toContain('Online at Smith');
  });

  it('labels records with no Smith online access', () => {
    const view = renderBadge(result({
      publicationType: 'Electronic Resource',
      holdings: [{ Sublocation: 'Mount Holyoke College Online', ShelfLocator: 'Digital library' }],
    }));

    expect(view.textContent).toContain('Not held by Smith');
  });
});
