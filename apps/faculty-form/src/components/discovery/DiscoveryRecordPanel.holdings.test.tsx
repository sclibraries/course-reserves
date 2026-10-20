import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import type { CatalogAvailability } from '@/services/catalogAvailabilityApi';
import DiscoveryRecordPanel from './DiscoveryRecordPanel';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const baseRecord = {
  id: 'synthetic-an',
  dbId: 'synthetic-database',
  title: 'Synthetic title',
  authors: [],
  publicationType: 'Book',
  database: 'Synthetic database',
  pLink: '',
  hasFullText: false,
};

describe('DiscoveryRecordPanel holdings', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('lists every physical copy with Smith first and other copies in API order', () => {
    const availability: CatalogAvailability = {
      instanceId: 'synthetic-instance',
      copies: [
        { library: 'Mount Holyoke College Library', location: 'Mount Holyoke College Main Stacks', callNumber: 'QA 76 .A1', status: 'Available', loanType: 'Standard Loan' },
        { library: 'SC Neilson Library', location: 'Smith College Neilson Stacks', callNumber: 'QA 76 .A1', status: 'Checked out', loanType: 'Standard Loan' },
        { library: 'UMass Amherst Library', location: 'UMass Amherst Du Bois Library', callNumber: 'QA 76 .A1', status: 'Available', loanType: 'Standard Loan' },
      ],
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(
      <DiscoveryRecordPanel record={baseRecord as DiscoverySearchResult} availability={availability} />,
    ));

    const copies = Array.from(container.querySelectorAll('li')).map((item) => item.textContent);
    expect(copies).toEqual([
      'SC Neilson Library · Smith College Neilson Stacks · QA 76 .A1 · Checked out',
      'Mount Holyoke College Library · Mount Holyoke College Main Stacks · QA 76 .A1 · Available',
      'UMass Amherst Library · UMass Amherst Du Bois Library · QA 76 .A1 · Available',
    ]);
  });

  it('lists every electronic EDS holdings pair with Smith first', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(
      <DiscoveryRecordPanel
        record={{
          ...baseRecord,
          publicationType: 'eBook',
          holdings: [
            { Sublocation: 'Mount Holyoke College Online', ShelfLocator: 'Digital library' },
            { Sublocation: 'Smith College Online', ShelfLocator: 'JSTOR DDA' },
          ],
        } as DiscoverySearchResult}
      />,
    ));

    const copies = Array.from(container.querySelectorAll('li')).map((item) => item.textContent);
    expect(copies).toEqual([
      'Smith College Online · JSTOR DDA',
      'Mount Holyoke College Online · Digital library',
    ]);
  });
});
