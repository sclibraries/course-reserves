import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseItem, CourseReserve, FolioCopiedItem, FolioLocation } from '@/store/reserve/types';
import type { BackendSubmission } from '@/store/reserve/submissionMapping';
import type { OrganizedContent } from '@/utils/contentSearch';
import { buildSubmissionPayload } from './submissionPayload';
import { createSubmissionHandlers } from './submissionHandlers';
import { mapSubmissionDetailItem, mapSubmissionIndexItem } from '@/store/reserve/submissionMapping';
import { useReserveStore } from '@/store/useReserveStore';
import { useDraftStore } from '@/store/draftStore';
import { useServerDraftSync } from '@/hooks/useServerDraftSync';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/services/apiClient', () => ({ default: api }));

vi.mock('@/services/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/notify')>();
  return { ...actual, notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } };
});

vi.mock('@/config/endpoints', () => ({
  API_ENDPOINTS: {
    COURSE_RESERVES: {
      BASE_URL: 'https://api.test',
      FACULTY_SUBMISSION_INDEX: '/faculty-submission/index',
      FACULTY_SUBMISSION_UPDATE: '/faculty-submission/:uuid',
    },
  },
  DEFAULT_CONFIG: {},
}));

vi.hoisted(() => {
  const values: Record<string, string> = {};
  // @ts-expect-error Vitest exposes vi while evaluating hoisted mocks.
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = String(value); },
    removeItem: (key: string) => { delete values[key]; },
    clear: () => { Object.keys(values).forEach((key) => delete values[key]); },
    key: (index: number) => Object.keys(values)[index] ?? null,
    get length() { return Object.keys(values).length; },
  });
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type ResourceData = Partial<CourseItem> & {
  journal?: string;
  libraryNotes?: string;
};

type BaseBackendItem = NonNullable<BackendSubmission['unfoldered_items']>[number];
type IndexItem = Omit<BaseBackendItem, 'resource_data'> & {
  is_reuse: boolean;
  assignedPages: string | null;
  resource_data: ResourceData;
};

type NewResourceRow = {
  id: string | number;
  material_type_id: number | null;
  resource_data: ResourceData | string | null;
  is_reuse: boolean;
  source_barcode: string | null;
  source_call_number: string | null;
  source_resource_id: string | null;
  source_folio_instance_id: string | null;
  barcode: string | null;
  call_number: string | null;
  item_status: string;
  display_order: number;
  position_in_folder: number | null;
  folder_name: string | null;
  faculty_notes: string | null;
  assigned_pages: string | null;
  priority: string;
  created_at: string;
  updated_at: string;
};

type IndexFolder = Omit<NonNullable<BackendSubmission['folders']>[number], 'items'> & {
  item_count: number;
  items: IndexItem[];
};

type IndexSubmission = Omit<BackendSubmission, 'folders' | 'unfoldered_items'> & {
  folders: IndexFolder[];
  unfoldered_items: IndexItem[];
  newResources: NewResourceRow[];
  reuseResources: NewResourceRow[];
};

interface ItemSpec {
  id: number;
  title: string;
  authors: string;
  materialType: CourseItem['materialType'];
  isReuse: boolean;
  folderName: string | null;
  displayOrder: number;
  positionInFolder: number | null;
  journalTitle?: string;
  journal?: string;
}

const specs: ItemSpec[] = [
  { id: 601, title: 'Climate Systems', authors: 'A. Example', materialType: 'book', isReuse: false, folderName: 'Week 1', displayOrder: 0, positionInFolder: 2, journalTitle: 'Canonical Journal', journal: 'Stale Journal' },
  { id: 602, title: 'Rainfall Patterns', authors: 'B. Example', materialType: 'article', isReuse: true, folderName: 'Week 1', displayOrder: 1, positionInFolder: 0, journal: 'Alias Journal' },
  { id: 603, title: 'Ocean Currents', authors: 'C. Example', materialType: 'chapter', isReuse: false, folderName: 'Week 1', displayOrder: 2, positionInFolder: 1, journalTitle: '', journal: 'Stale Empty Alias' },
  { id: 604, title: 'Coastal Survey', authors: 'D. Example', materialType: 'video', isReuse: true, folderName: null, displayOrder: 3, positionInFolder: null, journalTitle: 'Coastal Media Journal' },
  { id: 605, title: 'Weather Models', authors: 'E. Example', materialType: 'website', isReuse: false, folderName: null, displayOrder: 4, positionInFolder: null, journalTitle: 'Weather Journal' },
];

