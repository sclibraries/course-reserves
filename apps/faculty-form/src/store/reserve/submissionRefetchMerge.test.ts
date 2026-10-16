import { describe, expect, it } from 'vitest';
import { mergeRefetchedSubmission } from './submissionRefetchMerge';
import type { CourseReserve } from './types';

describe('mergeRefetchedSubmission', () => {
  it('keeps dirty materials and applies server-owned status and lock fields', () => {
    const previousServer = buildReserve({
      items: [{ id: 'server-item', title: 'Previous server title', materialType: 'book', status: 'draft' }],
    });
    const local = buildReserve({
      items: [{ id: 'local-item', title: 'Unsaved title', materialType: 'book', status: 'draft' }],
      folders: [{ id: 'local-folder', title: 'Unsaved folder', isOpen: true, items: [], position: 0 }],
    });
    const server = buildReserve({
      status: 'complete', isLocked: true, canEdit: false, lockedBy: 'Library staff',
      items: [{ id: 'server-item', title: 'Server title', materialType: 'book', status: 'complete' }],
      folders: [{ id: 'server-folder', title: 'Server folder', isOpen: false, items: [], position: 0 }],
    });

    const result = mergeRefetchedSubmission(local, server, previousServer);

    expect(result.reserve.items).toEqual(local.items);
    expect(result.reserve.folders).toEqual(local.folders);
    expect(result.reserve).toMatchObject({
      status: 'complete', isLocked: true, canEdit: false, lockedBy: 'Library staff',
    });
    expect(result.hasRemoteItemsChanged).toBe(true);
  });

  it('does not report a remote update when only the local copy changed', () => {
    const previousServer = buildReserve({
      items: [{ id: 'server-item', title: 'Server title', materialType: 'book', status: 'draft' }],
    });
    const local = buildReserve({
      items: [{ id: 'server-item', title: 'Unsaved local title', materialType: 'book', status: 'draft' }],
    });
    const unchangedServer = buildReserve({
      items: [{ id: 'server-item', title: 'Server title', materialType: 'book', status: 'draft' }],
    });

    expect(mergeRefetchedSubmission(local, unchangedServer, previousServer).hasRemoteItemsChanged)
      .toBe(false);
  });

  it('applies the complete server copy when local state is clean', () => {
    const local = buildReserve({ courseTitle: 'Old title' });
    const server = buildReserve({
      courseTitle: 'New title',
      items: [{ id: 'server-item', title: 'Server title', materialType: 'book', status: 'draft' }],
    });

    const result = mergeRefetchedSubmission(local, server, local);

    expect(result).toEqual({ reserve: server, hasRemoteItemsChanged: false });
  });

  it('ignores folder expansion state when deciding whether server materials changed', () => {
    const local = buildReserve({
      folders: [{ id: 'folder-1', title: 'Week 1', isOpen: true, items: [], position: 0 }],
    });
    const server = buildReserve({
      folders: [{ id: 'folder-1', title: 'Week 1', isOpen: false, items: [], position: 0 }],
    });

    expect(mergeRefetchedSubmission(local, server, buildReserve({
      folders: [{ id: 'folder-1', title: 'Week 1', isOpen: false, items: [], position: 0 }],
    })).hasRemoteItemsChanged).toBe(false);
  });
});

function buildReserve(overrides: Partial<CourseReserve> = {}): CourseReserve {
  return {
    id: 'submission-1', courseCode: 'BIO 101', courseTitle: 'Biology', section: '01',
    instructors: 'Faculty One', term: '2026FA', status: 'submitted', items: [], folders: [],
    lastUpdated: 'Jun 17, 2026', isLocked: false, canEdit: true,
    ...overrides,
  };
}
