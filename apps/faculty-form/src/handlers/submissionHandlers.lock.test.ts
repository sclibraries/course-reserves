import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSubmissionHandlers } from './submissionHandlers';
import { useReserveStore } from '@/store/useReserveStore';
import { useDraftStore } from '@/store/draftStore';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));

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
    toastError.mockReset();
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
    expect(toastError).toHaveBeenCalledTimes(1);
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
});