const location = (id: string, name: string, code: string): FolioLocation => ({ id, name, code });
const temporaryLocation = location('temporary-1', 'Temporary', 'TEMP');
const permanentLocation = location('permanent-1', 'Permanent', 'PERM');

function resourceData(spec: ItemSpec): ResourceData {
  const resourceId = String(spec.id);
  const barcode = `BC${resourceId}`;
  const callNumber = `QA ${resourceId} .T1`;
  const copy: FolioCopiedItem = {
    title: spec.title,
    barcode,
    callNumber,
    copy: '1',
    instanceId: `folio-instance-${resourceId}`,
    holdingsId: `folio-holdings-${resourceId}`,
    temporaryLocationId: temporaryLocation.id,
    temporaryLocationObject: temporaryLocation,
    permanentLocationId: permanentLocation.id,
    permanentLocationObject: permanentLocation,
  };

  return {
    title: spec.title,
    authors: spec.authors,
    materialType: spec.materialType,
    status: 'pending',
    isbn: `9780000000${resourceId}`,
    publisher: `Publisher ${resourceId}`,
    publicationYear: '2024',
    edition: '2nd edition',
    pages: '17-20',
    chapterTitle: `Chapter ${resourceId}`,
    copy: '1',
    ...(spec.journalTitle !== undefined ? { journalTitle: spec.journalTitle } : {}),
    ...(spec.journal !== undefined ? { journal: spec.journal } : {}),
    volume: '12',
    issue: '3',
    notes: `Resource data note ${resourceId}`,
    doi: `10.1000/synthetic-${resourceId}`,
    issn: '1234-5678',
    url: `https://example.test/item/${resourceId}`,
    displayStartDate: '2026-09-01',
    displayEndDate: '2026-12-15',
    barcode,
    callNumber,
    ...(!spec.isReuse ? {
      instanceId: `folio-instance-${resourceId}`,
      holdingsId: `folio-holdings-${resourceId}`,
    } : {}),
    instanceHrid: `in000${resourceId}`,
    temporaryLocationId: temporaryLocation.id,
    temporaryLocationObject: temporaryLocation,
    permanentLocationId: permanentLocation.id,
    permanentLocationObject: permanentLocation,
    copiedItem: copy,
    libraryNotes: `Internal library note ${resourceId}`,
  };
}

function indexItem(spec: ItemSpec): IndexItem {
  const data = resourceData(spec);
  return {
    id: spec.id,
    title: spec.title,
    authors: spec.authors,
    material_type: spec.materialType,
    is_reuse: spec.isReuse,
    barcode: `BC${spec.id}`,
    call_number: `QA ${spec.id} .T1`,
    status: 'pending',
    display_order: spec.displayOrder,
    folder_name: spec.folderName,
    resource_data: data,
    assignedPages: '17-20',
  };
}

function newResourceRow(spec: ItemSpec): NewResourceRow {
  const barcode = `BC${spec.id}`;
  const callNumber = `QA ${spec.id} .T1`;
  return {
    id: spec.id,
    material_type_id: 1,
    resource_data: resourceData(spec),
    is_reuse: spec.isReuse,
    source_barcode: spec.isReuse ? barcode : null,
    source_call_number: spec.isReuse ? callNumber : null,
    source_resource_id: spec.isReuse ? `folio-holdings-${spec.id}` : null,
    source_folio_instance_id: spec.isReuse ? `folio-instance-${spec.id}` : null,
    barcode,
    call_number: callNumber,
    item_status: 'pending',
    display_order: spec.displayOrder,
    position_in_folder: spec.positionInFolder,
    folder_name: spec.folderName,
    faculty_notes: `Faculty note ${spec.id}`,
    assigned_pages: '17-20',
    priority: 'medium',
    created_at: '2026-08-01T12:00:00Z',
    updated_at: '2026-08-01T12:00:00Z',
  };
}

