import { getByRole } from '@testing-library/dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SearchTab from './SearchTab';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  useDiscoverySearch: vi.fn(),
  useSelection: vi.fn(),
  useCatalogAvailability: vi.fn(),
  useInfiniteScroll: vi.fn(),
  useOpenDiscoveryRecord: vi.fn(),
  useDiscoveryResultActions: vi.fn(),
}));

vi.mock('@/hooks/useDiscoverySearch', () => ({ useDiscoverySearch: mocks.useDiscoverySearch }));
vi.mock('@/hooks/useSelection', () => ({ useSelection: mocks.useSelection }));
vi.mock('@/hooks/useCatalogAvailability', () => ({ useCatalogAvailability: mocks.useCatalogAvailability }));
vi.mock('@/hooks/useInfiniteScroll', () => ({ useInfiniteScroll: mocks.useInfiniteScroll }));
vi.mock('@/hooks/useOpenDiscoveryRecord', () => ({ useOpenDiscoveryRecord: mocks.useOpenDiscoveryRecord }));
vi.mock('./useOnEscape', () => ({ useOnEscape: vi.fn() }));
vi.mock('./useDiscoveryResultActions', () => ({ useDiscoveryResultActions: mocks.useDiscoveryResultActions }));
vi.mock('@/components/discovery/DiscoveryFilterBar', () => ({ default: () => null }));
vi.mock('@/components/discovery/DiscoveryRecordPanel', () => ({ default: () => null }));
vi.mock('@/components/discovery/DiscoveryResultCard', () => ({ default: () => null }));

describe('SearchTab accessibility', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mocks.useDiscoverySearch.mockReturnValue({
      query: '',
      results: [],
      totalHits: 0,
      searchTime: 0,
      loading: false,
      loadingMore: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      setQuery: vi.fn(),
      filters: {},
      facets: [],
      setFilter: vi.fn(),
    });
    mocks.useSelection.mockReturnValue({
      record: null,
      selectedId: null,
      loading: false,
      error: null,
      loadRecord: vi.fn(),
      clearSelection: vi.fn(),
    });
    mocks.useCatalogAvailability.mockReturnValue({ get: () => ({ loading: false, failed: false }) });
    mocks.useInfiniteScroll.mockReturnValue(() => undefined);
    mocks.useOpenDiscoveryRecord.mockReturnValue(vi.fn());
    mocks.useDiscoveryResultActions.mockReturnValue({
      id: 'submission-1',
      isDuplicate: () => false,
      addResult: vi.fn(),
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it('keeps the named search results region out of the tab order when it cannot scroll', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SearchTab /></MemoryRouter>));

    const results = getByRole(container, 'region', { name: 'Search results' });
    expect(results.getAttribute('tabindex')).toBeNull();
  });
});
