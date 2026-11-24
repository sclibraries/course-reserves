import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FACULTY_ACCESS_TOKEN_COOKIE } from '@/services/session';
import type { FacultyItemWire } from './reserve/facultyItemMapping';
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

    store.getState().moveItemInFolder('reserve-source', 'folder-a', 'item-2', 'up');
    store.getState().moveFolderPosition('reserve-source', 'folder-a', 'down');

    const updated = store.getState().getReserveById('reserve-source')!;
    expect(updated.items.map((item) => item.id)).toEqual(['item-1', 'item-2']);
    expect(updated.layout).toEqual([
      { kind: 'folder', id: 'folder-b' },
      { kind: 'folder', id: 'folder-a' },
    ]);
    expect(updated.folders[0].itemIds).toEqual(['item-2', 'item-1']);

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
        { id: 'folder-1782388800000-0', title: 'Week 1', itemIds: ['item-1782388800000-1', 'item-1782388800000-0'] },
        { id: 'folder-1782388800000-1', title: 'Week 2', itemIds: [] },
      ],
      layout: [
        { kind: 'folder', id: 'folder-1782388800000-1' },
        { kind: 'folder', id: 'folder-1782388800000-0' },
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

  it('generates distinct IDs for source folders copied in the same millisecond', () => {
    store.setState({ reserves: [buildReserve()] });

    const firstId = store.getState().createFolder('reserve-source', 'Week 3');
    const secondId = store.getState().createFolder('reserve-source', 'Week 4');

    expect(firstId).not.toBe(secondId);
    expect(store.getState().getReserveById('reserve-source')?.folders.map((folder) => folder.title))
      .toContain('Week 3');
    expect(store.getState().getReserveById('reserve-source')?.folders.map((folder) => folder.title))
      .toContain('Week 4');
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
        is_locked: true,
        locked_at: null,
        locked_by_staff_id: 93,
        lock_reason: 'Processing',
        can_edit: false,
        submission_notes: 'Please review chapter 1',
        needed_by_date: '2026-08-20',
        folders: [{
          folder_id: 7,
          name: 'Week 1',
          display_order: 2,
          ambiguous: false,
          items: [facultyItem({
            id: 9,
            folder_id: 7,
            folder_name: 'Week 1',
            position: 0,
            display_order: 3,
            title: 'Climate Book',
            authors: 'Author One',
            material_type: 'book',
            is_reuse: true,
            barcode: 'BC123',
            call_number: 'QC 903 .C55',
            status: 'complete',
          })],
        }],
        unfoldered_items: [facultyItem({
          id: 10,
          folder_id: null,
          folder_name: null,
          title: 'Journal Article',
          authors: 'Author Two',
          material_type: 'article',
          is_reuse: false,
          status: 'needs-review',
          display_order: 1,
        })],
      }],
      meta: { totalCount: 1 },
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
      submissionUuid: 'submission-1',
      courseCode: 'BIO 220',
      courseTitle: 'Ecology',
      section: '01',
      instructors: 'Faculty One',
      term: '2026FA',
      status: 'submitted',
      items: [
        { id: 'material-new-9', backendItemId: '9', backendKind: 'new', isReuse: true, lock: { locked: false, kind: null, reason: null }, capabilities: { edit: true, delete: true, move: true, reorder: true }, title: 'Climate Book', authors: 'Author One', materialType: 'book', status: 'complete', barcode: 'BC123', callNumber: 'QC 903 .C55', journalTitle: '', folderId: 'folder-7', displayOrder: 3 },
        { id: 'material-new-10', backendItemId: '10', backendKind: 'new', isReuse: false, lock: { locked: false, kind: null, reason: null }, capabilities: { edit: true, delete: true, move: true, reorder: true }, title: 'Journal Article', authors: 'Author Two', materialType: 'article', status: 'needs-review', journalTitle: '', displayOrder: 1 },
      ],
      layout: [
        { kind: 'item', id: 'material-new-10' },
        { kind: 'folder', id: 'folder-7' },
      ],
      folders: [{
        id: 'folder-7', backendFolderId: '7', title: 'Week 1', ambiguous: false, isOpen: false,
        itemIds: ['material-new-9'],
      }],
      lastUpdated: dateLabel,
      isTestData: false,
      courseAssignmentId: 'BIO 220-01-2026FA',
      assigneeStaffUserId: null,
      isLocked: true,
      lockedAt: null,
      lockedBy: '93',
      lockReason: 'Processing',
      canEdit: false,
      submissionNotes: 'Please review chapter 1',
      neededByDate: '2026-08-20',
    }]);
    const indexedReserve = store.getState().reserves[0];

    store.setState({ reserves: [] });
    const detail = await store.getState().fetchSubmissionDetails('submission-1');
    expect(detail).toEqual({
      id: 'submission-1',
      submissionUuid: 'submission-1',
      courseCode: 'BIO 220',
      courseTitle: 'Ecology',
      section: '01',
      instructors: 'Faculty One',
      term: '2026FA',
      status: 'submitted',
      items: [
        { id: 'material-new-9', backendItemId: '9', backendKind: 'new', isReuse: true, lock: { locked: false, kind: null, reason: null }, capabilities: { edit: true, delete: true, move: true, reorder: true }, title: 'Climate Book', authors: 'Author One', materialType: 'book', status: 'complete', barcode: 'BC123', callNumber: 'QC 903 .C55', journalTitle: '', folderId: 'folder-7', displayOrder: 3 },
        { id: 'material-new-10', backendItemId: '10', backendKind: 'new', isReuse: false, lock: { locked: false, kind: null, reason: null }, capabilities: { edit: true, delete: true, move: true, reorder: true }, title: 'Journal Article', authors: 'Author Two', materialType: 'article', status: 'needs-review', journalTitle: '', displayOrder: 1 },
      ],
      layout: [
        { kind: 'item', id: 'material-new-10' },
        { kind: 'folder', id: 'folder-7' },
      ],
      folders: [{
        id: 'folder-7', backendFolderId: '7', title: 'Week 1', ambiguous: false, isOpen: false,
        itemIds: ['material-new-9'],
      }],
      lastUpdated: dateLabel,
      isTestData: false,
      assigneeStaffUserId: null,
      isLocked: true,
      lockedAt: null,
      lockedBy: '93',
      lockReason: 'Processing',
      canEdit: false,
      submissionNotes: 'Please review chapter 1',
      neededByDate: '2026-08-20',
    });
    expect(detail?.items).toEqual(indexedReserve.items);
    expect(detail?.folders).toEqual(indexedReserve.folders);
    expect(store.getState().reserves).toEqual([detail]);
  });

  it('persists only reserves and _initialized under the existing key', () => {
    const reserve = buildReserve();
    store.setState({ reserves: [reserve], _initialized: false, loading: true, error: 'temporary' });

    expect(localStorage.getItem('course-reserves-storage')).toBe(JSON.stringify({
      state: { reserves: [reserve], _initialized: false },
      version: 1,
    }));
  });

  it('replaces a locally cached server draft with the latest index row', async () => {
    const localDraft: CourseReserve = {
      ...buildReserve(),
      id: 'reserve-local',
      status: 'draft',
      submissionUuid: 'server-draft-1',
      draftVersion: 1,
      courseAssignmentId: 'BIO-101-01-202702',
      academicPeriod: 'AP_202702',
    };
    store.setState({ reserves: [localDraft] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ meta: { totalCount: 1 }, items: [{
        submission_uuid: 'server-draft-1',
        its_course_id: 'BIO-101-01-202702',
        academic_period: 'AP_202702',
        course_code: 'BIO 101',
        course_title: 'Server course',
        section: '01',
        faculty_display_name: 'Faculty One',
        term_code: '2027SP',
        status: 'draft',
        draft_version: 4,
        updated_at: '2026-10-20T12:00:00.000Z',
        can_edit: true,
        folders: [],
        unfoldered_items: [],
      }] }),
    }));

    await store.getState().fetchSubmissions();

    expect(store.getState().reserves).toHaveLength(1);
    expect(store.getState().reserves[0]).toMatchObject({
      id: 'server-draft-1', submissionUuid: 'server-draft-1', draftVersion: 4,
      courseTitle: 'Server course',
    });
  });

  it('migrates a legacy persisted reserve without changing its mixed order', async () => {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: string) => btoa(value).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const token = `${encode('{"alg":"none"}')}.${encode(JSON.stringify({
      username: 'test-faculty-a', role: 'faculty', exp: now + 3600,
    }))}.synthetic-signature`;
    document.cookie = `${FACULTY_ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/`;
    const legacyReserve = {
      id: 'reserve-legacy', courseCode: 'ENG 101', courseTitle: 'Source course',
      section: '01', instructors: 'Faculty One', term: '2026SP', status: 'draft',
      lastUpdated: 'Jun 17, 2026',
      folders: [{
        id: 'folder-legacy', title: 'Week 1', isOpen: true, position: 0.5,
        items: [{ id: 'nested-item', title: 'Nested', materialType: 'book', status: 'draft', folderId: 'folder-legacy' }],
      }],
      items: [
        { id: 'loose-1', title: 'First', materialType: 'book', status: 'draft' },
        { id: 'nested-item', title: 'Nested', materialType: 'book', status: 'draft', folderId: 'folder-legacy' },
        { id: 'loose-2', title: 'Last', materialType: 'article', status: 'draft' },
      ],
    };
    localStorage.setItem('course-reserves-storage', JSON.stringify({
      state: { reserves: [legacyReserve], _initialized: true, ownerUsername: 'test-faculty-a' },
      version: 0,
    }));

    await store.persist.rehydrate();

    const migrated = store.getState().getReserveById('reserve-legacy')!;
    expect(migrated.layout).toEqual([
      { kind: 'item', id: 'loose-1' },
      { kind: 'folder', id: 'folder-legacy' },
      { kind: 'item', id: 'loose-2' },
    ]);
    expect(migrated.folders[0].itemIds).toEqual(['nested-item']);
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

function facultyItem(overrides: Partial<FacultyItemWire>): FacultyItemWire {
  return {
    kind: 'new', id: 1, folder_id: null, folder_name: null, position: null, display_order: 0,
    is_reuse: false, status: 'pending', title: 'Synthetic item', journalTitle: null, material_type: null,
    assignedPages: null, faculty_notes: null, barcode: null, call_number: null, eds: null,
    source_resource_id: null, source_folio_instance_id: null, instance_id: null, holdings_id: null,
    temporary_location: null, permanent_location: null,
    lock: { locked: false, kind: null, reason: null },
    capabilities: { edit: true, delete: true, move: true, reorder: true },
    authors: null, publisher: null, publicationYear: null, isbn: null, issn: null, doi: null,
    edition: null, oclcNumber: null, volume: null, issue: null, pages: null, url: null,
    displayStartDate: null, displayEndDate: null, instance_hrid: null, chapter_title: null, copy: null,
    temporary_location_id: null, permanent_location_id: null,
    ...overrides,
  };
}

function buildReserve(): CourseReserve {
  return {
    id: 'reserve-source', courseCode: 'ENG 101', courseTitle: 'Source course',
    section: '01', instructors: 'Faculty One', term: '2026SP', status: 'complete',
    lastUpdated: 'Jun 17, 2026',
    folders: [
      { id: 'folder-a', title: 'Week 1', isOpen: true, itemIds: ['item-1', 'item-2'] },
      { id: 'folder-b', title: 'Week 2', isOpen: false, itemIds: [] },
    ],
    layout: [{ kind: 'folder', id: 'folder-a' }, { kind: 'folder', id: 'folder-b' }],
    items: [
      { id: 'item-1', title: 'First', materialType: 'book', status: 'complete', folderId: 'folder-a' },
      { id: 'item-2', title: 'Second', materialType: 'article', status: 'needs-review', folderId: 'folder-a' },
    ],
  };
}
