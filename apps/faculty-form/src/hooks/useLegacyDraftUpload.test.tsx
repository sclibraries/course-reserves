import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseReserve } from '@/store/courseReservesStore';

const api = vi.hoisted(() => ({
  createDraft: vi.fn(),
  getDraft: vi.fn(),
}));

vi.mock('@/services/api/facultyDraftApi', () => api);
vi.mock('@/services/notify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

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

import { useLegacyDraftUpload } from './useLegacyDraftUpload';
import { useReserveStore } from '@/store/useReserveStore';
import { useDraftStore } from '@/store/draftStore';
import { notify } from '@/services/notify';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const localDraft: CourseReserve = {
  id: 'reserve-legacy-upload',
  courseCode: 'BIO 101',
  courseTitle: 'Synthetic Biology',
  section: '01',
  instructors: 'Test Faculty',
  term: '2027SP',
  status: 'draft',
  items: [{ id: 'item-local', title: 'Old browser item', materialType: 'book', status: 'draft' }],
  folders: [],
  layout: [{ kind: 'item', id: 'item-local' }],
  lastUpdated: 'Oct 20, 2026',
  courseAssignmentId: 'BIO-101-01-202702',
  academicPeriod: 'AP_202702',
};

function Harness({ onFound }: { onFound?: (uuid: string) => void }) {
  useLegacyDraftUpload(true, onFound);
  return null;
}

describe('useLegacyDraftUpload', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }));
    useDraftStore.getState().clearAllDrafts();
    useReserveStore.setState({ reserves: [{ ...localDraft }] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useReserveStore.setState({ reserves: [] });
    useDraftStore.getState().clearAllDrafts();
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  it('uploads an old local list once and records the returned server identity', async () => {
    api.createDraft.mockResolvedValue({ submission_uuid: 'server-draft-1', status: 'draft', draft_version: 1 });

    await vi.waitFor(() => {
      expect(api.createDraft).toHaveBeenCalledTimes(1);
      expect(useReserveStore.getState().getReserveById('reserve-legacy-upload')).toMatchObject({
        submissionUuid: 'server-draft-1', draftVersion: 1,
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(api.createDraft).toHaveBeenCalledTimes(1);
    expect((api.createDraft.mock.calls[0][0] as Record<string, unknown>).items).toEqual(localDraft.items);
  });

  it('keeps the server copy and tells the user once when the upload finds an existing draft', async () => {
    act(() => useReserveStore.setState({ reserves: [{ ...localDraft, id: 'reserve-legacy-existing' }] }));
    const serverReserve: CourseReserve = {
      ...localDraft,
      id: 'server-draft-1',
      submissionUuid: 'server-draft-1',
      draftVersion: 4,
      items: [{ id: 'server-item', title: 'Server item', materialType: 'article', status: 'draft' }],
    };
    api.createDraft.mockResolvedValue({
      submission_uuid: 'server-draft-1', status: 'draft', draft_version: 4, existing: true,
    });
    api.getDraft.mockResolvedValue(serverReserve);

    await vi.waitFor(() => {
      expect(useReserveStore.getState().reserves).toEqual([expect.objectContaining({
        id: 'server-draft-1', items: [{ id: 'server-item', title: 'Server item', materialType: 'article', status: 'draft' }],
      })]);
    });

    expect(api.createDraft).toHaveBeenCalledTimes(1);
    expect(notify.info).toHaveBeenCalledTimes(1);
    expect(notify.info).toHaveBeenCalledWith('The existing server list was kept for this course.', { duration: Infinity });
  });

  it('drops a matching local copy already present in the server index and redirects to its UUID', async () => {
    const localId = 'reserve-legacy-match';
    const onFound = vi.fn();
    act(() => useReserveStore.setState({ reserves: [{ ...localDraft, id: localId }] }));
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{
        submission_uuid: 'server-draft-match',
        its_course_id: localDraft.courseAssignmentId,
        academic_period: localDraft.academicPeriod,
        course_code: 'BIO 101',
        course_title: 'Synthetic Biology',
        section: '01',
        faculty_display_name: 'Test Faculty',
        term_code: '2027SP',
        status: 'draft',
        draft_version: 3,
        updated_at: '2026-10-20T12:00:00Z',
        folders: [],
        unfoldered_items: [],
      }] }),
    } as Response);
    act(() => root.render(<Harness onFound={onFound} />));

    await vi.waitFor(() => expect(onFound).toHaveBeenCalledWith('server-draft-match'));

    expect(api.createDraft).not.toHaveBeenCalled();
    expect(useReserveStore.getState().getReserveById(localId)).toBeUndefined();
    expect(useReserveStore.getState().getReserveById('server-draft-match')?.status).toBe('draft');
  });
});

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
