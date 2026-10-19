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
    lastSaveTime: null, saveError: null,
    itemHandlers: { handleAddItem: vi.fn() }, folderHandlers: {}, courseHandlers: {},
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
    HTMLElement.prototype.scrollIntoView = () => undefined;
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

  it('lets faculty edit and remove extracted citations before matching', async () => {
    vi.mocked(searchDiscovery).mockClear();
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste');
    const pasteBox = view.querySelector('textarea[aria-label="Paste a reading list"]') as HTMLTextAreaElement | null;

    expect(pasteBox).toBeTruthy();
    if (!pasteBox) return;

    const paste = `Melanie Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” Caribbean Quarterly 60, 2 (June 2014): 5-28\n\nSarah Ahmed, “Affective Economies,” Social Text 22, 2 (2004): 117-139.`;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(pasteBox, paste);
      pasteBox.dispatchEvent(new Event('input', { bubbles: true }));
      pasteBox.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const extract = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Extract citations'));
    expect(extract).toBeTruthy();
    await act(async () => extract?.click());

    const firstCitation = view.querySelector('textarea[aria-label="Edit citation 1"]') as HTMLTextAreaElement | null;
    const removeSecond = Array.from(view.querySelectorAll('button')).find((button) => button.getAttribute('aria-label') === 'Remove citation 2');
    expect(firstCitation).toBeTruthy();
    expect(removeSecond).toBeTruthy();
    if (!firstCitation || !removeSecond) return;

    const editedCitation = 'Newton, M. (2014). Edited citation title. Caribbean Quarterly, 60(2), 5-28.';
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(firstCitation, editedCitation);
      firstCitation.dispatchEvent(new Event('input', { bubbles: true }));
      firstCitation.dispatchEvent(new Event('change', { bubbles: true }));
      removeSecond.click();
    });

    expect((view.querySelector('textarea[aria-label="Edit citation 1"]') as HTMLTextAreaElement).value).toBe(editedCitation);
    expect(view.querySelector('[aria-label="Edit citation 2"]')).toBeNull();

    const findMatches = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Find matches'));
    await act(async () => { findMatches?.click(); await Promise.resolve(); });
    const searchedQuery = vi.mocked(searchDiscovery).mock.calls[0]?.[0];
    expect(Array.isArray(searchedQuery) && searchedQuery.some((query) => query.field === 'TI' && query.term === 'Edited citation title')).toBe(true);
  });

  it('selects citations from different paths and adds them in citation order', async () => {
    const context = createContext({ reserve: { ...reserve, items: [] } });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste', context);
    const pasteBox = view.querySelector('textarea[aria-label="Paste a reading list"]') as HTMLTextAreaElement | null;
    expect(pasteBox).toBeTruthy();
    if (!pasteBox) return;

    const writtenCitation = 'Melanie Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” Caribbean Quarterly 60, 2 (June 2014): 5-28';
    const matchedCitation = 'Sarah Ahmed, “Affective Economies,” Social Text 22, 2 (2004): 117-139.';
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(pasteBox, `${writtenCitation}\n\n${matchedCitation}`);
      pasteBox.dispatchEvent(new Event('input', { bubbles: true }));
      pasteBox.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const extract = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Extract citations'));
    await act(async () => extract?.click());
    const findMatches = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Find matches'));
    expect(findMatches).toBeTruthy();
    await act(async () => {
      findMatches?.click();
      await Promise.resolve();
    });

    const secondCitation = view.querySelector('[data-citation-id="citation-2"]');
    expect(secondCitation).toBeTruthy();
    const openRecord = secondCitation.querySelector('[aria-label="Open full record for Synthetic Article"]') as HTMLButtonElement | null;
    expect(openRecord).toBeTruthy();
    if (!openRecord || !secondCitation) return;

    await act(async () => {
      openRecord.click();
      await Promise.resolve();
    });
    const useMatch = Array.from(view.querySelectorAll('[aria-label="Full record"] button')).find((button) => button.textContent?.includes('Use this match'));
    expect(useMatch).toBeTruthy();
    await act(async () => useMatch?.click());

    const firstCitation = view.querySelector('[data-citation-id="citation-1"]');
    const addAsWritten = firstCitation && Array.from(firstCitation.querySelectorAll('button')).find((button) => button.textContent?.includes('Add as written'));
    expect(addAsWritten).toBeTruthy();
    await act(async () => addAsWritten?.click());

    const addSelected = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Add selected'));
    expect(addSelected).toBeTruthy();
    await act(async () => addSelected?.click());

    expect(context.addItemsFromExternalSource).toHaveBeenCalledWith([
      expect.objectContaining({ title: writtenCitation, notes: writtenCitation, status: 'draft' }),
      expect.objectContaining({ title: 'Synthetic Article', doi: '10.1000/synthetic', eds: expect.objectContaining({ an: 'synthetic-an' }) }),
    ]);
  });

  it('opens Paste matches on the full-record route and keeps the selected citation when returning', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const context = createContext({ reserve: { ...reserve, items: [] } });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste', context);
    const pasteBox = view.querySelector('textarea[aria-label="Paste a reading list"]') as HTMLTextAreaElement | null;
    expect(pasteBox).toBeTruthy();
    if (!pasteBox) return;

    const citation = 'Melanie Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” Caribbean Quarterly 60, 2 (June 2014): 5-28';
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(pasteBox, citation);
      pasteBox.dispatchEvent(new Event('input', { bubbles: true }));
      pasteBox.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const extract = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Extract citations'));
    await act(async () => extract?.click());
    const findMatches = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Find matches'));
    await act(async () => { findMatches?.click(); await Promise.resolve(); });
    const citationCard = view.querySelector('[data-citation-id="citation-1"]');
    const useMatch = citationCard && Array.from(citationCard.querySelectorAll('button')).find((button) => button.textContent?.includes('Use this match'));
    await act(async () => useMatch?.click());

    expect(view.querySelector('[data-testid="location"]')?.textContent).toContain('/submission/reserve-test/edit/add/record/synthetic-database/synthetic-an');
    expect(view.textContent).toContain('Full synthetic abstract for faculty review.');
    const useFullRecord = Array.from(view.querySelectorAll('[aria-label="Full record"] button')).find((button) => button.textContent?.includes('Use this match'));
    await act(async () => useFullRecord?.click());

    expect(view.querySelector('[data-citation-id="citation-1"]')?.textContent).toContain('Selected match: Synthetic Article');
    expect((view.querySelector('textarea[aria-label="Paste a reading list"]') as HTMLTextAreaElement).value).toBe(citation);
    const addSelected = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Add selected'));
    await act(async () => addSelected?.click());
    expect(context.addItemsFromExternalSource).toHaveBeenCalledWith([
      expect.objectContaining({ doi: '10.1000/synthetic', eds: expect.objectContaining({ an: 'synthetic-an' }) }),
    ]);
  });

  it('uses the same item form for inline typing and the existing item modal', async () => {
    const handleSaveItem = vi.fn();
    const context = createContext({ itemHandlers: { handleAddItem: vi.fn(), handleSaveItem } });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=type', context);
    const title = view.querySelector('#title') as HTMLInputElement | null;
    expect(title).toBeTruthy();
    if (!title) return;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(title, 'Typed synthetic reading');
      title.dispatchEvent(new Event('input', { bubbles: true }));
      title.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const materialType = view.querySelector('#materialType') as HTMLButtonElement;
    await act(async () => {
      materialType.focus();
      materialType.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    const bookOption = Array.from(document.querySelectorAll('[role="option"]')).find((option) => option.textContent === 'Book');
    await act(async () => bookOption?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const addItem = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Add item'));
    expect(addItem).toBeTruthy();
    await act(async () => addItem?.click());

    expect(handleSaveItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Typed synthetic reading', materialType: 'Book', requestType: 'link-electronic',
    }));
  });
});
