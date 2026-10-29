import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSubmissionHandlers } from './submissionHandlers';
import { useReserveStore } from '@/store/useReserveStore';
import { useDraftStore } from '@/store/draftStore';
import { useEditorUIStore } from '@/store/useEditorUIStore';

const notifyError = vi.fn();
vi.mock('@/services/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/notify')>();
  return {
    ...actual,
    notify: { ...actual.notify, error: (...args: unknown[]) => notifyError(...args) },
  };
});

// The persist middleware captures the localStorage reference at store
// creation time (module evaluation). We must install a working stub before
// the useReserveStore module is first evaluated. vi.hoisted() runs its
// callback before all imports are processed, so placing vi.stubGlobal inside
// it ensures localStorage is defined when Zustand's persist middleware
// calls `window.localStorage` during store initialisation.
vi.hoisted(() => {
  const store: Record<string, string> = {};
  // @ts-expect-error — vi is available in vitest's transform context
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  });
});

const reserve = {
  id: 'sub-1', courseCode: 'ENG 101', courseTitle: 'Intro', section: '01',
  instructors: 'Prof', term: 'Fall 2026', status: 'submitted',
  items: [], folders: [], isLocked: false, canEdit: true, lastUpdated: '',
} as unknown as Parameters<typeof createSubmissionHandlers>[1];

const organized = { folders: [], ungroupedItems: [], mixedContent: [] };

describe('confirmSubmit on 423', () => {
  beforeEach(() => {
    useReserveStore.setState({ reserves: [{ ...reserve }] as never });
    notifyError.mockReset();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ locked_by: 'Jane Staff', locked_at: '2026-06-20T10:00:00Z', lock_reason: 'Processing' }),
      { status: 423, headers: { 'Content-Type': 'application/json' } }
    )));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('applies lock state, toasts once, and does not navigate', async () => {
    const navigate = vi.fn();
    const handlers = createSubmissionHandlers(navigate, reserve, organized, vi.fn());
    handlers.confirmSubmit(false);
    await vi.waitFor(() => {
      const r = useReserveStore.getState().reserves.find((x) => x.id === 'sub-1')!;
      expect(r.isLocked).toBe(true);
      expect(r.canEdit).toBe(false);
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledTimes(1);
    expect(notifyError).toHaveBeenCalledWith('This submission can no longer be edited', { reference: undefined });
  });

  it('clears the persisted draft on a 423 lock conflict', async () => {
    useDraftStore.getState().setDraft('sub-1', { uuid: 'sub-1' } as never);
    const navigate = vi.fn();
    const handlers = createSubmissionHandlers(navigate, reserve, organized, vi.fn());
    handlers.confirmSubmit(false);
    await vi.waitFor(() => {
      const r = useReserveStore.getState().reserves.find((x) => x.id === 'sub-1')!;
      expect(r.isLocked).toBe(true);
    });
    expect(useDraftStore.getState().getDraft('sub-1')).toBeUndefined();
  });

  it('opens correction state for API-033 and keeps the proposed draft', async () => {
    const detail = {
      success: false,
      error_code: 'materialized_item_correction_required',
      message: 'Processed course-reserve items must be corrected by library staff.',
      submission_uuid: 'sub-1',
      item_ids: [259],
    };
    useDraftStore.getState().setDraft('sub-1', { uuid: 'sub-1', items: ['proposed change'] } as never);
    useEditorUIStore.setState({ correctionRequiredDialogOpen: false, correctionRequiredDetail: null });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(detail), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })));

    const navigate = vi.fn();
    const handlers = createSubmissionHandlers(navigate, reserve, organized, vi.fn());
    handlers.confirmSubmit(false);

    await vi.waitFor(() => {
      expect(useEditorUIStore.getState().correctionRequiredDialogOpen).toBe(true);
    });

    expect(useEditorUIStore.getState().correctionRequiredDetail).toMatchObject({
      submissionUuid: 'sub-1',
      itemIds: [259],
      attemptedUpdate: { items: [] },
    });
    expect(useDraftStore.getState().getDraft('sub-1')).toBeDefined();
    expect(notifyError).toHaveBeenCalledWith("Couldn't submit this reserve request", { reference: undefined });
    expect(navigate).not.toHaveBeenCalled();
  });
});
