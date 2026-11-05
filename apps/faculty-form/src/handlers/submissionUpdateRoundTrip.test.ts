import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseItem, CourseReserve } from '@/store/courseReservesStore';
import type { OrganizedContent } from '@/utils/contentSearch';
import { mapSubmissionDetailItem, type BackendSubmission } from '@/store/reserve/submissionMapping';
import { createSubmissionHandlers } from './submissionHandlers';

vi.mock('@/services/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/notify')>();
  return { ...actual, notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } };
});

vi.mock('@/config/endpoints', () => ({
  API_ENDPOINTS: {
    COURSE_RESERVES: {
      BASE_URL: 'https://api.test',
      FACULTY_SUBMISSION_UPDATE: '/faculty-submission/:uuid',
    },
  },
  DEFAULT_CONFIG: {},
}));

describe('submitted update payload round-trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('keeps every untouched backend field for folder and root items after an unrelated edit', async () => {
    const submission = buildBackendSubmission();
    const loaded = mapSubmissionDetailItem(submission);
    const editedReserve: CourseReserve = {
      ...loaded,
      items: loaded.items.map((item) => item.backendItemId === '5202'
        ? { ...item, status: 'complete' }
        : item),
    };
    const update = await submitAndReadUpdate(editedReserve);

    expect(editedReserve.items.find((item) => item.backendItemId === '5202')?.status).toBe('complete');
    expect(update).toEqual({
      submission_notes: 'Keep both course items current.',
      needed_by_date: '2026-12-01',
      folders: [{ folder_uuid: '701', folder_name: 'Week 1', display_order: 0 }],
      items: [
        {
          item_uuid: '5201',
          display_order: 0,
          folder_uuid: '701',
          position_in_folder: 0,
          material_type: 'book',
          title: 'Climate Systems',
          author: 'A. Example',
          journal: 'Journal of Climate Tests',
          publisher: 'Field Press',
          isbn: '9780000000000',
          url: 'https://example.test/climate',
          display_start_date: '2026-09-01',
          display_end_date: '2026-12-15',
          faculty_notes: 'Assign the opening chapter.',
          call_number: 'QC 903 .C55',
          barcode: 'BC5201',
        },
        {
          item_uuid: '5202',
          display_order: 1,
          folder_uuid: null,
          position_in_folder: null,
          material_type: 'article',
          title: 'Rainfall Patterns',
          author: 'B. Example',
          journal: 'Synthetic Weather Review',
          publisher: 'Research House',
          isbn: '9781111111111',
          url: 'https://example.test/rainfall',
          display_start_date: '2026-09-08',
          display_end_date: '2026-10-01',
          faculty_notes: 'Read before the seminar.',
          call_number: 'QC 990 .R21',
          barcode: 'BC5202',
        },
      ],
    });
  });

  it('serializes genuinely empty item fields as empty values, not sentinel strings', async () => {
    const submission = buildBackendSubmission({ emptyItem: true });
    const loaded = mapSubmissionDetailItem(submission);
    const update = await submitAndReadUpdate(loaded);

    expect(update.items).toEqual([{
      item_uuid: '5202',
      display_order: 0,
      folder_uuid: null,
      position_in_folder: null,
      material_type: 'book',
      title: 'Empty metadata item',
      author: null,
      journal: null,
      publisher: null,
      isbn: null,
      url: null,
      display_start_date: null,
      display_end_date: null,
      faculty_notes: null,
      call_number: null,
      barcode: null,
    }]);
    expect(JSON.stringify(update.items[0])).not.toContain('"undefined"');
    expect(JSON.stringify(update.items[0])).not.toContain('"null"');
  });
});

async function submitAndReadUpdate(reserve: CourseReserve) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  });
  vi.stubGlobal('fetch', fetchMock);

  const handlers = createSubmissionHandlers(vi.fn(), reserve, organizeReserve(reserve), vi.fn());
  handlers.confirmSubmit(false);
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

  const [url, request] = fetchMock.mock.calls[0];
  expect(url).toBe(`https://api.test/faculty-submission/${reserve.id}`);
  expect((request as RequestInit).method).toBe('PUT');
  return JSON.parse(String((request as RequestInit).body));
}

function organizeReserve(reserve: CourseReserve): OrganizedContent {
  const itemsById = new Map(reserve.items.map((item) => [item.id, item]));
  const folders = reserve.folders.map((folder) => ({
    ...folder,
    items: folder.itemIds.map((itemId) => itemsById.get(itemId))
      .filter((item): item is CourseItem => item !== undefined),
  }));
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));

  return {
    folders,
    ungroupedItems: reserve.items.filter((item) => !item.folderId),
    mixedContent: reserve.layout.map((entry, position) => entry.kind === 'folder'
      ? { type: 'folder', folder: foldersById.get(entry.id)!, position }
      : { type: 'item', item: itemsById.get(entry.id)!, position }),
  };
}

function buildBackendSubmission(options: { emptyItem?: boolean } = {}): BackendSubmission {
  const folderItem = makeBackendMaterial({
    id: 5201,
    title: 'Climate Systems',
    authors: 'A. Example',
    material_type: 'book',
    status: 'pending',
    display_order: 0,
    position_in_folder: 0,
    barcode: 'BC5201',
    call_number: 'QC 903 .C55',
    faculty_notes: 'Assign the opening chapter.',
    resource_data: {
      journalTitle: 'Journal of Climate Tests',
      publisher: 'Field Press',
      isbn: '9780000000000',
      url: 'https://example.test/climate',
      displayStartDate: '2026-09-01',
      displayEndDate: '2026-12-15',
    },
  });
  const rootItem = options.emptyItem
    ? makeBackendMaterial({
      id: 5202,
      title: 'Empty metadata item',
      authors: '',
      material_type: 'book',
      status: 'pending',
      display_order: 0,
      barcode: '',
      call_number: '',
      faculty_notes: '',
      resource_data: {
        journalTitle: '',
        publisher: '',
        isbn: '',
        url: '',
        displayStartDate: '',
        displayEndDate: '',
      },
    })
    : makeBackendMaterial({
      id: 5202,
      title: 'Rainfall Patterns',
      authors: 'B. Example',
      material_type: 'article',
      status: 'pending',
      display_order: 1,
      barcode: 'BC5202',
      call_number: 'QC 990 .R21',
      faculty_notes: 'Read before the seminar.',
      resource_data: {
        journalTitle: 'Synthetic Weather Review',
        publisher: 'Research House',
        isbn: '9781111111111',
        url: 'https://example.test/rainfall',
        displayStartDate: '2026-09-08',
        displayEndDate: '2026-10-01',
      },
    });

  return {
    submission_uuid: 'submission-ff055',
    course_code: 'BIO 220',
    course_title: 'Ecology',
    faculty_display_name: 'Test Faculty',
    term_code: '2026FA',
    status: 'submitted',
    updated_at: '2026-08-01T12:00:00Z',
    submission_notes: 'Keep both course items current.',
    needed_by_date: '2026-12-01',
    folders: options.emptyItem ? [] : [{
      id: 701,
      name: 'Week 1',
      display_order: 0,
      items: [folderItem],
    }],
    unfoldered_items: [rootItem],
  } as unknown as BackendSubmission;
}

function makeBackendMaterial(material: Record<string, unknown>) {
  return material;
}
