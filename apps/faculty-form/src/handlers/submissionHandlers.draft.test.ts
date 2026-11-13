import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseReserve } from '@/store/courseReservesStore';
import { useDraftStore } from '@/store/draftStore';

const mocks = vi.hoisted(() => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  getSafeErrorFeedback: vi.fn((_error: unknown, message: string) => ({ message })),
}));

vi.mock('@/services/notify', () => mocks);

vi.hoisted(() => {
  const values: Record<string, string> = {};
  // @ts-expect-error - vitest exposes vi while evaluating hoisted mocks
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = String(value); },
    removeItem: (key: string) => { delete values[key]; },
    clear: () => { Object.keys(values).forEach((key) => delete values[key]); },
  });
});

import { createSubmissionHandlers } from './submissionHandlers';
import { shouldSubmitAsDraft } from './shouldSubmitAsDraft';
import { notify } from '@/services/notify';

describe('submissionHandlers server draft submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    useDraftStore.getState().clearAllDrafts();
  });

  it('submits an existing server draft through its draft action without creating a second row', async () => {
    const navigate = vi.fn();
    const submitDraft = vi.fn(async () => 'server-draft-1');
    const reserve: CourseReserve = {
      id: 'server-draft-1',
      submissionUuid: 'server-draft-1',
      draftVersion: 3,
      courseCode: 'BIO 101',
      courseTitle: 'Synthetic Biology',
      section: '01',
      instructors: 'Test Faculty',
      term: '2027SP',
      status: 'draft',
      items: [],
      folders: [],
      layout: [],
      lastUpdated: 'Oct 20, 2026',
    };
    expect(shouldSubmitAsDraft(reserve, false)).toBe(true);
    expect(shouldSubmitAsDraft({ ...reserve, submissionUuid: undefined }, true)).toBe(true);
    expect(shouldSubmitAsDraft({ ...reserve, submissionUuid: undefined }, false)).toBe(false);
    expect(shouldSubmitAsDraft({ ...reserve, status: 'submitted' }, true)).toBe(false);

    const handlers = createSubmissionHandlers(
      navigate,
      reserve,
      { folders: [], ungroupedItems: [], mixedContent: [] },
      vi.fn(),
      { submitDraft },
    );

    handlers.confirmSubmit(true);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/submission/server-draft-1?refresh=true'));

    expect(submitDraft).toHaveBeenCalledWith(true);
    expect(notify.success).toHaveBeenCalledWith('Submission sent');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('routes a locally changed list through draft creation and promotion before its debounce', async () => {
    const navigate = vi.fn();
    const submitDraft = vi.fn(async () => 'created-draft-1');
    const reserve: CourseReserve = {
      id: 'reserve-local',
      courseCode: 'BIO 101',
      courseTitle: 'Synthetic Biology',
      section: '01',
      instructors: 'Test Faculty',
      term: '2027SP',
      status: 'draft',
      items: [{ id: 'item-1', title: 'Manual item', materialType: 'book', status: 'draft' }],
      folders: [],
      layout: [{ kind: 'item', id: 'item-1' }],
      lastUpdated: 'Oct 20, 2026',
    };
    expect(shouldSubmitAsDraft(reserve, false)).toBe(true);

    const handlers = createSubmissionHandlers(
      navigate,
      reserve,
      { folders: [], ungroupedItems: reserve.items, mixedContent: [] },
      vi.fn(),
      { submitDraft },
    );

    handlers.confirmSubmit(false);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/submission/created-draft-1?refresh=true'));

    expect(submitDraft).toHaveBeenCalledWith(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns a promise that settles after draft submission finishes', async () => {
    let finishSubmit!: (uuid: string | null) => void;
    const submitDraft = vi.fn(() => new Promise<string | null>((resolve) => { finishSubmit = resolve; }));
    const navigate = vi.fn();
    const reserve: CourseReserve = {
      id: 'reserve-local', courseCode: 'BIO 101', courseTitle: 'Synthetic Biology', section: '01',
      instructors: 'Test Faculty', term: '2027SP', status: 'draft',
      items: [{ id: 'item-1', title: 'Manual item', materialType: 'book', status: 'draft' }],
      folders: [], layout: [{ kind: 'item', id: 'item-1' }], lastUpdated: 'Oct 20, 2026',
    };
    const handlers = createSubmissionHandlers(
      navigate, reserve, { folders: [], ungroupedItems: reserve.items, mixedContent: [] }, vi.fn(),
      { submitDraft, hasUnsavedChanges: true },
    );

    let settled = false;
    const result = handlers.confirmSubmit(false).then((value) => { settled = true; return value; });
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    finishSubmit('submitted-draft');

    await expect(result).resolves.toEqual({ success: true });
    expect(navigate).toHaveBeenCalledWith('/submission/submitted-draft?refresh=true');
  });

  it.each([
    { description: 'without existing feedback', status: 'idle' as const, saveError: undefined, expectedMessage: "Couldn't submit this reserve request", toast: true },
    { description: 'after a conflict warning', status: 'error' as const, saveError: undefined, expectedMessage: 'This list was changed on another device', toast: false },
    { description: 'after a save error', status: 'error' as const, saveError: 'Not saved. Please contact the library if this continues.', expectedMessage: 'Not saved. Please contact the library if this continues.', toast: false },
  ])('gives one visible result when draft submission returns null $description', async ({ status, saveError, expectedMessage, toast }) => {
    const reserve: CourseReserve = {
      id: 'reserve-local', courseCode: 'BIO 101', courseTitle: 'Synthetic Biology', section: '01',
      instructors: 'Test Faculty', term: '2027SP', status: 'draft',
      items: [{ id: 'item-1', title: 'Manual item', materialType: 'book', status: 'draft' }],
      folders: [], layout: [{ kind: 'item', id: 'item-1' }], lastUpdated: 'Oct 20, 2026',
    };
    const submitDraft = vi.fn(async () => {
      if (status !== 'idle') useDraftStore.getState().setSavingStatus(reserve.id, status);
      if (saveError) useDraftStore.getState().setSaveError(reserve.id, saveError);
      return null;
    });
    const navigate = vi.fn();
    const handlers = createSubmissionHandlers(
      navigate, reserve, { folders: [], ungroupedItems: reserve.items, mixedContent: [] }, vi.fn(),
      { submitDraft, hasUnsavedChanges: true },
    );

    await expect(handlers.confirmSubmit(false)).resolves.toEqual({ success: false, message: expectedMessage });
    expect(notify.error).toHaveBeenCalledTimes(toast ? 1 : 0);
    if (toast) expect(notify.error).toHaveBeenCalledWith(expectedMessage);
    expect(navigate).not.toHaveBeenCalled();
  });
});
