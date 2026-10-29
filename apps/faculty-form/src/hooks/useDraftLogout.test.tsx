import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDraftLogout } from './useDraftLogout';
import { notify } from '@/services/notify';
import { useDraftStore } from '@/store/draftStore';
import { useReserveStore } from '@/store/useReserveStore';

const api = vi.hoisted(() => ({ syncDraft: vi.fn() }));
vi.mock('@/services/api/facultyDraftApi', () => api);
vi.mock('@/handlers/submissionPayload', () => ({ buildSubmissionPayload: vi.fn(() => ({})) }));
vi.mock('@/services/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/notify')>();
  return { ...actual, notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } };
});

vi.hoisted(() => {
  const values: Record<string, string> = {};
  // @ts-expect-error - vi is available while evaluating the hoisted setup
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = String(value); },
    removeItem: (key: string) => { delete values[key]; },
    clear: () => { Object.keys(values).forEach((key) => delete values[key]); },
  });
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Harness({ onLogout }: { onLogout: () => void }) {
  const { handleSaveAndLogout } = useDraftLogout(onLogout);
  return <button onClick={() => void handleSaveAndLogout()}>Save and log out</button>;
}

describe('useDraftLogout', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    useDraftStore.getState().clearAllDrafts();
    useReserveStore.setState({ reserves: [] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('announces saved drafts before logging out', async () => {
    const onLogout = vi.fn();
    act(() => root?.render(<Harness onLogout={onLogout} />));

    await act(async () => {
      container?.querySelector('button')?.click();
    });

    expect(notify.success).toHaveBeenCalledWith('All changes saved');
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('keeps the user signed in and reports a generic save error with its reference', async () => {
    const onLogout = vi.fn();
    useReserveStore.setState({ reserves: [{
      id: 'reserve-1', courseCode: 'BIO 101', courseTitle: 'Synthetic Biology', section: '01',
      instructors: 'Test Faculty', term: 'Fall 2026', status: 'draft', items: [], folders: [], layout: [], lastUpdated: '2026-10-20',
    }] as never });
    useDraftStore.getState().markAsChanged('reserve-1');
    api.syncDraft.mockRejectedValue({ response: { data: { message: 'database password leaked', reference_id: '7F3K2Q' } } });
    act(() => root?.render(<Harness onLogout={onLogout} />));

    await act(async () => {
      container?.querySelector('button')?.click();
    });

    expect(notify.error).toHaveBeenCalledWith("Couldn't save your drafts", { reference: '7F3K2Q' });
    expect(onLogout).not.toHaveBeenCalled();
  });
});
