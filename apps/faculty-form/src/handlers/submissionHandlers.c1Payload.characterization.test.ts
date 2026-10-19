import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('C1 submission payload characterization', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, submission: { submission_uuid: 'c1-submission' } }),
    }));
    vi.resetModules();
    vi.setSystemTime(new Date('2026-06-25T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('builds the current C1 create payload from the reserve held in Zustand', async () => {
    const { useReserveStore } = await import('@/store/useReserveStore');
    const { useAuthStore } = await import('@/store/authStore');
    const { createSubmissionHandlers } = await import('./submissionHandlers');
    const item = {
      id: 'c1-reuse-item',
      title: 'Synthetic Course Book',
      authors: 'Synthetic Author',
      materialType: 'book' as const,
      status: 'draft' as const,
      isbn: '9780000000000',
      publisher: 'Synthetic Press',
      publicationYear: '2024',
      notes: 'Use chapter 2',
      displayStartDate: '2026-09-01',
      displayEndDate: '2026-12-15',
      barcode: 'BC-C1',
      callNumber: 'QA 76 .C1',
      holdingsId: 'holding-c1',
      instanceId: 'instance-c1',
      copiedItem: { barcode: 'BC-C1', effectiveCallNumberComponents: { callNumber: 'QA 76 .C1' } },
    };
    const reserve = {
      id: 'reserve-c1',
      courseCode: 'BIO 220',
      courseTitle: 'Synthetic Ecology',
      section: '01',
      instructors: 'Faculty One',
      term: '2026FA',
      status: 'draft' as const,
      lastUpdated: 'Jun 20, 2026',
      items: [item],
      folders: [],
      layout: [{ kind: 'item' as const, id: item.id }],
    };
    useReserveStore.setState({ reserves: [reserve] });
    useAuthStore.setState({ user: null, isAuthenticated: false });
    const storedReserve = useReserveStore.getState().getReserveById('reserve-c1')!;
    const navigate = vi.fn();
    const handlers = createSubmissionHandlers(
      navigate,
      storedReserve,
      {
        folders: [],
        ungroupedItems: storedReserve.items,
        mixedContent: [{ type: 'item', item: storedReserve.items[0], position: 0 }],
      },
      vi.fn()
    );

    handlers.confirmSubmit(true);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const payload = JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body));

    expect(payload).toEqual({
      reserveId: 'reserve-c1',
      courseInfo: {
        courseCode: 'BIO 220', courseTitle: 'Synthetic Ecology', section: '01',
        instructors: 'Faculty One', term: '2026FA', status: 'draft', lastUpdated: 'Jun 20, 2026',
      },
      items: [item],
      resources: [{
        is_reuse: true,
        source_barcode: 'BC-C1',
        source_call_number: 'QA 76 .C1',
        source_resource_id: 'holding-c1',
        source_folio_instance_id: 'instance-c1',
        display_order: 0,
        folder_name: null,
        faculty_notes: 'Use chapter 2',
        priority: 'medium',
        resource_data: {
          id: 'c1-reuse-item', title: 'Synthetic Course Book', authors: 'Synthetic Author',
          materialType: 'book', status: 'draft', isbn: '9780000000000',
          publisher: 'Synthetic Press', publicationYear: '2024', notes: 'Use chapter 2',
          displayStartDate: '2026-09-01', displayEndDate: '2026-12-15',
          barcode: 'BC-C1', callNumber: 'QA 76 .C1', holdingsId: 'holding-c1',
          instanceId: 'instance-c1', copiedItem: item.copiedItem,
        },
        position_in_folder: null,
      }],
      folders: [],
      displayOrder: [{ type: 'item', id: 'c1-reuse-item', displayPosition: 0 }],
      metadata: {
        totalItems: 1, totalFolders: 0, itemsInFolders: 0, ungroupedItems: 1,
        reuseItems: 1, newItems: 0, submittedAt: '2026-06-25T12:00:00.000Z',
        emailConfirmation: true, submittedBy: null,
      },
    });
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
