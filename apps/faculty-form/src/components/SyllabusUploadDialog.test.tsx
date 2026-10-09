import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
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

  it('opens through the real Paste Citations entry point before paste, extraction, and add', () => {
    const onItemsExtracted = vi.fn();
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
      const [open, setOpen] = useState(false);
      const contextValue: SubmissionEditorContextValue = {
        id: reserve.id,
        reserve,
        isEditingSubmission: false,
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
        setSyllabusUploadOpen: setOpen,
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
      };

      return (
        <SubmissionEditorContext.Provider value={contextValue}>
          <ActionBar />
          <SyllabusUploadDialog
            open={open}
            onOpenChange={setOpen}
            onItemsExtracted={onItemsExtracted}
          />
        </SubmissionEditorContext.Provider>
      );
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root!.render(<Harness />));

    const pasteButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Paste Citations')
    );
    expect(pasteButton).toBeTruthy();

    act(() => pasteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(document.body.textContent).toContain('Paste Syllabus Citations');

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