function backendSubmission(status: 'draft' | 'submitted' = 'draft'): IndexSubmission {
  const rows = specs.map(indexItem);
  const folderItems = rows.filter((item) => item.folder_name === 'Week 1');
  const unfolderedItems = rows.filter((item) => item.folder_name === null);

  return {
    submission_uuid: 'submission-ff055',
    course_code: 'BIO 220',
    course_title: 'Ecology',
    section: '01',
    faculty_display_name: 'Test Faculty',
    term_code: '2026FA',
    status,
    updated_at: '2026-08-01T12:00:00Z',
    draft_version: 4,
    submission_notes: 'Faculty submission note',
    needed_by_date: '2026-12-01',
    folders: [{ id: 701, name: 'Week 1', display_order: 0, item_count: 3, items: folderItems }],
    unfoldered_items: unfolderedItems,
    newResources: specs.map(newResourceRow),
    reuseResources: [],
  };
}

function expectedDraftResource(spec: ItemSpec) {
  return {
    publicationYear: '2024',
    edition: '2nd edition',
    pages: '17-20',
    chapterTitle: `Chapter ${spec.id}`,
    copy: '1',
    instanceId: `folio-instance-${spec.id}`,
    instanceHrid: `in000${spec.id}`,
    holdingsId: `folio-holdings-${spec.id}`,
    temporaryLocationId: 'temporary-1',
    temporaryLocationObject: temporaryLocation,
    permanentLocationId: 'permanent-1',
    permanentLocationObject: permanentLocation,
    copiedItem: {
      title: spec.title,
      barcode: `BC${spec.id}`,
      callNumber: `QA ${spec.id} .T1`,
      copy: '1',
      instanceId: `folio-instance-${spec.id}`,
      holdingsId: `folio-holdings-${spec.id}`,
      temporaryLocationId: 'temporary-1',
      temporaryLocationObject: temporaryLocation,
      permanentLocationId: 'permanent-1',
      permanentLocationObject: permanentLocation,
    },
  };
}

function organizedContent(reserve: CourseReserve): OrganizedContent {
  const items = new Map(reserve.items.map((item) => [item.id, item]));
  const folders = reserve.folders.map((folder) => ({
    ...folder,
    items: folder.itemIds.map((id) => items.get(id)).filter((item): item is CourseItem => !!item),
  }));
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));

  return {
    folders,
    ungroupedItems: reserve.items.filter((item) => !item.folderId),
    mixedContent: reserve.layout.map((entry, position) => entry.kind === 'folder'
      ? { type: 'folder', folder: foldersById.get(entry.id)!, position }
      : { type: 'item', item: items.get(entry.id)!, position }),
  };
}

function DraftReplacementHarness({
  onReady,
}: {
  onReady: (sync: ReturnType<typeof useServerDraftSync>) => void;
}) {
  const reserve = useReserveStore((state) => state.reserves.find((item) => item.id === 'reserve-local'));
  const sync = useServerDraftSync('reserve-local', reserve, { autoSaveEnabled: false });
  React.useEffect(() => onReady(sync), [onReady, sync]);
  return null;
}

