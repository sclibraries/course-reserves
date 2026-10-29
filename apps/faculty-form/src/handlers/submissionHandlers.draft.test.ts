import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseReserve } from '@/store/courseReservesStore';

vi.mock('@/services/notify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

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
});
