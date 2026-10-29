import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseReserve } from '@/store/courseReservesStore';

const api = vi.hoisted(() => ({ discardDraft: vi.fn() }));
vi.mock('@/services/api/facultyDraftApi', () => api);
vi.mock('@/services/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/notify')>();
  return { ...actual, notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } };
});

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

import { DraftDiscardButton } from './DraftDiscardButton';
import { useReserveStore } from '@/store/useReserveStore';
import { useDraftStore } from '@/store/draftStore';
import { notify } from '@/services/notify';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const draft: CourseReserve = {
  id: 'server-draft-1', submissionUuid: 'server-draft-1', draftVersion: 2,
  courseCode: 'BIO 101', courseTitle: 'Synthetic Biology', section: '01',
  instructors: 'Test Faculty', term: '2027SP', status: 'draft', items: [], folders: [],
  layout: [], lastUpdated: 'Oct 20, 2026',
};

describe('DraftDiscardButton', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    api.discardDraft.mockResolvedValue(undefined);
    useReserveStore.setState({ reserves: [{ ...draft }] });
    useDraftStore.getState().clearAllDrafts();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<DraftDiscardButton submissionId={draft.id} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useReserveStore.setState({ reserves: [] });
    useDraftStore.getState().clearAllDrafts();
  });

  it('confirms, deletes the server draft, and removes the reserve locally', async () => {
    act(() => findButton('Discard draft', 0)?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await vi.waitFor(() => expect(document.body.textContent).toContain('Discard this draft?'));

    const buttons = Array.from(document.querySelectorAll('button')).filter((button) => (
      button.textContent?.trim() === 'Discard draft'
    ));
    await act(async () => {
      buttons[buttons.length - 1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await vi.waitFor(() => expect(useReserveStore.getState().getReserveById(draft.id)).toBeUndefined());
    expect(api.discardDraft).toHaveBeenCalledWith('server-draft-1');
    expect(notify.success).toHaveBeenCalledWith('Draft discarded');
  });

  it('keeps the draft and shows a generic error with the server reference when discard fails', async () => {
    api.discardDraft.mockRejectedValueOnce({
      response: { data: { message: 'database password leaked', reference_id: '7F3K2Q' } },
    });
    act(() => findButton('Discard draft', 0)?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await vi.waitFor(() => expect(document.body.textContent).toContain('Discard this draft?'));
    const buttons = Array.from(document.querySelectorAll('button')).filter((button) => (
      button.textContent?.trim() === 'Discard draft'
    ));
    await act(async () => {
      buttons[buttons.length - 1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(useReserveStore.getState().getReserveById(draft.id)).toBeDefined();
    expect(notify.error).toHaveBeenCalledWith("Couldn't discard this draft", { reference: '7F3K2Q' });
    expect(document.body.textContent).not.toContain('database password leaked');
  });

  function findButton(text: string, index: number) {
    return Array.from(document.querySelectorAll('button'))
      .filter((button) => button.textContent?.trim() === text)[index];
  }
});
