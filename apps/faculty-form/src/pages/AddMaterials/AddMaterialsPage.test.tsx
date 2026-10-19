import { act, useRef, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseItem, CourseReserve } from '@/store/courseReservesStore';
import { createAddMaterialHandler } from '@/handlers/addMaterialHandler';
import { findDuplicateCourseItem } from '@/utils/courseItemDuplicates';
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
const validCitation = 'Melanie Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” Caribbean Quarterly 60, 2 (June 2014): 5-28';
const reserve: CourseReserve = {
  id: 'reserve-test', courseCode: 'BIO 220', courseTitle: 'Ecology', section: '01', instructors: 'Test Faculty',
  term: 'Fall 2026', status: 'draft', items: [{ id: 'existing', title: 'Existing', materialType: 'article', status: 'draft', doi: '10.1000/synthetic' }],
  folders: [], layout: [{ kind: 'item', id: 'existing' }], lastUpdated: '2026-10-01',
};

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

function LiveEditorProvider({
  context,
  folderId,
  children,
}: {
  context: SubmissionEditorContextValue;
  folderId?: string;
  children: ReactNode;
}) {
  const [reserveState, setReserveState] = useState(context.reserve);
  const [addedMaterials, setAddedMaterials] = useState(context.addedMaterials);
  const lastAdded = useRef<CourseItem | undefined>(undefined);
  const itemSequence = useRef(0);
  const addItem = createAddMaterialHandler({
    reserveId: context.id,
    defaultFolderId: folderId,
    markChanged: context.markChanged,
    getLastAddedItem: () => lastAdded.current,
    onAdded: (item) => setAddedMaterials((current) => [...current, { id: item.id, title: item.title }]),
    addItem: (reserveId, item) => {
      if (findDuplicateCourseItem(reserveState.items, item)) return false;
      const accepted = context.addItem(reserveId, item);
      if (!accepted) return false;
      const addedItem = { ...item, id: `added-${++itemSequence.current}` } as CourseItem;
      lastAdded.current = addedItem;
      setReserveState((current) => ({ ...current, items: [...current.items, addedItem] }));
      return true;
    },
  });
  const undoAddedMaterial = (itemId: string) => {
    context.undoAddedMaterial(itemId);
    setReserveState((current) => ({ ...current, items: current.items.filter((item) => item.id !== itemId) }));
    setAddedMaterials((current) => current.filter((item) => item.id !== itemId));
  };

  return (
    <SubmissionEditorContext.Provider value={{ ...context, reserve: reserveState, addItem, undoAddedMaterial, addedMaterials }}>
      {children}
    </SubmissionEditorContext.Provider>
  );
}

function createContext(overrides: Partial<SubmissionEditorContextValue> = {}) {
  return {
    id: reserve.id, reserve, isEditingSubmission: false, hasPreviousOffering: true,
    isReadOnly: false, lockInfo: null, saveDraft: vi.fn(), isSaving: false, hasUnsavedChanges: false,
    lastSaveTime: null, saveError: null,
    itemHandlers: { handleAddItem: vi.fn() }, folderHandlers: {}, courseHandlers: {},
    dragHandlers: {}, submissionHandlers: {}, markChanged: vi.fn(), removeItemFromFolder: vi.fn(),
    moveItemInFolder: vi.fn(), addItemToFolder: vi.fn(), moveFolderPosition: vi.fn(), user: null,
    addItem: vi.fn(() => true), createFolder: vi.fn(() => 'target-folder'),
    addedMaterials: [], undoAddedMaterial: vi.fn(),
    ...overrides,
  } as unknown as SubmissionEditorContextValue;
}

async function enterCitation(view: HTMLElement, text: string) {
  const pasteBox = view.querySelector('textarea[aria-label="Paste a reading list"]') as HTMLTextAreaElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(pasteBox, text);
    pasteBox.dispatchEvent(new Event('input', { bubbles: true }));
    pasteBox.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const extract = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Extract citations'));
  await act(async () => extract?.click());
}

