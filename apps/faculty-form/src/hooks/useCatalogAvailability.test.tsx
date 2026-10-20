import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import { useCatalogAvailability } from './useCatalogAvailability';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function result(id: string, publicationType = 'Book'): DiscoverySearchResult {
  return {
    id,
    dbId: 'synthetic-database',
    title: id,
    authors: [],
    publicationType,
    database: 'Synthetic database',
    pLink: '',
    hasFullText: publicationType === 'eBook',
  };
}

function Harness({ results, requestKey }: { results: DiscoverySearchResult[]; requestKey: string }) {
  const state = useCatalogAvailability(results, requestKey);
  return <output>{JSON.stringify(state)}</output>;
}

describe('useCatalogAvailability', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    vi.unstubAllGlobals();
  });

  it('fetches only physical accession numbers in batches of 20 and does not refetch on rerender', async () => {
    const results = Array.from({ length: 22 }, (_value, index) => result('synthetic-an-' + (index + 1)));
    results.push(result('synthetic-electronic-an', 'eBook'));
    const fetchMock = vi.fn(async (url: string) => {
      const accessionNumbers = new URL(url).searchParams.get('an')?.split(',') || [];
      return {
        ok: true,
        json: async () => ({
          records: Object.fromEntries(accessionNumbers.map((an) => [an, { instanceId: null, copies: [] }])),
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<Harness results={results} requestKey="search-page-1" />));
    await act(async () => {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(container?.textContent).toContain('"failed":false'));
    });

    const requested = fetchMock.mock.calls.flatMap(([url]) => new URL(url).searchParams.get('an')?.split(',') || []);
    expect(requested).toHaveLength(22);
    expect(requested).not.toContain('synthetic-electronic-an');
    expect(fetchMock.mock.calls.map(([url]) => new URL(url).searchParams.get('an')?.split(',').length)).toEqual([20, 2]);
    expect(container.textContent).toContain('"failed":false');

    await act(async () => {
      root?.render(<Harness results={results} requestKey="search-page-1" />);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    act(() => root?.render(<Harness results={results} requestKey="search-page-2" />));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  });

  it('reports a generic failure state when an availability request fails', async () => {
    let rejectFetch: (reason: Error) => void = () => undefined;
    const fetchMock = vi.fn(() => new Promise((_resolve, reject) => {
      rejectFetch = reject;
    }));
    vi.stubGlobal('fetch', fetchMock);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<Harness results={[result('synthetic-an')]} requestKey="search-page-1" />));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await act(async () => {
      rejectFetch(new Error('upstream body must stay hidden'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('"failed":true');
    expect(container.textContent).not.toContain('upstream body');
  });
});
