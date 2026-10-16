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
const fullRecord = {
  ...searchResult,
  edition: 'Second edition', publisher: 'Synthetic Publisher', publicationDate: { year: '2025' },
  subjects: ['Synthetic subject'], abstract: 'Full synthetic abstract for faculty review.',
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
    lastSaveTime: null, saveError: null, duplicateSourceCourse: null, loadingDuplicateSource: false,
    handleOpenDuplicateDialog: vi.fn(), handleOpenCloneDialog: vi.fn(), setDiscoverySearchOpen: vi.fn(),
    setSyllabusUploadOpen: vi.fn(), itemHandlers: { handleAddItem: vi.fn() }, folderHandlers: {}, courseHandlers: {},
    dragHandlers: {}, submissionHandlers: {}, markChanged: vi.fn(), removeItemFromFolder: vi.fn(),
    moveItemInFolder: vi.fn(), addItemToFolder: vi.fn(), moveFolderPosition: vi.fn(), user: null,
    updateReserve: vi.fn(), addItem: vi.fn(() => true), addItemsFromExternalSource: vi.fn(),
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
    expect(view.textContent).toContain('Full synthetic abstract for faculty review.');
    expect(view.textContent).toContain('Synthetic subject');

    const add = Array.from(view.querySelectorAll('button')).find((button) => button.textContent?.includes('Add to my list'));
    await act(async () => add?.click());
    expect(context.addItem).toHaveBeenCalledWith('reserve-test', expect.objectContaining({
      doi: '10.1000/synthetic', issn: '1234-5678', eds: expect.objectContaining({ an: 'synthetic-an' }),
    }));
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
  });
});
