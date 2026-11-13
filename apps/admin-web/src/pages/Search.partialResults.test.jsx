import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getByRole, getByText, queryByRole, waitFor } from '@testing-library/dom';
import Search from './Search';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  searchState: {
    college: 'smith', type: 'item', query: 'synthetic', department: '', sortOption: '',
    termId: 'SYNTH-TERM', terms: [], displayMode: 'card',
    setCollege: vi.fn(), setType: vi.fn(), setQuery: vi.fn(), setDepartment: vi.fn(),
    setSortOption: vi.fn(), setTermId: vi.fn(), setDisplayMode: vi.fn(),
  },
  courseState: { fetchResults: vi.fn(), results: [], error: null, loading: false },
}));

vi.mock('../store', () => ({
  default: (selector) => selector(mocks.courseState),
}));
vi.mock('../store/searchStore', () => ({
  default: (selector) => (selector ? selector(mocks.searchState) : mocks.searchState),
}));
vi.mock('../store/customizationStore', () => ({
  default: (selector) => selector({ currentCollege: 'smith' }),
}));
vi.mock('../hooks/useBuildQuery', () => ({ useBuildQuery: () => 'synthetic query' }));
vi.mock('../services/trackingService', () => ({
  trackingService: { trackEvent: vi.fn().mockResolvedValue({}) },
}));
vi.mock('../components/page-sections/search/CourseList', () => ({ default: () => null }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { reserves: [{
        id: 'synthetic-print-1',
        copiedItem: { title: 'Synthetic print result' },
        course: { name: 'Synthetic course', courseNumber: 'SYN 101' },
      }] } }),
    })
    .mockResolvedValueOnce({ ok: false, status: 503 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('Search partial results feedback', () => {
  it('announces incomplete results before the print results when electronic search fails', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ['/search?college=smith&type=item&query=synthetic'] }, createElement(Search))));

    await waitFor(() => expect(getByRole(container, 'status').textContent).toMatch(/results may be incomplete/i));
    const notice = getByRole(container, 'status');
    const printResult = getByText(container, 'Synthetic print result');
    expect(notice.compareDocumentPosition(printResult) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    mocks.searchState.query = '';
    await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ['/search?college=smith&type=item&query=synthetic'] }, createElement(Search))));
    expect(queryByRole(container, 'status')).toBeNull();
  });
});
