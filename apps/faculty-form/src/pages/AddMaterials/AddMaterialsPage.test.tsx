import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseReserve } from '@/store/courseReservesStore';
import SubmissionEditorContext, { type SubmissionEditorContextValue } from '@/pages/SubmissionEditor/SubmissionEditorContext';
import { retrieveDiscoveryRecord, searchDiscovery } from '@/services/discoverySearchService';
import AddMaterialsPage from './AddMaterialsPage';

vi.mock('@/services/discoverySearchService', () => ({
  searchDiscovery: vi.fn(),
  retrieveDiscoveryRecord: vi.fn(),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const searchResult = {
  id: 'synthetic-an', dbId: 'synthetic-database', title: 'Synthetic Article', authors: ['Test Author'],
  publicationType: 'Academic Journal', publicationInfo: 'Synthetic Journal', database: 'Synthetic Database',
  pLink: 'https://search.ebscohost.com/record/synthetic', doi: '10.1000/synthetic',
  hasFullText: true, fullTextUrl: 'https://example.edu/full-text',
};
const secondSearchResult = {
  ...searchResult, id: 'second-an', dbId: 'second-database', title: 'Second Synthetic Article',
};
const fullAbstract = `Full synthetic abstract for faculty review. ${'Additional untruncated synthetic detail. '.repeat(18)}`;
const fullRecord = {
  ...searchResult,
  edition: 'Second edition', publisher: 'Synthetic Publisher', publicationDate: { year: '2025' },
  subjects: ['Synthetic subject'], abstract: fullAbstract,
  isbn: '9780000000000', issn: '1234-5678', location: 'Neilson', callNumber: 'QA 1',
  fullTextLinks: [{ Category: 'Full Text', Name: 'PDF', Url: 'https://example.edu/full-text' }],
};
const reserve: CourseReserve = {
  id: 'reserve-test', courseCode: 'BIO 220', courseTitle: 'Ecology', section: '01', instructors: 'Test Faculty',
  term: 'Fall 2026', status: 'draft', items: [{ id: 'existing', title: 'Existing', materialType: 'article', status: 'draft', doi: '10.1000/synthetic' }],
  folders: [], lastUpdated: '2026-10-01',
};

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

function createContext(overrides: Partial<SubmissionEditorContextValue> = {}) {
  return {
    id: reserve.id, reserve, isEditingSubmission: false, hasPreviousOffering: true,
    isReadOnly: false, lockInfo: null, saveDraft: vi.fn(), isSaving: false, hasUnsavedChanges: false,
    lastSaveTime: null, saveError: null, setDiscoverySearchOpen: vi.fn(),
    setSyllabusUploadOpen: vi.fn(), itemHandlers: { handleAddItem: vi.fn() }, folderHandlers: {}, courseHandlers: {},
    dragHandlers: {}, submissionHandlers: {}, markChanged: vi.fn(), removeItemFromFolder: vi.fn(),
    moveItemInFolder: vi.fn(), addItemToFolder: vi.fn(), moveFolderPosition: vi.fn(), user: null,
    addItem: vi.fn(() => true), createFolder: vi.fn(() => 'target-folder'), addItemsFromExternalSource: vi.fn(),
    addedMaterials: [], undoAddedMaterial: vi.fn(),
    ...overrides,
  } as unknown as SubmissionEditorContextValue;
}

describe('AddMaterialsPage', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let originalWidth = 1024;

  beforeEach(() => {
    originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    vi.mocked(searchDiscovery).mockResolvedValue({
      results: [searchResult], totalHits: 1, searchTime: 5, queryString: 'climate change',
      appliedLimiters: [], facets: { sourceTypes: ['Academic Journals'], publicationYears: ['2025'] },
    });
    vi.mocked(retrieveDiscoveryRecord).mockResolvedValue(fullRecord);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  });

  const renderAt = async (entry: string, context = createContext()) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <SubmissionEditorContext.Provider value={context}>
          <MemoryRouter initialEntries={[entry]}>
            <Routes>
              <Route path="/submission/:id/edit/add" element={<><AddMaterialsPage /><LocationProbe /></>} />
              <Route path="/submission/:id/edit/add/record/:dbId/:an" element={<><AddMaterialsPage /><LocationProbe /></>} />
            </Routes>
          </MemoryRouter>
        </SubmissionEditorContext.Provider>
      );
      await Promise.resolve();
    });
    return container;
  };

  it('restores the query and filters from the URL and marks an existing result as a duplicate', async () => {
    const view = await renderAt('/submission/reserve-test/edit/add?tab=search&q=climate%20change&ft=1');

    expect(view.querySelector('input')?.value).toBe('climate change');
    expect(searchDiscovery).toHaveBeenCalledWith('climate change', 1, undefined, expect.objectContaining({ fullText: true }));
    expect(view.textContent).toContain('In your list ✓');
  });

  it('shows the retrieved full record beside results and adds structured fields', async () => {
    const context = createContext({ reserve: { ...reserve, items: [] } });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=search&q=climate%20change', context);
    const openRecord = view.querySelector('[aria-label="Open full record for Synthetic Article"]') as HTMLButtonElement;

    await act(async () => {
      openRecord.click();
      await Promise.resolve();
    });
    expect(retrieveDiscoveryRecord).toHaveBeenCalledWith('synthetic-database', 'synthetic-an');
    expect(view.textContent).toContain(fullAbstract);
    expect(view.textContent).toContain('Synthetic subject');

    const add = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Add to my list'));
    await act(async () => add?.click());
    expect(context.addItem).toHaveBeenCalledWith('reserve-test', expect.objectContaining({
      doi: '10.1000/synthetic', issn: '1234-5678', eds: expect.objectContaining({ an: 'synthetic-an' }),
    }));
  });

  it('renders independently scrollable, keyboard-focusable panes on desktop', async () => {
    const view = await renderAt('/submission/reserve-test/edit/add?tab=search&q=climate%20change');
    const results = view.querySelector('[aria-label="Search results"]') as HTMLElement;
    const record = view.querySelector('[aria-label="Full record"]') as HTMLElement;

    expect(results).not.toBeNull();
    expect(record).not.toBeNull();
    expect(results.tabIndex).toBe(0);
    expect(record.tabIndex).toBe(0);
    expect(results.className).toContain('md:overflow-y-auto');
    expect(record.className).toContain('md:overflow-y-auto');
    expect(results.className).toContain('md:min-h-0');
    expect(record.className).toContain('md:min-h-0');
  });

  it('keeps the results scroll position and resets the record pane for each selection', async () => {
    vi.mocked(searchDiscovery).mockResolvedValue({
      results: [searchResult, secondSearchResult], totalHits: 2, searchTime: 5, queryString: 'climate change',
      appliedLimiters: [], facets: { sourceTypes: [], publicationYears: [] },
    });
    vi.mocked(retrieveDiscoveryRecord).mockImplementation(async (dbId, an) => ({
      ...fullRecord, dbId, id: an, title: an === 'second-an' ? 'Second Synthetic Article' : fullRecord.title,
    }));
    const view = await renderAt('/submission/reserve-test/edit/add?tab=search&q=climate%20change');
    const results = view.querySelector('[aria-label="Search results"]') as HTMLElement;
    const recordPane = view.querySelector('[aria-label="Full record"]') as HTMLElement;
    results.scrollTop = 240;
    recordPane.scrollTop = 320;

    await act(async () => {
      (view.querySelector('[aria-label="Open full record for Synthetic Article"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(results.scrollTop).toBe(240);
    expect(recordPane.scrollTop).toBe(0);
    expect(view.textContent).toContain('Selected');

    recordPane.scrollTop = 280;
    await act(async () => {
      (view.querySelector('[aria-label="Open full record for Second Synthetic Article"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(results.scrollTop).toBe(240);
    expect(recordPane.scrollTop).toBe(0);
    expect(retrieveDiscoveryRecord).toHaveBeenLastCalledWith('second-database', 'second-an');
  });

  it('uses the results pane as the infinite-scroll root', async () => {
    const instances: Array<{ options: IntersectionObserverInit; callback: IntersectionObserverCallback }> = [];
    class TestIntersectionObserver {
      readonly root: Element | Document | null;
      constructor(callback: IntersectionObserverCallback, readonly options: IntersectionObserverInit) {
        this.root = options.root ?? null;
        instances.push({ options, callback });
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords(): IntersectionObserverEntry[] { return []; }
    }
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
    vi.mocked(searchDiscovery).mockImplementation(async (_query, page) => ({
      results: [page === 1 ? searchResult : secondSearchResult], totalHits: 2, searchTime: 5, queryString: 'climate change',
      appliedLimiters: [], facets: { sourceTypes: [], publicationYears: [] },
    }));
    const view = await renderAt('/submission/reserve-test/edit/add?tab=search&q=climate%20change');
    const results = view.querySelector('[aria-label="Search results"]');

    expect(instances.length).toBeGreaterThan(0);
    expect(instances[0].options.root).toBe(results);
    await act(async () => {
      instances[0].callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      await Promise.resolve();
    });
    expect(searchDiscovery).toHaveBeenCalledWith('climate change', 2, 'climate change', expect.any(Object), expect.any(Array));
  });

  it('opens the record on its own phone route so Back returns to the URL state', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=search&q=climate%20change');
    const openRecord = view.querySelector('[aria-label="Open full record for Synthetic Article"]') as HTMLButtonElement;

    await act(async () => {
      openRecord.click();
      await Promise.resolve();
    });

    expect(view.querySelector('[data-testid="location"]')?.textContent).toContain('/submission/reserve-test/edit/add/record/synthetic-database/synthetic-an');
    expect(view.textContent).toContain('Back to results');
    const back = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Back to results'));
    await act(async () => {
      back?.click();
      await Promise.resolve();
    });
    expect(view.querySelector('[data-testid="location"]')?.textContent).toContain('/submission/reserve-test/edit/add?tab=search&q=climate+change');
  });
});
