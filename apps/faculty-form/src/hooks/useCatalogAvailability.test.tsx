import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as catalogAvailabilityApi from '@/services/catalogAvailabilityApi';
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

function Harness({ results }: { results: DiscoverySearchResult[] }) {
  const availability = useCatalogAvailability(results);
  return <output>{JSON.stringify(results.map((record) => availability.get(record.id)))}</output>;
}

function ResultsOnlyHarness({ results }: { results: DiscoverySearchResult[] }) {
  useCatalogAvailability(results);
  return null;
}

describe('useCatalogAvailability', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    vi.restoreAllMocks();
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

    act(() => root?.render(<Harness results={results} />));
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
      root?.render(<Harness results={results} />);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const loadedMore = [...results, result('synthetic-an-23'), result('synthetic-electronic-an-2', 'eBook')];
    act(() => root?.render(<Harness results={loadedMore} />));
    await act(async () => {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    });
    const requestedAfterLoadMore = fetchMock.mock.calls.slice(2).flatMap(([url]) => (
      new URL(url).searchParams.get('an')?.split(',') || []
    ));
    expect(requestedAfterLoadMore).toEqual(['synthetic-an-23']);
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

    act(() => root?.render(<Harness results={[result('synthetic-an')]} />));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await act(async () => {
      rejectFetch(new Error('upstream body must stay hidden'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('"failed":true');
    expect(container.textContent).not.toContain('upstream body');
  });

  it('re-asks for shown accession numbers when results change so the service controls expiry', async () => {
    const request = vi.spyOn(catalogAvailabilityApi, 'getCatalogAvailability').mockImplementation(async (ans) => (
      Object.fromEntries(ans.map((an) => [an, { instanceId: null, copies: [] }]))
    ));
    const firstPage = [result('synthetic-page-one-an')];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<ResultsOnlyHarness results={firstPage} />));
    await act(async () => {
      await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    });
    expect(request).toHaveBeenLastCalledWith(['synthetic-page-one-an']);

    const loadedMore = [...firstPage, result('synthetic-page-two-an')];
    act(() => root?.render(<ResultsOnlyHarness results={loadedMore} />));
    await act(async () => {
      await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    });

    expect(request.mock.calls).toEqual([
      [['synthetic-page-one-an']],
      [['synthetic-page-one-an', 'synthetic-page-two-an']],
    ]);
  });

  it('uses the resolved result lookup when the record route is shown', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      const an = new URL(input).searchParams.get('an') || '';
      return { ok: true, json: async () => ({ records: { [an]: { instanceId: null, copies: [] } } }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const resultRecord = result('synthetic-route-hook-an');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<Harness results={[resultRecord]} />));
    await act(async () => {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
      await vi.waitFor(() => expect(container?.textContent).toContain('"failed":false'));
    });

    act(() => root?.unmount());
    root = createRoot(container);
    act(() => root.render(<Harness results={[resultRecord]} />));
    await act(async () => {
      await vi.waitFor(() => expect(container?.textContent).toContain('"failed":false'));
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('retries a failed lookup when the result is shown again', async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async (input: string) => {
      attempts += 1;
      if (attempts === 1) return { ok: false, json: async () => ({}) };
      const an = new URL(input).searchParams.get('an') || '';
      return { ok: true, json: async () => ({ records: { [an]: { instanceId: null, copies: [] } } }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const results = [result('synthetic-failed-route-an')];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<Harness results={results} />));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('"failed":true');
    act(() => root?.unmount());
    root = createRoot(container);
    act(() => root.render(<Harness results={results} />));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('"failed":false');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refetches a visible result after the shared cache expires', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const fetchMock = vi.fn(async (input: string) => {
      const an = new URL(input).searchParams.get('an') || '';
      return { ok: true, json: async () => ({ records: { [an]: { instanceId: null, copies: [] } } }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<Harness results={[result('synthetic-hook-expiry-an')]} />));
    await act(async () => {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
      await vi.waitFor(() => expect(container?.textContent).toContain('"failed":false'));
    });

    now.mockReturnValue(122000);
    act(() => root?.render(<Harness results={[result('synthetic-hook-expiry-an')]} />));
    await act(async () => {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    });
  });
});
