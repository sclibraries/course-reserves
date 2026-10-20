import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseReserve } from '@/store/courseReservesStore';

const api = vi.hoisted(() => ({
  syncDraft: vi.fn(),
  getDraft: vi.fn(),
  isDraftConflict: vi.fn((error: unknown) => (
    (error as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code === 'draft_conflict'
  )),
  submitDraft: vi.fn(),
}));

vi.mock('@/services/api/facultyDraftApi', () => api);

vi.hoisted(() => {
  const values: Record<string, string> = {};
  // @ts-expect-error - vitest exposes vi while evaluating hoisted mocks
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = String(value); },
    removeItem: (key: string) => { delete values[key]; },
    clear: () => { Object.keys(values).forEach((key) => delete values[key]); },
    key: (index: number) => Object.keys(values)[index] ?? null,
    get length() { return Object.keys(values).length; },
  });
});

import { useServerDraftSync } from './useServerDraftSync';
import { DraftConflictNotice } from '@/components/SubmissionEditor/DraftConflictNotice';
import { useReserveStore } from '@/store/useReserveStore';
import { useDraftStore } from '@/store/draftStore';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const initialReserve: CourseReserve = {
  id: 'reserve-local',
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
  courseAssignmentId: 'BIO-101-01-202702',
  academicPeriod: 'AP_202702',
};

function Harness({
  onReady,
  autoSaveEnabled = true,
}: {
  onReady: (sync: ReturnType<typeof useServerDraftSync>) => void;
  autoSaveEnabled?: boolean;
}) {
  const reserve = useReserveStore((state) => state.reserves.find((item) => item.id === initialReserve.id));
  const sync = useServerDraftSync(initialReserve.id, reserve, { autoSaveDelay: 3000, autoSaveEnabled });
  React.useEffect(() => onReady(sync), [onReady, sync]);

  return (
    <div>
      <span data-testid="save-status">{sync.saveStatus}</span>
      <div data-testid="items">{reserve?.items.map((item) => item.title).join(',')}</div>
      {sync.saveStatus === 'retrying' && <p>Not saved - retrying</p>}
      <DraftConflictNotice visible={sync.hasConflict} onLoadLatest={sync.loadLatestVersion} />
    </div>
  );
}