describe('submitted item load and payload round-trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    useDraftStore.getState().clearAllDrafts();
    useReserveStore.setState({ reserves: [] });
  });

  afterEach(() => {
    useDraftStore.getState().clearAllDrafts();
    useReserveStore.setState({ reserves: [] });
  });

  it('replaces a server draft with complete faculty-safe items and keeps create payload fields', async () => {
    const submission = backendSubmission('draft');
    api.get.mockResolvedValue({ data: { items: [submission] } });
    const staleReserve: CourseReserve = {
      id: 'reserve-local',
      submissionUuid: submission.submission_uuid,
      draftVersion: 3,
      courseCode: 'BIO 220',
      courseTitle: 'Ecology',
      section: '01',
      instructors: 'Test Faculty',
      term: '2026FA',
      status: 'draft',
      items: [{ id: 'old-item', title: 'Stale local item', materialType: 'book', status: 'draft' }],
      folders: [],
      layout: [{ kind: 'item', id: 'old-item' }],
      lastUpdated: 'Aug 1, 2026',
    };
    useReserveStore.setState({ reserves: [staleReserve] });

    let sync: ReturnType<typeof useServerDraftSync> | undefined;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const captureSync = (value: ReturnType<typeof useServerDraftSync>) => { sync = value; };
    act(() => root.render(React.createElement(DraftReplacementHarness, { onReady: captureSync })));

    try {
      await act(async () => {
        if (!sync) throw new Error('Draft sync hook did not mount');
        expect(await sync.loadLatestVersion()).toBe(true);
      });

      expect(api.get).toHaveBeenCalledWith('https://api.test/faculty-submission/index');
      const replacement = useReserveStore.getState().getReserveById('reserve-local');
      if (!replacement) throw new Error('Draft replacement was not stored');
      expect(replacement.submissionNotes).toBe('Faculty submission note');
      expect(replacement.neededByDate).toBe('2026-12-01');
      expect.soft(replacement.items.find((item) => item.backendItemId === '601')?.journalTitle).toBe('Canonical Journal');
      expect.soft(replacement.items.find((item) => item.backendItemId === '602')?.journalTitle).toBe('Alias Journal');
      expect.soft(replacement.items.find((item) => item.backendItemId === '603')?.journalTitle).toBe('');

      for (const spec of specs) {
        const item = replacement.items.find((candidate) => candidate.backendItemId === String(spec.id));
        if (!item) throw new Error(`Missing loaded item ${spec.id}`);
        expect.soft(item).toMatchObject(expectedDraftResource(spec));
        expect.soft(item.notes).toBe(`Faculty note ${spec.id}`);
        expect.soft(item.libraryNotes).toBeUndefined();
        expect.soft(item).not.toHaveProperty('staff_notes');
        expect.soft(item).not.toHaveProperty('internal_note');
      }

      expect.soft(replacement.items.map((item) => item.id)).toEqual([
        'material-602', 'material-603', 'material-601', 'material-604', 'material-605',
      ]);
      expect.soft(replacement.folders[0].itemIds).toEqual(['material-602', 'material-603', 'material-601']);

      const payload = JSON.parse(JSON.stringify(buildSubmissionPayload(replacement, false)));
      for (const spec of specs) {
        const resource = payload.resources.find((candidate: { resource_data: { id: string } }) => (
          candidate.resource_data.id === `material-${spec.id}`
        ));
        if (!resource) throw new Error(`Missing create payload resource ${spec.id}`);
        const item = replacement.items.find((candidate) => candidate.backendItemId === String(spec.id));
        if (!item) throw new Error(`Missing loaded item ${spec.id}`);
        expect(resource.faculty_notes).toBe(`Faculty note ${spec.id}`);
        expect.soft(resource.resource_data).toMatchObject(expectedDraftResource(spec));
        expect.soft(resource.resource_data).toMatchObject(loadedDraftResource(item));
        expect(resource.resource_data.notes).toBe(item.notes);
        expect.soft(resource.resource_data.journalTitle).toBe(
          spec.journalTitle !== undefined ? spec.journalTitle : spec.journal,
        );
        expect.soft(resource.resource_data).not.toHaveProperty('libraryNotes');
      }
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('keeps submission notes and needed-by dates in the faculty index mapping', () => {
    const reserve = mapSubmissionIndexItem(backendSubmission());

    expect(reserve.submissionNotes).toBe('Faculty submission note');
    expect(reserve.neededByDate).toBe('2026-12-01');
  });

  it('round-trips every untouched submitted-update field for folder and root items', async () => {
    const submission = backendSubmission('submitted');
    const loaded = mapSubmissionDetailItem(submission);
    const reserve: CourseReserve = {
      ...loaded,
      items: loaded.items.map((item) => item.backendItemId === '602'
        ? { ...item, status: 'complete' }
        : item),
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const handlers = createSubmissionHandlers(vi.fn(), reserve, organizedContent(reserve), vi.fn());

    expect(reserve.items.find((item) => item.backendItemId === '602')?.status).toBe('complete');
    handlers.confirmSubmit(false);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/faculty-submission/submission-ff055');
    expect((request as RequestInit).method).toBe('PUT');
    const payload = JSON.parse(String((request as RequestInit).body));
    const item = (backendId: string) => {
      const loadedItem = reserve.items.find((candidate) => candidate.backendItemId === backendId);
      if (!loadedItem) throw new Error(`Missing loaded item ${backendId}`);
      return loadedItem;
    };
    expect(payload).toMatchObject({
      submission_notes: 'Faculty submission note',
      needed_by_date: '2026-12-01',
      folders: [{ folder_uuid: '701', folder_name: 'Week 1', display_order: 0 }],
      items: [
        expectedUpdateItem(item('602'), 0, '701', 0),
        expectedUpdateItem(item('603'), 0, '701', 1),
        expectedUpdateItem(item('601'), 0, '701', 2),
        expectedUpdateItem(item('604'), 1, null, null),
        expectedUpdateItem(item('605'), 2, null, null),
      ],
    });
  });

  it('serializes genuinely empty submitted fields without sentinel strings', async () => {
    const emptySpec: ItemSpec = {
      id: 606,
      title: 'Empty metadata item',
      authors: '',
      materialType: 'book',
      isReuse: false,
      folderName: null,
      displayOrder: 0,
      positionInFolder: null,
    };
    const submission = backendSubmission('submitted');
    const emptyItem = indexItem(emptySpec);
    emptyItem.barcode = '';
    emptyItem.call_number = '';
    emptyItem.resource_data = {
      title: emptySpec.title,
      authors: '',
      materialType: 'book',
      status: 'pending',
      journalTitle: '',
      journal: 'Stale Journal Alias',
      publisher: '',
      isbn: '',
      url: '',
      displayStartDate: '',
      displayEndDate: '',
    };
    const emptyResource = newResourceRow(emptySpec);
    emptyResource.faculty_notes = '';
    const reserve = mapSubmissionDetailItem({
      ...submission,
      folders: [],
      unfoldered_items: [emptyItem],
      newResources: [emptyResource],
      reuseResources: [],
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const handlers = createSubmissionHandlers(vi.fn(), reserve, organizedContent(reserve), vi.fn());

    handlers.confirmSubmit(false);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, request] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String((request as RequestInit).body));

    expect(payload.items).toEqual([{
      item_uuid: '606',
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
    expect(JSON.stringify(payload.items[0])).not.toContain('"undefined"');
    expect(JSON.stringify(payload.items[0])).not.toContain('"null"');
  });
});

function loadedDraftResource(item: CourseItem) {
  return {
    publicationYear: item.publicationYear,
    edition: item.edition,
    pages: item.pages,
    chapterTitle: item.chapterTitle,
    copy: item.copy,
    instanceId: item.instanceId,
    instanceHrid: item.instanceHrid,
    holdingsId: item.holdingsId,
    temporaryLocationId: item.temporaryLocationId,
    temporaryLocationObject: item.temporaryLocationObject,
    permanentLocationId: item.permanentLocationId,
    permanentLocationObject: item.permanentLocationObject,
    copiedItem: item.copiedItem,
  };
}

function expectedUpdateItem(
  item: CourseItem,
  displayOrder: number,
  folderUuid: string | null,
  positionInFolder: number | null,
) {
  return {
    item_uuid: item.backendItemId,
    display_order: displayOrder,
    folder_uuid: folderUuid,
    position_in_folder: positionInFolder,
    material_type: item.materialType,
    title: item.title,
    author: item.authors || null,
    journal: item.journalTitle || null,
    publisher: item.publisher || null,
    isbn: item.isbn || null,
    url: item.url || null,
    display_start_date: item.displayStartDate || null,
    display_end_date: item.displayEndDate || null,
    faculty_notes: item.notes || null,
    call_number: item.callNumber,
    barcode: item.barcode,
  };
}
