import { act, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseReserve } from '@/store/courseReservesStore';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import { retrieveDiscoveryRecord } from '@/services/discoverySearchService';
import { filterContentBySearch } from '@/utils/contentSearch';
import { useOrganizedContent } from '@/hooks/useContentOrganization';
import SubmissionEditorContext, { type SubmissionEditorContextValue } from './SubmissionEditorContext';
import ContentList from './ContentList';
import AddMaterialsPage from '@/pages/AddMaterials/AddMaterialsPage';

vi.mock('@/services/discoverySearchService', () => ({
  retrieveDiscoveryRecord: vi.fn(),
  searchDiscovery: vi.fn(),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const reserve: CourseReserve = {
  id: 'reserve-1',
  courseCode: 'BIO 101',
  courseTitle: 'Biology',
  section: '01',
  instructors: 'Faculty One',
  term: '2026FA',
  status: 'draft',
  items: [
    { id: 'loose-first', title: 'First loose book', materialType: 'book', status: 'draft' },
    { id: 'folder-first', title: 'First inside', materialType: 'book', status: 'draft', folderId: 'folder-1' },
    { id: 'folder-target', title: 'Target chapter', materialType: 'chapter', status: 'draft', folderId: 'folder-1' },
    {
      id: 'loose-target', title: 'Target reader', materialType: 'article', status: 'draft',
      eds: { dbId: 'synthetic-database', an: 'synthetic-an', plink: 'https://example.test/record' },
    },
  ],
  folders: [{ id: 'folder-1', title: 'Unit One', isOpen: true, itemIds: ['folder-first', 'folder-target'] }],
  layout: [
    { kind: 'item', id: 'loose-first' },
    { kind: 'folder', id: 'folder-1' },
    { kind: 'item', id: 'loose-target' },
  ],
  lastUpdated: 'Oct 19, 2026',
};

const editorContext: SubmissionEditorContextValue = {
  id: reserve.id,
  reserve,
  isEditingSubmission: false,
  hasPreviousOffering: false,
  isReadOnly: false,
  lockInfo: null,
  saveDraft: vi.fn(),
  ensureServerUuid: vi.fn().mockResolvedValue('server-draft-1'),
  isSaving: false,
  hasUnsavedChanges: false,
  lastSaveTime: null,
  saveError: null,
  itemHandlers: {
    handleClearAll: vi.fn(), handleEditItem: vi.fn(), handleDeleteItem: vi.fn(),
    handleMoveUp: vi.fn(), handleMoveDown: vi.fn(),
  },
  folderHandlers: {
    handleCreateFolder: vi.fn(), handleUpdateFolder: vi.fn(), handleDeleteFolder: vi.fn(),
    handleToggleFolder: vi.fn(),
  },
  courseHandlers: {},
  dragHandlers: { handleDragEnd: vi.fn() },
  submissionHandlers: {},
  markChanged: vi.fn(),
  removeItemFromFolder: vi.fn(),
  moveItemInFolder: vi.fn(),
  addItemToFolder: vi.fn(),
  moveFolderPosition: vi.fn(),
  user: null,
  addItem: vi.fn(),
  createFolder: vi.fn(),
  addedMaterials: [],
  undoAddedMaterial: vi.fn(),
};

describe('SubmissionEditor ContentList', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let originalWidth: number;

  beforeEach(() => {
    originalWidth = window.innerWidth;
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  });

  it('keeps a search box without sort or filter controls', () => {
    renderList();

    expect(container?.querySelector('input[aria-label="Search materials"]')).not.toBeNull();
    expect(container?.querySelector('select')).toBeNull();
    expect(container?.textContent).not.toContain('Filters');
    expect(container?.textContent).not.toContain('Sort by');
  });

  it('searches folder titles and keeps all items in a matching folder', () => {
    renderList();
    setSearch('Unit One');

    expect(container?.textContent).toContain('First inside');
    expect(container?.textContent).toContain('Target chapter');
    expect(container?.textContent).not.toContain('First loose book');
    expect(container?.textContent).not.toContain('Target reader');
  });

  it('disables drag and move arrows during search, then restores them after Clear search', () => {
    renderList();
    setSearch('Unit One');

    expect(container?.textContent).toContain('Clear the search to reorder.');
    expect(container?.querySelector('button[aria-label="Reorder folder"]')?.hasAttribute('disabled')).toBe(true);
    expect(container?.querySelector('button[aria-label="Reorder item"]')?.hasAttribute('disabled')).toBe(true);
    expect(container?.querySelector('button[title="Move folder up"]')?.hasAttribute('disabled')).toBe(true);
    expect(container?.querySelector('button[title="Move up"]')?.hasAttribute('disabled')).toBe(true);

    act(() => {
      Array.from(container!.querySelectorAll('button')).find((button) => button.textContent === 'Clear search')?.click();
    });

    expect(container?.textContent).not.toContain('Clear the search to reorder.');
    expect(container?.querySelector('button[aria-label="Reorder folder"]')?.hasAttribute('disabled')).toBe(false);
    expect(container?.querySelector('button[title="Move folder up"]')?.hasAttribute('disabled')).toBe(false);
  });

  it('retains full list positions on filtered loose and folder items', () => {
    renderList();
    setSearch('target');

    expect(container?.textContent).toContain('Unit One · 2');
    const positionBadges = Array.from(container!.querySelectorAll('div.rounded-full'))
      .map((badge) => badge.textContent?.trim());
    expect(positionBadges).toContain('2');
    expect(positionBadges).toContain('3');
    expect(container?.textContent).not.toContain('First inside');
    expect(container?.textContent).not.toContain('First loose book');
  });

  it('shows the full-record button only on catalog items', () => {
    renderList({ isReadOnly: true });

    expect(viewFullRecordButtonFor('Target reader')).toBeTruthy();
    for (const title of ['First loose book', 'First inside', 'Target chapter']) {
      expect(viewFullRecordButtonFor(title)).toBeNull();
    }
  });

  it('loads an EDS full record from a read-only list and closes without changing the search', async () => {
    vi.mocked(retrieveDiscoveryRecord).mockResolvedValue(fullRecord);
    renderList({ isReadOnly: true, initialSearchQuery: 'Target reader' });

    const viewButton = viewFullRecordButtonFor('Target reader');
    expect(viewButton).toBeTruthy();

    await act(async () => {
      viewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(retrieveDiscoveryRecord).toHaveBeenCalledWith('synthetic-database', 'synthetic-an');
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Full catalog record title');
    expect(dialog?.textContent).not.toContain('Add to my list');

    const closeButton = Array.from(dialog!.querySelectorAll('button'))
      .find((button) => button.querySelector('.sr-only')?.textContent === 'Close');
    expect(closeButton).toBeTruthy();
    act(() => closeButton?.click());

    expect(container?.querySelector<HTMLInputElement>('input[aria-label="Search materials"]')?.value)
      .toBe('Target reader');
    expect(container?.textContent).toContain('Target reader');
  });

  it('uses the record route on narrow screens and Back returns to the main list', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    vi.mocked(retrieveDiscoveryRecord).mockResolvedValue(fullRecord);
    renderList({ isReadOnly: true });

    const viewButton = viewFullRecordButtonFor('Target reader');
    expect(viewButton).toBeTruthy();
    await act(async () => {
      viewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(locationText()).toContain('/submission/reserve-1/edit/add/record/synthetic-database/synthetic-an');
    expect(locationText()).toContain('returnTo=list');
    expect(document.body.textContent).toContain('Full catalog record title');
    expect(document.body.textContent).not.toContain('Add materials is unavailable');
    expect(Array.from(document.body.querySelectorAll('button')).some((button) => button.textContent?.includes('Back to my list')))
      .toBe(true);

    const backButton = Array.from(document.body.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Back to my list'));
    act(() => backButton?.click());

    expect(locationText()).toContain('/submission/reserve-1/edit');
    expect(container?.textContent).toContain('Target reader');
  });

  it('returns to the main list from the mobile record error state', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    vi.mocked(retrieveDiscoveryRecord).mockRejectedValue(new Error('Catalog unavailable'));
    renderList({ isReadOnly: true });

    const viewButton = viewFullRecordButtonFor('Target reader');
    await act(async () => {
      viewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('Catalog unavailable');
    const backButtons = Array.from(document.body.querySelectorAll('button'))
      .filter((button) => button.textContent?.trim().startsWith('Back'));
    act(() => backButtons[backButtons.length - 1]?.click());

    expect(locationText()).toContain('/submission/reserve-1/edit');
    expect(locationText()).not.toContain('/add/record/');
  });

  function renderList(options: { isReadOnly?: boolean; initialSearchQuery?: string } = {}) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(
      <MemoryRouter initialEntries={['/submission/reserve-1/edit']}>
        <SubmissionEditorContext.Provider value={{ ...editorContext, isReadOnly: options.isReadOnly || false }}>
          <Routes>
            <Route path="/submission/:id/edit" element={<SearchHarness
              isReadOnly={options.isReadOnly || false}
              initialSearchQuery={options.initialSearchQuery}
            />} />
            <Route path="/submission/:id/edit/add/record/:dbId/:an" element={<><AddMaterialsPage /><LocationProbe /></>} />
          </Routes>
        </SubmissionEditorContext.Provider>
      </MemoryRouter>
    ));
  }

  function setSearch(query: string) {
    const input = container?.querySelector('input[aria-label="Search materials"]') as HTMLInputElement | null;
    if (!input) throw new Error('Search input was not rendered');
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, query);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function viewFullRecordButtonFor(title: string): HTMLButtonElement | null {
    const heading = Array.from(container!.querySelectorAll('h4'))
      .find((itemHeading) => itemHeading.textContent?.trim() === title);
    const card = heading?.closest('.group');
    return Array.from(card?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.trim() === 'View full record') ?? null;
  }
});

const fullRecord: DiscoverySearchResult = {
  id: 'synthetic-an',
  dbId: 'synthetic-database',
  title: 'Full catalog record title',
  authors: ['Synthetic Author'],
  publicationType: 'Book',
  database: 'Synthetic Catalog',
  pLink: 'https://example.test/full-record',
  hasFullText: false,
};

function SearchHarness({ isReadOnly, initialSearchQuery = '' }: { isReadOnly: boolean; initialSearchQuery?: string }) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const organizedContent = useOrganizedContent(reserve);
  const filteredContent = useMemo(
    () => filterContentBySearch(organizedContent, searchQuery),
    [organizedContent, searchQuery]
  );

  return (
    <>
      {isReadOnly ? (
        <fieldset disabled>
          <ContentList
            organizedContent={organizedContent}
            filteredContent={filteredContent}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isSearching={searchQuery.trim().length > 0}
          />
        </fieldset>
      ) : (
        <ContentList
          organizedContent={organizedContent}
          filteredContent={filteredContent}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSearching={searchQuery.trim().length > 0}
        />
      )}
      <LocationProbe />
    </>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="current-location">{location.pathname}{location.search}</output>;
}

function locationText() {
  return document.querySelector('[data-testid="current-location"]')?.textContent || '';
}
