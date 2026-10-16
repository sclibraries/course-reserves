import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/config/endpoints', () => ({
  API_ENDPOINTS: {
    COURSE_RESERVES: {
      BASE_URL: 'https://api.test',
      FACULTY_SUBMISSION_SUBMIT_COMPLETE: '/faculty-submission/submit-complete',
      FACULTY_SUBMISSION_UPDATE: '/faculty-submission/:uuid',
    },
  },
  DEFAULT_CONFIG: {},
}));

describe('createSubmissionHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    vi.stubGlobal('fetch', vi.fn());
  });

  it('clears the local draft after a successful new submission', async () => {
    const { createSubmissionHandlers } = await import('./submissionHandlers');
    const { useDraftStore } = await import('@/store/draftStore');
    const reserve = buildReserve();
    const navigate = vi.fn();

    useDraftStore.getState().setDraft(reserve.id, {
      uuid: reserve.id,
      courseCode: reserve.courseCode,
      courseTitle: reserve.courseTitle,
      section: reserve.section,
      instructors: reserve.instructors,
      term: reserve.term,
      items: [],
      folders: [],
      isDraft: true,
      lastSavedAt: '2026-06-17T12:00:00.000Z',
      draftVersion: 1,
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        submission: {
          submission_uuid: 'submitted-uuid',
        },
      }),
    } as Response);

    const handlers = createSubmissionHandlers(
      navigate,
      reserve,
      {
        folders: [],
        ungroupedItems: reserve.items,
        mixedContent: reserve.items.map((item, position) => ({
          type: 'item' as const,
          item,
          position,
        })),
      },
      vi.fn()
    );

    handlers.confirmSubmit(false);

    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/submission/submitted-uuid?refresh=true');
    });

    expect(useDraftStore.getState().getDraft(reserve.id)).toBeUndefined();
  });

  it('keeps the editor open and shows backend validation messages when submission fails', async () => {
    const { createSubmissionHandlers } = await import('./submissionHandlers');
    const { toast } = await import('sonner');
    const reserve = buildReserve();
    const navigate = vi.fn();

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({
        message: 'Resource 0 is missing required title',
      }),
    } as Response);

    const handlers = createSubmissionHandlers(
      navigate,
      reserve,
      {
        folders: [],
        ungroupedItems: reserve.items,
        mixedContent: reserve.items.map((item, position) => ({
          type: 'item' as const,
          item,
          position,
        })),
      },
      vi.fn()
    );

    handlers.confirmSubmit(false);

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Submission failed: Resource 0 is missing required title'
      );
    });

    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    [422, 'roster_course_required'],
    [403, 'roster_course_not_found'],
  ])('shows the roster guidance for %s %s responses', async (status, errorCode) => {
    const { createSubmissionHandlers } = await import('./submissionHandlers');
    const { toast } = await import('sonner');
    const reserve = buildReserve();

    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error_code: errorCode }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }));

    const handlers = createSubmissionHandlers(vi.fn(), reserve, {
      folders: [],
      ungroupedItems: reserve.items,
      mixedContent: reserve.items.map((item, position) => ({ type: 'item' as const, item, position })),
    }, vi.fn());

    handlers.confirmSubmit(false);

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Submission failed: This course isn't on your teaching roster for that term - contact the library"
      );
    });
  });

  it('keeps an unrelated 409 on the existing generic error path', async () => {
    const { createSubmissionHandlers } = await import('./submissionHandlers');
    const { toast } = await import('sonner');
    const { useEditorUIStore } = await import('@/store/useEditorUIStore');
    const { reserve, organizedContent } = buildPayloadContractScenario('submitted');
    useEditorUIStore.getState().closeCorrectionRequiredDialog();
    const navigate = vi.fn();

    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error_code: 'submission_conflict',
      message: 'This submission changed elsewhere.',
    }), { status: 409, headers: { 'Content-Type': 'application/json' } }));

    const handlers = createSubmissionHandlers(navigate, reserve, organizedContent, vi.fn());
    handlers.confirmSubmit(false);

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Submission failed: This submission changed elsewhere.');
    });
    expect(useEditorUIStore.getState().correctionRequiredDialogOpen).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('blocks invalid reserve data before sending a submission request', async () => {
    const { createSubmissionHandlers } = await import('./submissionHandlers');
    const { toast } = await import('sonner');
    const reserve = {
      ...buildReserve(),
      items: [
        {
          id: 'item-1',
          title: '',
          materialType: 'book' as const,
          status: 'draft' as const,
        },
      ],
    };
    const navigate = vi.fn();

    const handlers = createSubmissionHandlers(
      navigate,
      reserve,
      {
        folders: [],
        ungroupedItems: reserve.items,
        mixedContent: reserve.items.map((item, position) => ({
          type: 'item' as const,
          item,
          position,
        })),
      },
      vi.fn()
    );

    handlers.confirmSubmit(false);

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Submission failed: Item 1: Item title is required.');
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('builds the create payload contract for reuse and manual items', async () => {
    const { createSubmissionHandlers } = await import('./submissionHandlers');
    const { useAuthStore } = await import('@/store/authStore');
    const navigate = vi.fn();
    const { reserve, organizedContent } = buildPayloadContractScenario('draft');

    useAuthStore.setState({
      user: {
        iat: 1,
        exp: 2,
        id: 'faculty-1',
        username: 'faculty1',
        full_name: 'Faculty One',
        email: 'faculty1@example.test',
        role: 'faculty',
        institution: 'SM',
      },
      isAuthenticated: true,
    });

    vi.mocked(fetch).mockResolvedValue(successfulSubmissionResponse('created-uuid'));

    const handlers = createSubmissionHandlers(navigate, reserve, organizedContent, vi.fn());

    handlers.confirmSubmit(true);

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/submission/created-uuid?refresh=true');
    });

    const [url, request] = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse(String((request as RequestInit).body));

    expect(url).toBe('https://api.test/faculty-submission/submit-complete');
    expect((request as RequestInit).method).toBe('POST');
    expect(payload.courseInfo).toMatchObject({
      courseCode: 'BIO 220',
      courseTitle: 'Ecology',
      term: '2026FA',
    });
    expect(payload).toMatchObject({
      its_course_id: 'BIO-220-01-202701',
      academic_period: 'AP_202701',
    });
    expect(payload.displayOrder).toEqual([
      { type: 'folder', id: 'folder-week-1', displayPosition: 0 },
      { type: 'item', id: 'manual-article', displayPosition: 1 },
    ]);
    expect(payload.folders).toEqual([
      expect.objectContaining({
        id: 'folder-week-1',
        backendFolderId: 'backend-folder-1',
        title: 'Week 1',
        position: 0,
      }),
    ]);
    expect(payload.resources).toHaveLength(2);
    expect(payload.resources[0]).toMatchObject({
      is_reuse: true,
      source_barcode: 'BC123',
      source_call_number: 'QC 903 .C55',
      source_resource_id: 'holdings-1',
      source_folio_instance_id: 'instance-1',
      display_order: 0,
      folder_name: 'Week 1',
      position_in_folder: 0,
      faculty_notes: 'Use chapter 1',
      resource_data: {
        id: 'reuse-book',
        title: 'Climate Book',
        authors: 'Reuse Author',
        materialType: 'book',
        isbn: '9780000000000',
        displayStartDate: '2026-09-01',
        displayEndDate: '2026-12-15',
        barcode: 'BC123',
        callNumber: 'QC 903 .C55',
        instanceId: 'instance-1',
        holdingsId: 'holdings-1',
        copiedItem: {
          barcode: 'BC123',
          effectiveCallNumberComponents: {
            callNumber: 'QC 903 .C55',
          },
        },
      },
    });
    expect(payload.resources[1]).toMatchObject({
      is_reuse: false,
      display_order: 1,
      folder_name: null,
      position_in_folder: null,
      resource_data: {
        id: 'manual-article',
        title: 'Manual Article',
        materialType: 'article',
        doi: '10.1000/example',
        url: 'https://example.test/article',
        displayStartDate: '2026-09-08',
        displayEndDate: '2026-10-01',
      },
    });
    expect(payload.items[0]).toMatchObject({
      id: 'reuse-book',
      hasAttachment: true,
      attachmentName: 'legacy-scan.pdf',
      attachmentSize: 4096,
      attachmentType: 'application/pdf',
    });
    expect(JSON.stringify(payload)).not.toMatch(/attachment file|file delivered|files delivered/i);
    expect(payload.metadata).toMatchObject({
      totalItems: 2,
      totalFolders: 1,
      itemsInFolders: 1,
      ungroupedItems: 1,
      reuseItems: 1,
      newItems: 1,
      emailConfirmation: true,
      submittedBy: {
        id: 'faculty-1',
        username: 'faculty1',
        fullName: 'Faculty One',
      },
    });
  });

  it('builds the update payload contract with backend IDs and display dates', async () => {
    const { createSubmissionHandlers } = await import('./submissionHandlers');
    const navigate = vi.fn();
    const { reserve, organizedContent } = buildPayloadContractScenario('submitted');

    vi.mocked(fetch).mockResolvedValue(successfulSubmissionResponse('ignored-for-update'));

    const handlers = createSubmissionHandlers(navigate, reserve, organizedContent, vi.fn());

    handlers.confirmSubmit(false);

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    const [url, request] = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse(String((request as RequestInit).body));

    expect(url).toBe('https://api.test/faculty-submission/reserve-1');
    expect((request as RequestInit).method).toBe('PUT');
    expect(payload.folders).toEqual([
      {
        folder_uuid: 'backend-folder-1',
        folder_name: 'Week 1',
        display_order: 0,
      },
    ]);
    expect(payload.items).toEqual([
      expect.objectContaining({
        item_uuid: 'backend-reuse-1',
        display_order: 0,
        folder_uuid: 'backend-folder-1',
        position_in_folder: 0,
        material_type: 'book',
        title: 'Climate Book',
        author: 'Reuse Author',
        isbn: '9780000000000',
        call_number: 'QC 903 .C55',
        barcode: 'BC123',
        display_start_date: '2026-09-01',
        display_end_date: '2026-12-15',
      }),
      expect.objectContaining({
        item_uuid: 'backend-manual-1',
        display_order: 1,
        folder_uuid: null,
        position_in_folder: null,
        material_type: 'article',
        title: 'Manual Article',
        journal: 'Journal of Tests',
        url: 'https://example.test/article',
        display_start_date: '2026-09-08',
        display_end_date: '2026-10-01',
      }),
    ]);
  });

  it.each(['normal', 'clone'] as const)('adds acting_for_faculty_id to a new %s submission only at the top level', async (flow) => {
    const { createSubmissionHandlers } = await import('./submissionHandlers');
    const { useActingForStore } = await import('@/store/actingForStore');
    const { useAuthStore } = await import('@/store/authStore');
    const { reserve, organizedContent } = buildPayloadContractScenario('draft');
    useActingForStore.getState().selectFaculty({ username: 'test-faculty', displayName: 'Test Faculty' });
    useAuthStore.setState({
      user: {
        iat: 1,
        exp: 2,
        id: 'faculty-1',
        username: 'faculty1',
        full_name: 'Faculty One',
        email: 'faculty1@example.test',
        role: 'faculty',
        institution: 'SM',
      },
      isAuthenticated: true,
    });
    vi.mocked(fetch).mockResolvedValue(successfulSubmissionResponse('created-uuid'));

    const handlers = createSubmissionHandlers(vi.fn(), reserve, organizedContent, vi.fn());
    if (flow === 'normal') handlers.confirmSubmit(false);
    else handlers.confirmDuplicateSubmit(false);

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [, request] = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse(String((request as RequestInit).body));

    expect(payload.acting_for_faculty_id).toBe('test-faculty');
    expect(payload.its_course_id).toBe('BIO-220-01-202701');
    expect(payload.academic_period).toBe('AP_202701');
    expect(payload.metadata.submittedBy.username).toBe('faculty1');
    expect(payload.metadata).not.toHaveProperty('acting_for_faculty_id');
  });
});