async function findPasteMatches(view: HTMLElement) {
  const findMatches = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Find matches'));
  await act(async () => { findMatches?.click(); await Promise.resolve(); });
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
    const requestedFolderId = new URL(entry, window.location.origin).searchParams.get('folder') || undefined;
    const defaultFolderId = context.reserve.folders.some((folder) => folder.id === requestedFolderId) ? requestedFolderId : undefined;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <LiveEditorProvider context={context} folderId={defaultFolderId}>
          <MemoryRouter initialEntries={[entry]}>
            <Routes>
              <Route path="/submission/:id/edit/add" element={<><AddMaterialsPage /><LocationProbe /></>} />
              <Route path="/submission/:id/edit/add/record/:dbId/:an" element={<><AddMaterialsPage /><LocationProbe /></>} />
            </Routes>
          </MemoryRouter>
        </LiveEditorProvider>
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

  it('hides inactive Paste and Type tabs while preserving their entered state', async () => {
    const view = await renderAt('/submission/reserve-test/edit/add?tab=search');
    const panelFor = (label: string) => {
      const trigger = Array.from(view.querySelectorAll('[role="tab"]')).find((tab) => tab.textContent?.includes(label));
      const panelId = trigger?.getAttribute('aria-controls');
      return panelId ? view.querySelector(`[id="${panelId}"]`) as HTMLElement | null : null;
    };
    const clickTab = async (label: string) => {
      const trigger = Array.from(view.querySelectorAll('[role="tab"]')).find((tab) => tab.textContent?.includes(label)) as HTMLButtonElement;
      await act(async () => {
        trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
        await Promise.resolve();
      });
    };
    const pastePanel = () => panelFor('Paste a list');
    const typePanel = () => panelFor('Type it in');
    expect(pastePanel()).not.toBeNull();
    expect(typePanel()).not.toBeNull();
    expect(pastePanel()?.hidden).toBe(true);
    expect(pastePanel()?.getAttribute('aria-hidden')).toBe('true');
    expect(typePanel()?.hidden).toBe(true);
    expect(typePanel()?.getAttribute('aria-hidden')).toBe('true');

    await clickTab('Paste a list');
    expect(view.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('Paste a list');
    expect(pastePanel()?.hidden).toBe(false);
    expect(typePanel()?.hidden).toBe(true);
    const pasteBox = pastePanel()?.querySelector('textarea[aria-label="Paste a reading list"]') as HTMLTextAreaElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(pasteBox, 'Synthetic citation retained while switching tabs');
      pasteBox.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await clickTab('Type it in');
    expect(pastePanel()?.hidden).toBe(true);
    expect(typePanel()?.hidden).toBe(false);
    const title = typePanel()?.querySelector('#title') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(title, 'Synthetic item retained while switching tabs');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clickTab('Search the library');
    expect(pastePanel()?.hidden).toBe(true);
    expect(typePanel()?.hidden).toBe(true);
    await clickTab('Paste a list');
    expect((pastePanel()?.querySelector('textarea[aria-label="Paste a reading list"]') as HTMLTextAreaElement).value)
      .toBe('Synthetic citation retained while switching tabs');
    await clickTab('Type it in');
    expect((typePanel()?.querySelector('#title') as HTMLInputElement).value)
      .toBe('Synthetic item retained while switching tabs');
  });

  it('shows a retrieved full record after the explicit button is clicked and adds structured fields', async () => {
    const context = createContext({ reserve: { ...reserve, items: [] } });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=search&q=climate%20change', context);
    expect(view.querySelector('[aria-label="Full record"]')).toBeNull();
    const openRecord = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'View full record') as HTMLButtonElement;
    expect(openRecord).toBeTruthy();

    await act(async () => {
      openRecord.click();
      await Promise.resolve();
    });
    expect(retrieveDiscoveryRecord).toHaveBeenCalledWith('synthetic-database', 'synthetic-an');
    expect(view.querySelector('[aria-label="Close full record"]')).not.toBeNull();
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
    expect(results).not.toBeNull();
    expect(view.querySelector('[aria-label="Full record"]')).toBeNull();
    expect(results.className).not.toContain('md:overflow-y-auto');
    expect(results.parentElement?.className).not.toContain('md:grid-cols-');
    expect(view.querySelector('[aria-label="Search the library"]')?.getAttribute('style')).toBeNull();

    const openRecord = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'View full record') as HTMLButtonElement;
    await act(async () => { openRecord.click(); await Promise.resolve(); });
    const record = view.querySelector('[aria-label="Full record"]') as HTMLElement;

    expect(record).not.toBeNull();
    expect(results.tabIndex).toBe(0);
    expect(record.tabIndex).toBe(0);
    expect(results.parentElement?.className).toContain('md:grid-cols-');
    expect(results.className).toContain('md:overflow-y-auto');
    expect(record.className).toContain('md:overflow-y-auto');
    expect(results.className).toContain('md:min-h-0');
    expect(record.className).toContain('md:min-h-0');
    expect(results.className).not.toContain('overscroll-contain');
    expect(record.className).not.toContain('overscroll-contain');
    expect(view.querySelector('[aria-label="Search the library"]')?.className).toContain('md:flex');
  });

  it('keeps an empty search in normal page flow without a record rail', async () => {
    vi.mocked(searchDiscovery).mockResolvedValue({
      results: [], totalHits: 0, searchTime: 5, queryString: 'no matches',
      appliedLimiters: [], facets: { sourceTypes: [], publicationYears: [] },
    });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=search&q=no%20matches');
    const section = view.querySelector('[aria-label="Search the library"]') as HTMLElement;
    const results = view.querySelector('[aria-label="Search results"]') as HTMLElement;

    expect(section.style.height).toBe('');
    expect(section.className).not.toContain('md:flex');
    expect(results.className).not.toContain('md:overflow-y-auto');
    expect(results.parentElement?.className).not.toContain('md:grid-cols-');
    expect(view.querySelector('[aria-label="Full record"]')).toBeNull();
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
    results.scrollTop = 240;

    await act(async () => {
      (Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'View full record') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    const recordPane = view.querySelector('[aria-label="Full record"]') as HTMLElement;
    expect(results.scrollTop).toBe(240);
    expect(recordPane.scrollTop).toBe(0);
    expect(view.textContent).toContain('Selected');

    recordPane.scrollTop = 280;
    await act(async () => {
      (view.querySelector('[aria-label="View full record for Second Synthetic Article"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(results.scrollTop).toBe(240);
    expect(recordPane.scrollTop).toBe(0);
    expect(retrieveDiscoveryRecord).toHaveBeenLastCalledWith('second-database', 'second-an');

    await act(async () => view.querySelector('[aria-label="Close full record"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(view.querySelector('[aria-label="Full record"]')).toBeNull();
    expect(results.scrollTop).toBe(240);
    expect(results.parentElement?.className).not.toContain('md:grid-cols-');
    expect(view.querySelector('[aria-label="Search the library"]')?.className).not.toContain('md:flex');
  });

  it('closes the desktop record panel with Escape', async () => {
    const view = await renderAt('/submission/reserve-test/edit/add?tab=search&q=climate%20change');
    const openRecord = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'View full record') as HTMLButtonElement;
    await act(async () => { openRecord.click(); await Promise.resolve(); });
    expect(view.querySelector('[aria-label="Full record"]')).not.toBeNull();

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(view.querySelector('[aria-label="Full record"]')).toBeNull();
    expect(view.querySelector('[aria-label="Search results"]')?.parentElement?.className).not.toContain('md:grid-cols-');
  });

  it('keeps the close button available while the full record is loading', async () => {
    let resolveRecord: (record: typeof fullRecord) => void = () => undefined;
    vi.mocked(retrieveDiscoveryRecord).mockImplementation(() => new Promise((resolve) => { resolveRecord = resolve; }));
    const view = await renderAt('/submission/reserve-test/edit/add?tab=search&q=climate%20change');
    const openRecord = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'View full record') as HTMLButtonElement;
    await act(async () => { openRecord.click(); await Promise.resolve(); });

    expect(view.querySelector('[role="status"]')?.textContent).toContain('Loading full record');
    const close = view.querySelector('[aria-label="Close full record"]') as HTMLButtonElement | null;
    expect(close).not.toBeNull();
    await act(async () => close?.click());
    expect(view.querySelector('[aria-label="Full record"]')).toBeNull();
    await act(async () => { resolveRecord(fullRecord); await Promise.resolve(); });
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
    expect(instances[0].options.root).toBeNull();
    const openRecord = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'View full record') as HTMLButtonElement;
    await act(async () => { openRecord.click(); await Promise.resolve(); });
    expect(instances[instances.length - 1].options.root).toBe(results);
    await act(async () => {
      instances[instances.length - 1].callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      await Promise.resolve();
    });
    expect(searchDiscovery).toHaveBeenCalledWith('climate change', 2, 'climate change', expect.any(Object), expect.any(Array));
  });

  it('opens the record on its own phone route so Back returns to the URL state', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=search&q=climate%20change');
    const openRecord = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'View full record') as HTMLButtonElement;

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

  it('shows skipped blocks and lets faculty add one to the editable citation list', async () => {
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste');
    const paste = `Week 3

Read before class

Melanie Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” Caribbean Quarterly 60, 2 (June 2014): 5-28`;
    await enterCitation(view, paste);

    expect(view.textContent).toContain("2 lines weren't recognised as citations.");
    const review = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Review it');
    expect(review).toBeTruthy();
    await act(async () => review?.click());

    const skippedLine = Array.from(view.querySelectorAll('[data-skipped-citation]'))
      .find((line) => line.textContent?.includes('Read before class')) as HTMLElement | undefined;
    expect(skippedLine).toBeTruthy();
    const addToList = skippedLine && Array.from(skippedLine.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Add to the list');
    await act(async () => addToList?.click());

    expect(Array.from(view.querySelectorAll('textarea[aria-label^="Edit citation"]'))
      .some((textarea) => (textarea as HTMLTextAreaElement).value === 'Read before class')).toBe(true);
    expect(view.querySelector('[data-skipped-citation]')?.textContent).not.toContain('Read before class');
  });

  it('adds a citation as written in one click and applies its target folder', async () => {
    const context = createContext({ reserve: { ...reserve, items: [], folders: [{ id: 'folder-42', title: 'Unit One', itemIds: [] }] } });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste&folder=folder-42', context);
    await enterCitation(view, validCitation);

    const card = view.querySelector('[data-citation-id="citation-1"]') as HTMLElement;
    const addAsWritten = Array.from(card.querySelectorAll('button')).find((button) => button.textContent?.includes('Add as written')) as HTMLButtonElement;
    expect(addAsWritten).toBeTruthy();
    await act(async () => addAsWritten.click());

    expect(context.addItem).toHaveBeenCalledTimes(1);
    expect(context.addItem).toHaveBeenCalledWith('reserve-test', expect.objectContaining({
      title: validCitation, notes: validCitation, folderId: 'folder-42', status: 'draft',
    }));
    expect(card.textContent).toContain('Added as written ✓');
    expect(Array.from(card.querySelectorAll('button')).some((button) => button.textContent?.includes('Add as written'))).toBe(false);
    expect(Array.from(view.querySelectorAll('button')).some((button) => button.textContent?.includes('Add selected'))).toBe(false);
  });

  it('keeps added items in the list when citations are edited and re-extracted', async () => {
    const context = createContext({ reserve: { ...reserve, items: [] } });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste', context);
    await enterCitation(view, validCitation);
    const addAsWritten = Array.from(view.querySelectorAll('[data-citation-id="citation-1"] button'))
      .find((button) => button.textContent?.includes('Add as written')) as HTMLButtonElement;
    await act(async () => addAsWritten.click());

    const edit = view.querySelector('textarea[aria-label="Edit citation 1"]') as HTMLTextAreaElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(edit, 'Edited citation text after adding the original.');
      edit.dispatchEvent(new Event('input', { bubbles: true }));
      edit.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const reextract = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Re-extract citations'));
    await act(async () => reextract?.click());
    const trayToggle = Array.from(view.querySelectorAll('aside[aria-label="Added materials"] button'))
      .find((button) => button.textContent?.includes('Added (1)')) as HTMLButtonElement;
    await act(async () => trayToggle.click());

    expect(view.querySelector('[aria-label="Materials added this visit"]')?.textContent).toContain(validCitation);
    expect(context.undoAddedMaterial).not.toHaveBeenCalled();
  });

  it('adds a match directly from its card without opening the record panel', async () => {
    const context = createContext({ reserve: { ...reserve, items: [] } });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste', context);
    await enterCitation(view, validCitation);
    await findPasteMatches(view);
    const card = view.querySelector('[data-citation-id="citation-1"]') as HTMLElement;
    const useMatch = Array.from(card.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Use this match') as HTMLButtonElement;

    expect(useMatch).toBeTruthy();
    await act(async () => useMatch.click());

    expect(context.addItem).toHaveBeenCalledTimes(1);
    expect(context.addItem).toHaveBeenCalledWith('reserve-test', expect.objectContaining({
      title: 'Synthetic Article', doi: '10.1000/synthetic', eds: expect.objectContaining({ an: 'synthetic-an' }),
    }));
    expect(view.querySelector('[aria-label="Full record"]')).toBeNull();
    expect(card.textContent).toContain('Added to your list ✓');
    expect(card.textContent).toContain('Synthetic Article');
    expect(Array.from(card.querySelectorAll('button')).some((button) => button.textContent?.includes('Use this match'))).toBe(false);
  });

  it('shows the closest title first and collapses the remaining citation matches', async () => {
    const closeMatch = {
      ...searchResult,
      id: 'close-match',
      title: 'The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean',
    };
    const otherMatches = [
      { ...searchResult, id: 'first-match', title: 'Synthetic Article' },
      { ...searchResult, id: 'third-match', title: 'Race, Narrative, and Caribbean History' },
    ];
    vi.mocked(searchDiscovery).mockResolvedValue({
      results: [otherMatches[0], closeMatch, otherMatches[1]], totalHits: 3, searchTime: 5,
      queryString: 'citation search', appliedLimiters: [], facets: { sourceTypes: [], publicationYears: [] },
    });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste', createContext({ reserve: { ...reserve, items: [] } }));
    await enterCitation(view, validCitation);
    await findPasteMatches(view);
    const citationCard = view.querySelector('[data-citation-id="citation-1"]') as HTMLElement;
    const toggle = Array.from(citationCard.querySelectorAll('button')).find((button) => button.textContent?.includes('Show')) as HTMLButtonElement;
    const othersId = toggle?.getAttribute('aria-controls');
    const others = othersId ? citationCard.querySelector(`#${othersId}`) as HTMLElement | null : null;

    expect(citationCard.textContent).toContain('Best match');
    expect(citationCard.textContent).toContain(closeMatch.title);
    expect(toggle?.textContent).toBe('Show 2 more matches');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(othersId).toBeTruthy();
    expect(others?.hidden).toBe(true);

    await act(async () => toggle.click());

    expect(toggle.textContent).toBe('Hide other matches');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(others?.hidden).toBe(false);
    expect(Array.from(others?.querySelectorAll('article') || []).map((card) => card.textContent)).toEqual([
      expect.stringContaining('Synthetic Article'),
      expect.stringContaining('Race, Narrative, and Caribbean History'),
    ]);

    await act(async () => toggle.click());

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(others?.hidden).toBe(true);
  });

  it('keeps each citation match toggle collapsed independently', async () => {
    vi.mocked(searchDiscovery).mockResolvedValue({
      results: [searchResult, secondSearchResult], totalHits: 2, searchTime: 5,
      queryString: 'citation search', appliedLimiters: [], facets: { sourceTypes: [], publicationYears: [] },
    });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste', createContext({ reserve: { ...reserve, items: [] } }));
    await enterCitation(view, `${validCitation}\n\n${validCitation.replace('The Race Leapt', 'A Different Study')}`);
    await findPasteMatches(view);
    const firstCard = view.querySelector('[data-citation-id="citation-1"]') as HTMLElement;
    const secondCard = view.querySelector('[data-citation-id="citation-2"]') as HTMLElement;
    const firstToggle = Array.from(firstCard.querySelectorAll('button')).find((button) => button.textContent?.includes('Show')) as HTMLButtonElement;
    const secondToggle = Array.from(secondCard.querySelectorAll('button')).find((button) => button.textContent?.includes('Show')) as HTMLButtonElement;
    const secondRegion = secondCard.querySelector(`#${secondToggle.getAttribute('aria-controls')}`) as HTMLElement;

    expect(firstToggle.getAttribute('aria-expanded')).toBe('false');
    expect(secondToggle.getAttribute('aria-expanded')).toBe('false');

    await act(async () => firstToggle.click());

    expect(firstToggle.getAttribute('aria-expanded')).toBe('true');
    expect(secondToggle.getAttribute('aria-expanded')).toBe('false');
    expect(secondRegion.hidden).toBe(true);
  });

  it('adds an expanded citation match and replaces its choices with the added state', async () => {
    const secondMatch = { ...secondSearchResult, title: 'Second Citation Match' };
    vi.mocked(searchDiscovery).mockResolvedValue({
      results: [searchResult, secondMatch], totalHits: 2, searchTime: 5,
      queryString: 'citation search', appliedLimiters: [], facets: { sourceTypes: [], publicationYears: [] },
    });
    const context = createContext({ reserve: { ...reserve, items: [] } });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste', context);
    await enterCitation(view, validCitation);
    await findPasteMatches(view);
    const citationCard = view.querySelector('[data-citation-id="citation-1"]') as HTMLElement;
    const toggle = Array.from(citationCard.querySelectorAll('button')).find((button) => button.textContent?.includes('more matches')) as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    if (!toggle) return;
    await act(async () => toggle.click());
    const secondCard = Array.from(citationCard.querySelectorAll('article')).find((card) => card.textContent?.includes(secondMatch.title)) as HTMLElement;

    expect(secondCard.textContent).toContain('View full record');

    const useMatch = Array.from(secondCard.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Use this match') as HTMLButtonElement;
    await act(async () => useMatch.click());

    expect(context.addItem).toHaveBeenCalledWith('reserve-test', expect.objectContaining({ title: secondMatch.title }));
    expect(citationCard.textContent).toContain('Added to your list ✓');
    expect(citationCard.textContent).not.toContain('Best match');
    expect(citationCard.textContent).not.toContain('Show 1 more matches');
    expect(citationCard.textContent).not.toContain('Hide other matches');
  });

  it('adds from the full-record panel and closes it', async () => {
    const context = createContext({ reserve: { ...reserve, items: [] } });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste', context);
    await enterCitation(view, validCitation);
    await findPasteMatches(view);
    const card = view.querySelector('[data-citation-id="citation-1"]') as HTMLElement;
    const openRecord = Array.from(card.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'View full record') as HTMLButtonElement;
    await act(async () => { openRecord.click(); await Promise.resolve(); });
    const useMatch = Array.from(view.querySelectorAll('[aria-label="Full record"] button')).find((button) => button.textContent?.includes('Use this match')) as HTMLButtonElement;

    expect(useMatch).toBeTruthy();
    await act(async () => useMatch.click());

    expect(context.addItem).toHaveBeenCalledTimes(1);
    expect(view.querySelector('[aria-label="Full record"]')).toBeNull();
    expect(card.textContent).toContain('Added to your list ✓');
  });

  it('returns citation choices when its item is undone from the citation state', async () => {
    const context = createContext({ reserve: { ...reserve, items: [] } });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste', context);
    await enterCitation(view, validCitation);
    await findPasteMatches(view);
    const card = view.querySelector('[data-citation-id="citation-1"]') as HTMLElement;
    const useMatch = Array.from(card.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Use this match') as HTMLButtonElement;
    await act(async () => useMatch.click());
    const undo = Array.from(card.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Undo') as HTMLButtonElement;

    expect(undo).toBeTruthy();
    await act(async () => undo.click());

    expect(context.undoAddedMaterial).toHaveBeenCalledWith('added-1');
    expect(card.textContent).not.toContain('Added to your list ✓');
    expect(Array.from(card.querySelectorAll('button')).some((button) => button.textContent?.trim() === 'Use this match')).toBe(true);
  });

  it('returns citation choices when the added item is undone from the tray', async () => {
    const context = createContext({ reserve: { ...reserve, items: [] } });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste', context);
    await enterCitation(view, validCitation);
    await findPasteMatches(view);
    const card = view.querySelector('[data-citation-id="citation-1"]') as HTMLElement;
    const useMatch = Array.from(card.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Use this match') as HTMLButtonElement;
    await act(async () => useMatch.click());
    const trayToggle = Array.from(view.querySelectorAll('aside[aria-label="Added materials"] button'))
      .find((button) => button.textContent?.includes('Added (1)')) as HTMLButtonElement;
    await act(async () => trayToggle.click());
    const trayUndo = Array.from(view.querySelectorAll('[aria-label="Materials added this visit"] button'))
      .find((button) => button.textContent?.trim() === 'Undo') as HTMLButtonElement;

    await act(async () => trayUndo.click());

    expect(context.undoAddedMaterial).toHaveBeenCalledWith('added-1');
    expect(card.textContent).not.toContain('Added to your list ✓');
    expect(Array.from(card.querySelectorAll('button')).some((button) => button.textContent?.trim() === 'Use this match')).toBe(true);
  });

  it('keeps a match already in the list disabled', async () => {
    const context = createContext();
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste', context);
    await enterCitation(view, validCitation);
    await findPasteMatches(view);
    const card = view.querySelector('[data-citation-id="citation-1"]') as HTMLElement;
    const useMatch = Array.from(card.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Use this match') as HTMLButtonElement;

    expect(card.textContent).toContain('In your list ✓');
    expect(useMatch.disabled).toBe(true);
    expect(context.addItem).not.toHaveBeenCalled();
  });

  it('keeps the added state and citation workspace after using a match on the phone record route', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const context = createContext({ reserve: { ...reserve, items: [] } });
    const view = await renderAt('/submission/reserve-test/edit/add?tab=paste', context);
    const citation = validCitation;
    await enterCitation(view, citation);
    await findPasteMatches(view);
    const citationCard = view.querySelector('[data-citation-id="citation-1"]');
    const openRecord = citationCard && Array.from(citationCard.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'View full record');
    await act(async () => openRecord?.click());

    expect(view.querySelector('[data-testid="location"]')?.textContent).toContain('/submission/reserve-test/edit/add/record/synthetic-database/synthetic-an');
    expect(view.textContent).toContain('Full synthetic abstract for faculty review.');
    const useFullRecord = Array.from(view.querySelectorAll('[aria-label="Full record"] button')).find((button) => button.textContent?.includes('Use this match'));
    await act(async () => useFullRecord?.click());

    expect(context.addItem).toHaveBeenCalledTimes(1);
    expect(view.querySelector('[data-citation-id="citation-1"]')?.textContent).toContain('Added to your list ✓');
    expect((view.querySelector('textarea[aria-label="Paste a reading list"]') as HTMLTextAreaElement).value).toBe(citation);
    expect(view.querySelector('[aria-label="Full record"]')).toBeNull();
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
