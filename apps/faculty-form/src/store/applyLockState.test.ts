import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseReserve } from './useReserveStore';

// The persist middleware writes to localStorage on setState; jsdom in this
// project does not provide one, so stub it per-file (mirrors authStore.test.ts).
function makeLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

const baseReserve = (over: Partial<CourseReserve> = {}): CourseReserve =>
  ({
    id: 'sub-1',
    courseCode: 'ENG 101',
    courseTitle: 'Intro',
    section: '01',
    instructors: 'Prof',
    term: 'Fall 2026',
    status: 'submitted',
    items: [],
    folders: [],
    isLocked: false,
    canEdit: true,
    ...over,
  } as unknown as CourseReserve);

describe('useReserveStore.applyLockState', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks the matching reserve locked and not editable with lock metadata', async () => {
    const { useReserveStore: store } = await import('./useReserveStore');
    store.setState({ reserves: [baseReserve()] });

    store.getState().applyLockState('sub-1', {
      locked_by: 'Jane Staff',
      locked_at: '2026-06-20T10:00:00Z',
      lock_reason: 'Processing',
    });

    const r = store.getState().reserves.find((x) => x.id === 'sub-1')!;
    expect(r.isLocked).toBe(true);
    expect(r.canEdit).toBe(false);
    expect(r.lockedBy).toBe('Jane Staff');
    expect(r.lockedAt).toBe('2026-06-20T10:00:00Z');
    expect(r.lockReason).toBe('Processing');
  });

  it('does not touch other reserves', async () => {
    const { useReserveStore: store } = await import('./useReserveStore');
    store.setState({ reserves: [baseReserve(), baseReserve({ id: 'sub-2' })] });
    store.getState().applyLockState('sub-1', {});
    const r2 = store.getState().reserves.find((x) => x.id === 'sub-2')!;
    expect(r2.isLocked).toBe(false);
    expect(r2.canEdit).toBe(true);
  });

  it('clears the matching local draft when a backend lock is detected', async () => {
    const { useReserveStore: store } = await import('./useReserveStore');
    const { useDraftStore } = await import('./draftStore');
    store.setState({ reserves: [baseReserve()] });
    useDraftStore.getState().setDraft('sub-1', {
      uuid: 'sub-1',
      courseCode: 'ENG 101',
      courseTitle: 'Intro',
      section: '01',
      instructors: 'Prof',
      term: 'Fall 2026',
      items: [],
      folders: [],
      isDraft: true,
      lastSavedAt: '2026-06-24T12:00:00.000Z',
      draftVersion: 1,
    });

    store.getState().applyLockState('sub-1', {
      locked_by: 'Jane Staff',
    });

    expect(useDraftStore.getState().getDraft('sub-1')).toBeUndefined();
  });
});
