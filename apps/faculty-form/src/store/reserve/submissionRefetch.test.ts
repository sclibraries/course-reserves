import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSubmissionReadOnly } from '@/hooks/useSubmissionLock';
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
      status: 'complete', is_locked: true, can_edit: false, locked_by: 'Library staff',
      unfoldered_items: [backendMaterial(22, 'Server title')],
    })));

    const fetchWithRefetchOptions = store.getState().fetchSubmissionDetails as unknown as (
      id: string, silent: boolean, options: RefetchOptions
    ) => Promise<CourseReserve | null>;
    const result = await fetchWithRefetchOptions('submission-1', true, {
      previousServerReserve: buildReserve({
        items: [{ id: 'material-22', title: 'Previous server title', materialType: 'book', status: 'draft' }],
        folders: [],
      }),
      onRemoteItemsChanged,
    });

    expect(result?.items).toEqual(local.items);
    expect(result?.folders).toEqual(local.folders);
    expect(result).toMatchObject({
      status: 'complete', isLocked: true, canEdit: false, lockedBy: 'Library staff',
    });
    expect(isSubmissionReadOnly(result)).toBe(true);
    expect(onRemoteItemsChanged).toHaveBeenCalledWith(true);
    expect(store.getState().getReserveById('submission-1')).toEqual(result);
  });

  it('applies the server copy when local edits are clean', async () => {
    store.setState({ reserves: [buildReserve()] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(backendResponse({
      status: 'submitted', is_locked: false, can_edit: true,
      unfoldered_items: [backendMaterial(22, 'Server title')],
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
  return {
    id: 'submission-1', courseCode: 'BIO 101', courseTitle: 'Biology', section: '01',
    instructors: 'Faculty One', term: '2026FA', status: 'submitted',
    items: [
      { id: 'local-item-2', title: 'Unsaved second', materialType: 'article', status: 'draft', displayOrder: 1 },
      { id: 'local-item-1', title: 'Unsaved first', materialType: 'book', status: 'draft', displayOrder: 0 },
    ],
    folders: [
      { id: 'local-folder-b', title: 'Unsaved folder B', isOpen: false, items: [], position: 1 },
      { id: 'local-folder-a', title: 'Unsaved folder A', isOpen: true, items: [], position: 0 },
    ],
    lastUpdated: 'Jun 17, 2026', isLocked: false, canEdit: true,
    ...overrides,
  };
}

function backendMaterial(id: number, title: string) {
  return { id, title, material_type: 'book', status: 'draft', display_order: 0 };
}

function backendResponse(submission: {
  status: string;
  is_locked: boolean;
  can_edit: boolean;
  locked_by?: string;
  unfoldered_items: ReturnType<typeof backendMaterial>[];
}): Response {
  return {
    ok: true,
    json: async () => ({
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
