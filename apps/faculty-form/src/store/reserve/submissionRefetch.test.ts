import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSubmissionReadOnly } from '@/hooks/useSubmissionLock';
import type { FacultyItemWire } from './facultyItemMapping';
import type { CourseReserve } from './types';

type RefetchOptions = {
  previousServerReserve?: CourseReserve;
  onRemoteItemsChanged?: (changed: boolean) => void;
};

let store: typeof import('../useReserveStore').useReserveStore;

describe('submission refocus refresh', () => {
  beforeEach(async () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    vi.resetModules();
    store = (await import('../useReserveStore')).useReserveStore;
  });

  afterEach(() => vi.unstubAllGlobals());

  it('keeps dirty local materials while refreshing submission status and lock fields', async () => {
    const local = buildReserve();
    store.setState({ reserves: [local] });
    const onRemoteItemsChanged = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(backendResponse({
      status: 'complete', is_locked: true, can_edit: false, locked_by_staff_id: 17,
      folders: [], unfoldered_items: [backendMaterial(22, 'Server title')],
    })));

    const fetchWithRefetchOptions = store.getState().fetchSubmissionDetails as unknown as (
      id: string, silent: boolean, options: RefetchOptions
    ) => Promise<CourseReserve | null>;
    const result = await fetchWithRefetchOptions('submission-1', true, {
      previousServerReserve: buildReserve({
        items: [{ id: 'material-new-22', backendItemId: '22', backendKind: 'new', title: 'Previous server title', materialType: 'book', status: 'draft' }],
        folders: [],
      }),
      onRemoteItemsChanged,
    });

    expect(result?.items).toEqual(local.items);
    expect(result?.folders).toEqual(local.folders);
    expect(result).toMatchObject({
      status: 'complete', isLocked: true, canEdit: false, lockedBy: '17',
    });
    expect(isSubmissionReadOnly(result)).toBe(true);
    expect(onRemoteItemsChanged).toHaveBeenCalledWith(true);
    expect(store.getState().getReserveById('submission-1')).toEqual(result);
  });

  it('applies the server copy when local edits are clean', async () => {
    store.setState({ reserves: [buildReserve()] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(backendResponse({
      status: 'submitted', is_locked: false, can_edit: true,
      folders: [], unfoldered_items: [backendMaterial(22, 'Server title')],
    })));

    await store.getState().fetchSubmissionDetails('submission-1', true);

    expect(store.getState().getReserveById('submission-1')?.items.map((item) => item.title))
      .toEqual(['Server title']);
  });

  it('does not fetch or replace local-only drafts', async () => {
    const localDraft = buildReserve({ id: 'reserve-local' });
    store.setState({ reserves: [localDraft] });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const result = await store.getState().fetchSubmissionDetails('reserve-local', true);

    expect(fetch).not.toHaveBeenCalled();
    expect(result).toEqual(localDraft);
    expect(store.getState().getReserveById('reserve-local')).toEqual(localDraft);
  });
});

function buildReserve(overrides: Partial<CourseReserve> = {}): CourseReserve {
  const reserve: CourseReserve = {
    id: 'submission-1', courseCode: 'BIO 101', courseTitle: 'Biology', section: '01',
    instructors: 'Faculty One', term: '2026FA', status: 'submitted',
    items: [
      { id: 'local-item-2', title: 'Unsaved second', materialType: 'article', status: 'draft', displayOrder: 1 },
      { id: 'local-item-1', title: 'Unsaved first', materialType: 'book', status: 'draft', displayOrder: 0 },
    ],
    folders: [
      { id: 'local-folder-b', title: 'Unsaved folder B', isOpen: false, itemIds: [] },
      { id: 'local-folder-a', title: 'Unsaved folder A', isOpen: true, itemIds: [] },
    ],
    layout: [],
    lastUpdated: 'Jun 17, 2026', isLocked: false, canEdit: true,
    ...overrides,
  };
  return {
    ...reserve,
    layout: overrides.layout || [
      ...reserve.folders.map((folder) => ({ kind: 'folder' as const, id: folder.id })),
      ...reserve.items.filter((item) => !item.folderId).map((item) => ({ kind: 'item' as const, id: item.id })),
    ],
  };
}

function backendMaterial(id: number, title: string): FacultyItemWire {
  return {
    kind: 'new', id, folder_id: null, folder_name: null, position: null, display_order: 0,
    is_reuse: false, title, journalTitle: null, material_type: 'book', status: 'draft',
    assignedPages: null, faculty_notes: null, barcode: null, call_number: null, eds: null,
    source_resource_id: null, source_folio_instance_id: null, instance_id: null, holdings_id: null,
    temporary_location: null, permanent_location: null,
    lock: { locked: false, kind: null, reason: null },
    capabilities: { edit: true, delete: true, move: true, reorder: true },
    authors: null, publisher: null, publicationYear: null, isbn: null, issn: null, doi: null,
    edition: null, oclcNumber: null, volume: null, issue: null, pages: null, url: null,
    displayStartDate: null, displayEndDate: null, instance_hrid: null, chapter_title: null, copy: null,
    temporary_location_id: null, permanent_location_id: null,
  };
}

function backendResponse(submission: {
  status: string;
  is_locked: boolean;
  can_edit: boolean;
  folders: [];
  locked_by_staff_id?: number;
  unfoldered_items: ReturnType<typeof backendMaterial>[];
}): Response {
  return {
    ok: true,
    json: async () => ({
      meta: { totalCount: 1 },
      items: [{
        submission_uuid: 'submission-1', course_code: 'BIO 101', course_title: 'Biology',
        section: '01', faculty_display_name: 'Faculty One', term_code: '2026FA',
        updated_at: '2026-06-18T12:00:00.000Z', folders: [], ...submission,
      }],
    }),
  } as Response;
}

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
