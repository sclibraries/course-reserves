import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notify } from '@/services/notify';
import { CourseModal } from '@/components/CourseModal';
import { useTermsStore } from '@/store/termsStore';
import { createCourseHandlers, createFolderHandlers } from './folderHandlers';

const mocks = vi.hoisted(() => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/services/notify', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/services/notify')>(),
  notify: mocks.notify,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('folder and course actions', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('names folder creation and deletion after those actions succeed', () => {
    const createFolder = vi.fn();
    const deleteFolder = vi.fn();
    vi.stubGlobal('prompt', vi.fn(() => '  Reading list  '));
    const handlers = createFolderHandlers('reserve-1', [], createFolder, vi.fn(), deleteFolder, vi.fn());

    handlers.handleCreateFolder();
    handlers.handleDeleteFolder('folder-1');

    expect(createFolder).toHaveBeenCalledWith('reserve-1', 'Reading list');
    expect(deleteFolder).toHaveBeenCalledWith('reserve-1', 'folder-1');
    expect(notify.success).toHaveBeenNthCalledWith(1, 'Folder created');
    expect(notify.success).toHaveBeenNthCalledWith(2, 'Folder deleted');
    vi.unstubAllGlobals();
  });

  it('names a folder after a successful rename', () => {
    const updateFolder = vi.fn();
    const handlers = createFolderHandlers('reserve-1', [], vi.fn(), updateFolder, vi.fn(), vi.fn());

    handlers.handleUpdateFolder('folder-1', { title: 'Reading list' });

    expect(updateFolder).toHaveBeenCalledWith('reserve-1', 'folder-1', { title: 'Reading list' });
    expect(notify.success).toHaveBeenCalledWith('Folder renamed to Reading list');
  });

  it('refuses duplicate names, permits a self-rename, and repairs an existing duplicate', () => {
    const createFolder = vi.fn();
    const updateFolder = vi.fn();
    vi.stubGlobal('prompt', vi.fn(() => ' week 1 '));
    const handlers = createFolderHandlers('reserve-1', [
      { id: 'folder-1', title: 'Week 1' },
      { id: 'folder-3', title: 'week 1' },
      { id: 'folder-2', title: 'Reading list' },
    ], createFolder, updateFolder, vi.fn(), vi.fn());

    handlers.handleCreateFolder();
    handlers.handleUpdateFolder('folder-2', { title: 'WEEK 1' });
    handlers.handleUpdateFolder('folder-2', { title: 'rEaDiNg LiSt' });
    handlers.handleUpdateFolder('folder-3', { title: 'Week 1 renamed' });

    expect(createFolder).not.toHaveBeenCalled();
    expect(updateFolder).toHaveBeenCalledTimes(2);
    expect(updateFolder).toHaveBeenNthCalledWith(1, 'reserve-1', 'folder-2', { title: 'rEaDiNg LiSt' });
    expect(updateFolder).toHaveBeenNthCalledWith(2, 'reserve-1', 'folder-3', { title: 'Week 1 renamed' });
    expect(notify.error).toHaveBeenNthCalledWith(1, 'A folder named "Week 1" already exists.');
    expect(notify.error).toHaveBeenNthCalledWith(2, 'A folder named "Week 1" already exists.');
    expect(notify.success).toHaveBeenCalledWith('Folder renamed to rEaDiNg LiSt');
    vi.unstubAllGlobals();
  });

  it('shows one toast when the editor saves course details', async () => {
    const updateReserve = vi.fn();
    const setCourseModalOpen = vi.fn();
    const handlers = createCourseHandlers('reserve-1', updateReserve, setCourseModalOpen);
    useTermsStore.setState({ lastFetched: Date.now() });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => root?.render(createElement(CourseModal, {
      open: true,
      onOpenChange: () => {},
      onSave: handlers.handleSaveCourse,
      initialData: {
        courseCode: 'BIO 101', courseTitle: 'Synthetic Biology', section: '01', instructors: 'Test Faculty', term: 'Fall 2026',
      },
      isEditing: true,
    })));
    await act(async () => fireEvent.click(getByRole(document.body, 'button', { name: 'Save Changes' })));

    expect(notify.success).toHaveBeenCalledTimes(1);
    expect(notify.success).toHaveBeenCalledWith('Course details updated');
    expect(updateReserve).toHaveBeenCalledWith('reserve-1', expect.objectContaining({ courseCode: 'BIO 101' }));
    expect(setCourseModalOpen).toHaveBeenCalledWith(false);
  });
});