function makeLocalStorageMock() {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
}

function buildReserve() {
  return {
    id: 'reserve-1',
    courseCode: 'ENG 101',
    courseTitle: 'Intro to Literature',
    section: '01',
    instructors: 'Prof. Example',
    term: '2026SP',
    status: 'draft' as const,
    lastUpdated: '2026-06-17T12:00:00.000Z',
    folders: [],
    items: [
      {
        id: 'item-1',
        title: 'Example Book',
        materialType: 'book' as const,
        status: 'draft' as const,
      },
    ],
  };
}

function successfulSubmissionResponse(submissionUuid: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      submission: {
        submission_uuid: submissionUuid,
      },
    }),
  } as Response;
}

function buildPayloadContractScenario(status: 'draft' | 'submitted') {
  const reuseItem = {
    id: 'reuse-book',
    backendItemId: 'backend-reuse-1',
    title: 'Climate Book',
    authors: 'Reuse Author',
    isbn: '9780000000000',
    materialType: 'book' as const,
    status: 'needs-review' as const,
    notes: 'Use chapter 1',
    folderId: 'folder-week-1',
    displayStartDate: '2026-09-01',
    displayEndDate: '2026-12-15',
    hasAttachment: true,
    attachmentName: 'legacy-scan.pdf',
    attachmentSize: 4096,
    attachmentType: 'application/pdf',
    barcode: 'BC123',
    callNumber: 'QC 903 .C55',
    holdingsId: 'holdings-1',
    instanceId: 'instance-1',
    instanceHrid: 'hrid-1',
    copiedItem: {
      barcode: 'BC123',
      effectiveCallNumberComponents: {
        callNumber: 'QC 903 .C55',
      },
    },
  };
  const manualItem = {
    id: 'manual-article',
    backendItemId: 'backend-manual-1',
    title: 'Manual Article',
    authors: 'Manual Author',
    materialType: 'article' as const,
    status: 'draft' as const,
    journalTitle: 'Journal of Tests',
    doi: '10.1000/example',
    url: 'https://example.test/article',
    displayStartDate: '2026-09-08',
    displayEndDate: '2026-10-01',
  };
  const folder = {
    id: 'folder-week-1',
    backendFolderId: 'backend-folder-1',
    title: 'Week 1',
    description: 'Opening week',
    isOpen: true,
    items: [reuseItem],
  };
  const reserve = {
    id: 'reserve-1',
    courseCode: 'BIO 220',
    courseTitle: 'Ecology',
    section: '01',
    instructors: 'Faculty One',
    term: '2026FA',
    status,
    lastUpdated: '2026-06-24T12:00:00.000Z',
    submissionNotes: 'Please process quickly',
    neededByDate: '2026-08-20',
    courseAssignmentId: 'BIO-220-01-202701',
    academicPeriod: 'AP_202701',
    items: [reuseItem, manualItem],
    folders: [folder],
  };

  return {
    reserve,
    organizedContent: {
      folders: [folder],
      ungroupedItems: [manualItem],
      mixedContent: [
        {
          type: 'folder' as const,
          folder,
          position: 0,
        },
        {
          type: 'item' as const,
          item: manualItem,
          position: 1,
        },
      ],
    },
  };
}
