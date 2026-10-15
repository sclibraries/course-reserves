import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseReserve } from './useReserveStore';

let store: typeof import('./useReserveStore').useReserveStore;

describe('useReserveStore characterization', () => {
  beforeEach(async () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    vi.resetModules();
    vi.setSystemTime(new Date('2026-06-25T12:00:00.000Z'));
    store = (await import('./useReserveStore')).useReserveStore;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('keeps item and folder actions, cloning and duplicate clearing behavior', () => {
    const source = buildReserve();
    store.setState({ reserves: [source] });

    store.getState().reorderItems('reserve-source', ['item-2', 'item-1']);
    store.getState().moveItemInFolder('reserve-source', 'folder-a', 'item-2', 'down');
    store.getState().moveFolderPosition('reserve-source', 'folder-a', 'down');

    const updated = store.getState().getReserveById('reserve-source')!;
    expect(updated.items.map((item) => item.id)).toEqual(['item-1', 'item-2']);
    expect(updated.folders.map(({ id, position }) => ({ id, position }))).toEqual([
      { id: 'folder-a', position: 1 },
      { id: 'folder-b', position: 0 },
    ]);

    const cloneId = store.getState().cloneReserve('reserve-source', {
      courseCode: 'BIO 220',
      courseTitle: 'Ecology',
      section: '02',
      instructors: 'Faculty Two',
      term: '2026FA',
    });
    const clone = store.getState().getReserveById(cloneId)!;
    expect(clone).toMatchObject({
      id: 'reserve-1782388800000',
      courseCode: 'BIO 220',
      status: 'draft',
      isTestData: false,
      folders: [
        { id: 'folder-1782388800000-0', title: 'Week 1', items: [] },
        { id: 'folder-1782388800000-1', title: 'Week 2', items: [] },
      ],
      items: [
        { id: 'item-1782388800000-0', title: 'First', folderId: 'folder-1782388800000-0', status: 'draft' },
        { id: 'item-1782388800000-1', title: 'Second', folderId: 'folder-1782388800000-0', status: 'draft' },
      ],
    });

    store.setState({ reserves: [...store.getState().reserves, { ...source, courseTitle: 'Later duplicate' }] });
    store.getState().clearDuplicates();
    expect(store.getState().reserves.filter((reserve) => reserve.id === 'reserve-source')).toHaveLength(1);
    expect(store.getState().getReserveById('reserve-source')?.courseTitle).toBe('Source course');
  });

  it('maps submission index and detail responses into the exact reserve state', async () => {
    const updatedAt = '2026-06-17T12:00:00.000Z';
    const responseBody = {
      items: [{
        submission_uuid: 'submission-1',
        course_code: 'BIO 220',
        course_title: 'Ecology',
        section: '01',
        faculty_display_name: 'Faculty One',
        term_code: '2026FA',
        status: 'submitted',
        updated_at: updatedAt,
        assignee_staff_user_id: null,
        is_locked: false,
        locked_at: null,
        locked_by: 'Staff Member',
        locked_by_staff_id: null,
        lock_reason: 'Processing',
        can_edit: false,
        submission_notes: 'Please review chapter 1',
        needed_by_date: '2026-08-20',
        folders: [{
          id: 7,
          name: 'Week 1',
          display_order: 2,
          items: [{
            id: 9,
            title: 'Climate Book',
            authors: 'Author One',
            material_type: 'book',
            is_reuse: true,
            barcode: 'BC123',
            call_number: 'QC 903 .C55',
            status: 'complete',
            display_order: 3,
          }],
          item_count: 1,
        }],
        unfoldered_items: [{
          id: 10,
          title: 'Journal Article',
          authors: 'Author Two',
          material_type: 'article',
          is_reuse: false,
          status: 'needs-review',
          display_order: 1,
        }],
      }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responseBody,
    }));

    await store.getState().fetchSubmissions();
    const dateLabel = new Date(updatedAt).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    expect(store.getState().reserves).toEqual([{
      id: 'submission-1',
      courseCode: 'BIO 220',
      courseTitle: 'Ecology',
      section: '01',
      instructors: 'Faculty One',
      term: '2026FA',
      status: 'submitted',
      items: [
        { id: 'material-9', title: 'Climate Book', authors: 'Author One', materialType: 'book', status: 'complete', barcode: 'BC123', callNumber: 'QC 903 .C55', folderId: 'folder-7', displayOrder: 3 },
        { id: 'material-10', title: 'Journal Article', authors: 'Author Two', materialType: 'article', status: 'needs-review', barcode: undefined, callNumber: undefined, displayOrder: 1 },
      ],
      folders: [{
        id: 'folder-7', title: 'Week 1', isOpen: false,
        items: [{ id: 'material-9', title: 'Climate Book', authors: 'Author One', materialType: 'book', status: 'complete', barcode: 'BC123', callNumber: 'QC 903 .C55', folderId: 'folder-7', displayOrder: 3 }],
        position: 2,
      }],
      lastUpdated: dateLabel,
      isTestData: false,
      courseAssignmentId: 'BIO 220-01-2026FA',
      assigneeStaffUserId: null,
      isLocked: true,
      lockedAt: null,
      lockedBy: 'Staff Member',
      lockReason: 'Processing',
      canEdit: false,
    }]);

    store.setState({ reserves: [] });
    const detail = await store.getState().fetchSubmissionDetails('submission-1');
    expect(detail).toEqual({
      id: 'submission-1',
      courseCode: 'BIO 220',
      courseTitle: 'Ecology',
      section: '01',
      instructors: 'Faculty One',
      term: '2026FA',
      status: 'submitted',
      items: [
        { id: 'material-9', backendItemId: '9', title: 'Climate Book', authors: 'Author One', materialType: 'book', status: 'complete', barcode: 'BC123', callNumber: 'QC 903 .C55', folderId: 'folder-7', displayOrder: 3 },
        { id: 'material-10', backendItemId: '10', title: 'Journal Article', authors: 'Author Two', materialType: 'article', status: 'needs-review', barcode: undefined, callNumber: undefined, displayOrder: 1 },
      ],
      folders: [{
        id: 'folder-7', backendFolderId: '7', title: 'Week 1', isOpen: false,
        items: [{ id: 'material-9', backendItemId: '9', title: 'Climate Book', authors: 'Author One', materialType: 'book', status: 'complete', barcode: 'BC123', callNumber: 'QC 903 .C55', folderId: 'folder-7', displayOrder: 3 }],
        position: 2,
      }],
      lastUpdated: dateLabel,
      isTestData: false,
      assigneeStaffUserId: null,
      isLocked: true,
      lockedAt: null,
      lockedBy: 'Staff Member',
      lockReason: 'Processing',
      canEdit: false,
      submissionNotes: 'Please review chapter 1',
      neededByDate: '2026-08-20',
    });
    expect(store.getState().reserves).toEqual([detail]);
  });

  it('persists only reserves and _initialized under the existing key', () => {
    const reserve = buildReserve();
    store.setState({ reserves: [reserve], _initialized: false, loading: true, error: 'temporary' });

    expect(localStorage.getItem('course-reserves-storage')).toBe(JSON.stringify({
      state: { reserves: [reserve], _initialized: false },
      version: 0,
    }));
  });
});

function makeLocalStorageMock() {
  const values: Record<string, string> = {};
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = String(value); },
    removeItem: (key: string) => { delete values[key]; },
    clear: () => { Object.keys(values).forEach((key) => delete values[key]); },
    key: (index: number) => Object.keys(values)[index] ?? null,
    get length() { return Object.keys(values).length; },
  };
}

function buildReserve(): CourseReserve {
  return {
    id: 'reserve-source', courseCode: 'ENG 101', courseTitle: 'Source course',
    section: '01', instructors: 'Faculty One', term: '2026SP', status: 'complete',
    lastUpdated: 'Jun 17, 2026',
    folders: [
      { id: 'folder-a', title: 'Week 1', isOpen: true, position: 0, items: [] },
      { id: 'folder-b', title: 'Week 2', isOpen: false, position: 1, items: [] },
    ],
    items: [
      { id: 'item-1', title: 'First', materialType: 'book', status: 'complete', folderId: 'folder-a' },
      { id: 'item-2', title: 'Second', materialType: 'article', status: 'needs-review', folderId: 'folder-a' },
    ],
  };
}
