import React, { useEffect, useState } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseItem, CourseReserve } from '@/store/courseReservesStore';
import type { PasteWorkspace } from './pasteCitationTypes';
import { createAddMaterialHandler } from '@/handlers/addMaterialHandler';
import SubmissionEditorContext, { type SubmissionEditorContextValue } from '@/pages/SubmissionEditor/SubmissionEditorContext';
import { usePasteCitationActions } from './usePasteCitationActions';

const result = {
  id: 'synthetic-an', dbId: 'synthetic-db', title: 'Synthetic journal article', authors: ['Test Author'],
  publicationType: 'Academic Journal', database: 'Synthetic database', pLink: 'https://example.edu/record', hasFullText: false,
};
const citation = { id: 'citation-1', text: 'Test Author (2021). Synthetic title. Synthetic Journal.', heading: 'Week 1' };
const initialWorkspace: PasteWorkspace = { citations: [citation], skipped: [], groups: [], choices: {} };
const baseReserve: CourseReserve = {
  id: 'reserve-1', courseCode: 'BIO 101', courseTitle: 'Synthetic Biology', section: '01', instructors: 'Test Faculty',
  term: '2027SP', status: 'draft', items: [], folders: [], layout: [], lastUpdated: '2026-10-26',
};

function Harness({
  onReady,
  keepUnheadedAtRoot = false,
}: {
  onReady: (actions: ReturnType<typeof usePasteCitationActions>, workspace: PasteWorkspace) => void;
  keepUnheadedAtRoot?: boolean;
}) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const actions = usePasteCitationActions(workspace, setWorkspace, keepUnheadedAtRoot);
  useEffect(() => onReady(actions, workspace), [actions, onReady, workspace]);
  return null;
}

function editorContext(
  reserve: CourseReserve,
  addItem: ReturnType<typeof vi.fn>,
  createFolder: SubmissionEditorContextValue['createFolder'],
  defaultFolderId?: string,
) {
  const addMaterial = createAddMaterialHandler({
    reserveId: reserve.id, addItem, markChanged: vi.fn(), defaultFolderId,
  });
  return {
    id: reserve.id, reserve, addItem: addMaterial, createFolder, addedMaterials: [], undoAddedMaterial: vi.fn(),
  } as unknown as SubmissionEditorContextValue;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('usePasteCitationActions folder assignment', () => {
  let container: HTMLDivElement;
  let root: Root;
  let actions: ReturnType<typeof usePasteCitationActions> | null;
  let workspace: PasteWorkspace;
  let addItem: ReturnType<typeof vi.fn>;
  let createFolder: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    actions = null;
    workspace = initialWorkspace;
    addItem = vi.fn((_reserveId: string, item: Partial<CourseItem>) => ({ ...item, id: 'item-added' } as CourseItem));
    createFolder = vi.fn(() => 'folder-new');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(reserve = baseReserve, defaultFolderId?: string, keepUnheadedAtRoot = false) {
    const context = editorContext(reserve, addItem, createFolder, defaultFolderId);
    act(() => root.render(
      <SubmissionEditorContext.Provider value={context}>
        <Harness keepUnheadedAtRoot={keepUnheadedAtRoot} onReady={(current, currentWorkspace) => { actions = current; workspace = currentWorkspace; }} />
      </SubmissionEditorContext.Provider>,
    ));
  }

  it('creates a heading folder and assigns an added citation to it', () => {
    render(baseReserve, 'folder-selected');
    act(() => { actions?.addAsWritten(citation); });

    expect(createFolder).toHaveBeenCalledWith('reserve-1', 'Week 1');
    expect(addItem).toHaveBeenCalledWith('reserve-1', expect.objectContaining({ folderId: 'folder-new' }));
    expect(workspace.choices['citation-1']?.addedItemId).toBe('item-added');
  });

  it('reuses a heading folder created earlier in the same review session', () => {
    render();
    act(() => {
      actions?.addAsWritten(citation);
      actions?.addAsWritten({ ...citation, id: 'citation-2', text: 'Test Author (2022). Another synthetic title.' });
    });

    expect(createFolder).toHaveBeenCalledOnce();
    expect(addItem.mock.calls[1][1]).toMatchObject({ folderId: 'folder-new' });
  });

  it('reuses an existing folder with the same heading', () => {
    render({ ...baseReserve, folders: [{ id: 'folder-existing', title: 'Week 1', isOpen: true, itemIds: [] }] });
    act(() => { actions?.addAsWritten(citation); });

    expect(createFolder).not.toHaveBeenCalled();
    expect(addItem).toHaveBeenCalledWith('reserve-1', expect.objectContaining({ folderId: 'folder-existing' }));
  });

  it('leaves unheaded citations outside folders', () => {
    render();
    act(() => { actions?.addAsWritten({ ...citation, heading: null }); });

    expect(createFolder).not.toHaveBeenCalled();
    expect(addItem.mock.calls[0][1]).not.toHaveProperty('folderId');
  });

  it('assigns a matched discovery result to its citation heading folder', () => {
    render(baseReserve, 'folder-selected');
    act(() => { actions?.addMatch('citation-1', result); });

    expect(createFolder).toHaveBeenCalledWith('reserve-1', 'Week 1');
    expect(addItem).toHaveBeenCalledWith('reserve-1', expect.objectContaining({ folderId: 'folder-new' }));
  });

  it('keeps an unheaded syllabus citation at root when opened from a selected folder', () => {
    render(baseReserve, 'folder-selected', true);
    act(() => {
      actions?.addAsWritten(citation);
      actions?.addAsWritten({ ...citation, id: 'citation-root', heading: null });
    });

    expect(addItem.mock.calls.map(([, item]) => item.folderId)).toEqual(['folder-new', undefined]);
  });

  it('keeps a matched syllabus citation in its heading folder when opened from a selected folder', () => {
    render(baseReserve, 'folder-selected', true);
    act(() => { actions?.addMatch('citation-1', result); });

    expect(addItem).toHaveBeenCalledWith('reserve-1', expect.objectContaining({ folderId: 'folder-new' }));
  });
});