describe('useServerDraftSync', () => {
  let container: HTMLDivElement;
  let root: Root;
  let sync: ReturnType<typeof useServerDraftSync> | null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sync = null;
    useDraftStore.getState().clearAllDrafts();
    useReserveStore.setState({ reserves: [{ ...initialReserve }] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness onReady={(value) => { sync = value; }} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useReserveStore.setState({ reserves: [] });
    useDraftStore.getState().clearAllDrafts();
    vi.useRealTimers();
  });

  it('cancels a queued save when autosave becomes disabled', async () => {
    act(() => sync?.markChanged());
    act(() => root.render(<Harness autoSaveEnabled={false} onReady={(value) => { sync = value; }} />));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    expect(api.syncDraft).not.toHaveBeenCalled();
  });

  it('creates once on the first change and saves later changes with the returned version', async () => {
    api.syncDraft
      .mockResolvedValueOnce({ submission_uuid: 'server-draft-1', status: 'draft', draft_version: 1 })
      .mockResolvedValueOnce({ submission_uuid: 'server-draft-1', status: 'draft', draft_version: 2 });

    act(() => sync?.markChanged());
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    expect(api.syncDraft).toHaveBeenCalledTimes(1);
    expect(useReserveStore.getState().getReserveById(initialReserve.id)).toMatchObject({
      submissionUuid: 'server-draft-1', draftVersion: 1,
    });

    act(() => {
      useReserveStore.getState().updateReserve(initialReserve.id, {
        items: [{ id: 'item-1', title: 'Updated item', materialType: 'book', status: 'draft' }],
      });
      sync?.markChanged();
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    expect(api.syncDraft).toHaveBeenCalledTimes(2);
    expect(api.syncDraft.mock.calls[1][0]).toMatchObject({
      submissionUuid: 'server-draft-1', draftVersion: 1,
    });
    expect(api.syncDraft.mock.calls[1][1]).toMatchObject({ items: expect.any(Array) });
    expect(useReserveStore.getState().getReserveById(initialReserve.id)?.draftVersion).toBe(2);
  });

  it('shows Saved only after confirmation and retries failures with generic copy', async () => {
    let confirmCreate: ((value: { submission_uuid: string; status: 'draft'; draft_version: number }) => void) | undefined;
    api.syncDraft.mockImplementationOnce(() => new Promise((resolve) => { confirmCreate = resolve; }));
    api.syncDraft.mockRejectedValueOnce(new Error('synthetic network detail'));
    api.syncDraft.mockResolvedValueOnce({ submission_uuid: 'server-draft-1', status: 'draft', draft_version: 2 });

    act(() => sync?.markChanged());
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(container.querySelector('[data-testid="save-status"]')?.textContent).toBe('saving');

    await act(async () => {
      confirmCreate?.({ submission_uuid: 'server-draft-1', status: 'draft', draft_version: 1 });
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="save-status"]')?.textContent).toBe('saved');

    act(() => sync?.markChanged());
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(container.textContent).toContain('Not saved - retrying');
    expect(container.textContent).not.toContain('synthetic network detail');

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(container.querySelector('[data-testid="save-status"]')?.textContent).toBe('saved');
    expect(api.syncDraft).toHaveBeenCalledTimes(3);
  });

  it('keeps local edits on a conflict until the user loads the latest version', async () => {
    const serverDraft: CourseReserve = {
      ...initialReserve,
      id: 'server-draft-1',
      submissionUuid: 'server-draft-1',
      draftVersion: 3,
      items: [{ id: 'server-item', title: 'Server version', materialType: 'book', status: 'draft' }],
    };
    act(() => useReserveStore.setState({ reserves: [{
        ...initialReserve,
        submissionUuid: 'server-draft-1',
        draftVersion: 2,
        items: [{ id: 'local-item', title: 'Local edit', materialType: 'book', status: 'draft' }],
      }] }));
    api.syncDraft.mockRejectedValue({ response: { data: { error_code: 'draft_conflict', draft_version: 3 } } });
    api.getDraft.mockResolvedValue(serverDraft);
    act(() => root.render(<Harness onReady={(value) => { sync = value; }} />));

    act(() => sync?.markChanged());
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    expect(container.textContent).toContain('This list was changed on another device');
    expect(container.querySelector('[data-testid="items"]')?.textContent).toContain('Local edit');

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(api.getDraft).toHaveBeenCalledWith('server-draft-1');
    expect(container.querySelector('[data-testid="items"]')?.textContent).toContain('Server version');
    expect(container.querySelector('[data-testid="items"]')?.textContent).not.toContain('Local edit');
  });

  it('flushes a pending save when the page is hidden', async () => {
    api.syncDraft.mockResolvedValue({ submission_uuid: 'server-draft-1', status: 'draft', draft_version: 1 });
    act(() => sync?.markChanged());
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await Promise.resolve();
    });

    expect(api.syncDraft).toHaveBeenCalledTimes(1);
  });

  it('waits for an in-flight first save before promoting that same draft', async () => {
    let confirmSave: ((value: { submission_uuid: string; status: 'draft'; draft_version: number }) => void) | undefined;
    api.syncDraft.mockImplementationOnce(() => new Promise((resolve) => { confirmSave = resolve; }));
    api.submitDraft.mockResolvedValue({ status: 'submitted' });

    act(() => sync?.markChanged());
    let submitPromise: Promise<string | null> | undefined;
    act(() => {
      void sync?.saveDraft();
      submitPromise = sync?.submitCurrentDraft(false);
    });
    expect(api.submitDraft).not.toHaveBeenCalled();

    await act(async () => {
      confirmSave?.({ submission_uuid: 'server-draft-1', status: 'draft', draft_version: 1 });
      await submitPromise;
    });

    expect(api.submitDraft).toHaveBeenCalledWith('server-draft-1');
    await expect(submitPromise).resolves.toBe('server-draft-1');
  });
});
