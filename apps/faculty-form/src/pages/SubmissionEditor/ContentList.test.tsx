import { act, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CourseReserve } from '@/store/courseReservesStore';
import { filterContentBySearch } from '@/utils/contentSearch';
import { useOrganizedContent } from '@/hooks/useContentOrganization';
import SubmissionEditorContext, { type SubmissionEditorContextValue } from './SubmissionEditorContext';
import ContentList from './ContentList';

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
    { id: 'loose-target', title: 'Target reader', materialType: 'article', status: 'draft' },
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

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
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

  function renderList() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(
      <MemoryRouter>
        <SubmissionEditorContext.Provider value={editorContext}>
          <SearchHarness />
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
});

function SearchHarness() {
  const [searchQuery, setSearchQuery] = useState('');
  const organizedContent = useOrganizedContent(reserve);
  const filteredContent = useMemo(
    () => filterContentBySearch(organizedContent, searchQuery),
    [organizedContent, searchQuery]
  );

  return (
    <ContentList
      organizedContent={organizedContent}
      filteredContent={filteredContent}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      isSearching={searchQuery.trim().length > 0}
    />
  );
}
