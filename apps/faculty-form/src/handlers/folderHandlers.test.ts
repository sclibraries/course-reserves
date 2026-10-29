import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notify } from '@/services/notify';
import { createCourseHandlers, createFolderHandlers } from './folderHandlers';

vi.mock('@/services/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/notify')>();
  return { ...actual, notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } };
});

describe('folder and course actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('names folder creation and deletion after those actions succeed', () => {
    const createFolder = vi.fn();
    const deleteFolder = vi.fn();
    vi.stubGlobal('prompt', vi.fn(() => '  Reading list  '));
    const handlers = createFolderHandlers('reserve-1', createFolder, vi.fn(), deleteFolder, vi.fn());

    handlers.handleCreateFolder();
    handlers.handleDeleteFolder('folder-1');

    expect(createFolder).toHaveBeenCalledWith('reserve-1', 'Reading list');
    expect(deleteFolder).toHaveBeenCalledWith('reserve-1', 'folder-1');
    expect(notify.success).toHaveBeenNthCalledWith(1, 'Folder created');
    expect(notify.success).toHaveBeenNthCalledWith(2, 'Folder deleted');
    vi.unstubAllGlobals();
  });

  it('names the saved course detail change', () => {
    const updateReserve = vi.fn();
    const setCourseModalOpen = vi.fn();
    const handlers = createCourseHandlers('reserve-1', updateReserve, setCourseModalOpen);

    handlers.handleSaveCourse({
      courseCode: 'BIO 101', courseTitle: 'Synthetic Biology', section: '01', instructors: 'Test Faculty', term: 'Fall 2026',
    });

    expect(notify.success).toHaveBeenCalledWith('Course details updated');
    expect(setCourseModalOpen).toHaveBeenCalledWith(false);
  });
});
