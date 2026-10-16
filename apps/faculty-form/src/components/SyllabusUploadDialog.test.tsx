import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { CourseReserve } from '@/store/courseReservesStore';
import SubmissionEditorContext, {
  type SubmissionEditorContextValue,
} from '@/pages/SubmissionEditor/SubmissionEditorContext';
import ActionBar from '@/pages/SubmissionEditor/ActionBar';
import { SyllabusUploadDialog } from './SyllabusUploadDialog';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SyllabusUploadDialog', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
  });

  it('opens the add-materials search tab from the editor action bar', () => {
    const reserve: CourseReserve = {
      id: 'reserve-1',
      courseCode: 'BIO 220',
      courseTitle: 'Ecology',
      section: '01',
      instructors: 'Faculty One',
      term: '2026FA',
      status: 'draft',
      items: [],
      folders: [],
      lastUpdated: '2026-06-17T12:00:00.000Z',
    };

    const Harness = () => {
      const contextValue: SubmissionEditorContextValue = {
        id: reserve.id,
        reserve,
        isEditingSubmission: false,
        hasPreviousOffering: false,
        isReadOnly: false,
        lockInfo: null,
        saveDraft: () => undefined,
        isSaving: false,
        hasUnsavedChanges: false,
        lastSaveTime: null,
        saveError: null,
        duplicateSourceCourse: null,
        loadingDuplicateSource: false,
        handleOpenDuplicateDialog: () => undefined,
        handleOpenCloneDialog: () => undefined,
        setDiscoverySearchOpen: () => undefined,
        setSyllabusUploadOpen: () => undefined,
        itemHandlers: {},
        folderHandlers: {},
        courseHandlers: {},
        dragHandlers: {},
        submissionHandlers: {},
        markChanged: () => undefined,
        removeItemFromFolder: () => undefined,
        moveItemInFolder: () => undefined,
        addItemToFolder: () => undefined,
        moveFolderPosition: () => undefined,
        user: null,
        updateReserve: () => undefined,
        addItem: () => true,
        addItemsFromExternalSource: () => undefined,
        addedMaterials: [],
        undoAddedMaterial: () => undefined,
      };

      return (
        <MemoryRouter>
          <SubmissionEditorContext.Provider value={contextValue}>
            <ActionBar />
            <LocationProbe />
          </SubmissionEditorContext.Provider>
        </MemoryRouter>
      );
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root!.render(<Harness />));

    const addMaterialsButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Add materials')
    );
    expect(addMaterialsButton).toBeTruthy();

    act(() => addMaterialsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(document.body.textContent).toContain('/submission/reserve-1/edit/add?tab=search');
  });

  it('keeps paste, extraction, and add-all reachable after upload controls are removed elsewhere', () => {
    const onItemsExtracted = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <SyllabusUploadDialog
          open={true}
          onOpenChange={() => undefined}
          onItemsExtracted={onItemsExtracted}
        />
      );
    });

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    const citation = 'Becker, Gary (1968) "Crime and Punishment: An Economics Analysis," Journal of Political Economy, Vol. 76, pp. 169-217.';

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      valueSetter?.call(textarea, citation);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const extractButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.startsWith('Extract Citations')
    );
    expect(extractButton).toBeTruthy();

    act(() => extractButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const addButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.startsWith('Add All to Course')
    );
    expect(addButton).toBeTruthy();

    act(() => addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(onItemsExtracted).toHaveBeenCalledWith([
      expect.objectContaining({
        title: citation,
        materialType: 'article',
        status: 'draft',
        notes: citation,
      }),
    ]);
  });
});

function LocationProbe() {
  const location = useLocation();
  return <output>{location.pathname}{location.search}</output>;
}
