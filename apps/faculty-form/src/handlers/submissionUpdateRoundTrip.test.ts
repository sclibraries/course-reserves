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

type ResourceData = Omit<Partial<CourseItem>, 'journalTitle'> & {
  journalTitle?: string | null;
  journal?: string | null;
  libraryNotes?: string;
};

type BaseBackendItem = NonNullable<BackendSubmission['unfoldered_items']>[number];
type IndexItem = Omit<BaseBackendItem, 'resource_data' | 'barcode' | 'call_number'> & {
  barcode: string | null;
  call_number: string | null;
  is_reuse: boolean;
  assignedPages: string | null;
  resource_data: ResourceData;
};

type NewResourceRow = {
  id: string | number;
  material_type_id: number | null;
  resource_data: ResourceData | string | null;
  is_reuse: 0 | 1;
  source_barcode: string | null;
  source_call_number: string | null;
  source_resource_id: string | null;
  source_folio_instance_id: string | null;
  item_status: string;
  display_order: number;
  position_in_folder: number | null;
  folder_name: string | null;
  faculty_notes: string | null;
  assignedPages: string | null;
  priority: string;
  created_at: string;
  updated_at: string;
};

type IndexFolder = Omit<NonNullable<BackendSubmission['folders']>[number], 'items'> & {
  item_count: number;
  items: IndexItem[];
};

type IndexSubmission = Omit<BackendSubmission, 'folders' | 'unfoldered_items' | 'newResources' | 'reuseResources'> & {
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
  sourceResourceId?: string;
}

const specs: ItemSpec[] = [
  { id: 601, title: 'Climate Systems', authors: 'A. Example', materialType: 'book', isReuse: false, folderName: 'Week 1', displayOrder: 0, positionInFolder: 2, journalTitle: 'Canonical Journal' },
  { id: 602, title: 'Rainfall Patterns', authors: 'B. Example', materialType: 'article', isReuse: true, folderName: 'Week 1', displayOrder: 1, positionInFolder: 0, journal: 'Alias Journal' },
  { id: 603, title: 'Ocean Currents', authors: 'C. Example', materialType: 'chapter', isReuse: false, folderName: 'Week 1', displayOrder: 2, positionInFolder: 1, journalTitle: 'Stale JournalTitle', journal: 'Persisted Journal' },
  { id: 604, title: 'Coastal Survey', authors: 'D. Example', materialType: 'video', isReuse: true, folderName: null, displayOrder: 3, positionInFolder: null, journalTitle: 'Coastal Media Journal' },
  { id: 605, title: 'Weather Models', authors: 'E. Example', materialType: 'website', isReuse: false, folderName: null, displayOrder: 4, positionInFolder: null, journalTitle: 'Weather Journal', sourceResourceId: 'local-resource-605' },
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
    ...(spec.isReuse ? {
      barcode,
      callNumber,
      instanceId: `folio-instance-${resourceId}`,
      holdingsId: `folio-holdings-${resourceId}`,
      instanceHrid: `in000${resourceId}`,
      temporaryLocationId: temporaryLocation.id,
      temporaryLocationObject: temporaryLocation,
      permanentLocationId: permanentLocation.id,
      permanentLocationObject: permanentLocation,
      copiedItem: copy,
    } : {}),
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
    barcode: spec.isReuse ? `BC${spec.id}` : null,
    call_number: spec.isReuse ? `QA ${spec.id} .T1` : null,
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
    is_reuse: spec.isReuse ? 1 : 0,
    source_barcode: spec.isReuse ? barcode : null,
    source_call_number: spec.isReuse ? callNumber : null,
    source_resource_id: spec.sourceResourceId || (spec.isReuse ? `source-resource-${spec.id}` : null),
    source_folio_instance_id: spec.isReuse ? `folio-instance-${spec.id}` : null,
    item_status: 'pending',
    display_order: spec.displayOrder,
    position_in_folder: spec.positionInFolder,
    folder_name: spec.folderName,
    faculty_notes: `Faculty note ${spec.id}`,
    assignedPages: '17-20',
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
    ...(spec.isReuse ? {
      instanceId: `folio-instance-${spec.id}`,
      instanceHrid: `in000${spec.id}`,
      holdingsId: `folio-holdings-${spec.id}`,
      temporaryLocationId: 'temporary-1',
      temporaryLocationObject: temporaryLocation,
      permanentLocationId: 'permanent-1',
      permanentLocationObject: permanentLocation,
      copiedItem: resourceData(spec).copiedItem,
    } : {}),
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

function withItem(reserve: CourseReserve, backendId: string, updates: Partial<CourseItem>): CourseReserve {
  return {
    ...reserve,
    items: reserve.items.map((item) => item.backendItemId === backendId ? { ...item, ...updates } : item),
  };
}

function persistJournal(submission: IndexSubmission, id: number, journal: string | null) {
  const item = [...submission.folders.flatMap((folder) => folder.items), ...submission.unfoldered_items]
    .find((row) => row.id === id);
  const resource = submission.newResources.find((row) => row.id === id);
  if (!item || !resource || !resource.resource_data || typeof resource.resource_data === 'string') {
    throw new Error(`Missing presented item ${id}`);
  }
  item.resource_data = { ...item.resource_data, journal };
  resource.resource_data = { ...resource.resource_data, journal };
}

async function submitUpdate(reserve: CourseReserve) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  vi.stubGlobal('fetch', fetchMock);
  const handlers = createSubmissionHandlers(vi.fn(), reserve, organizedContent(reserve), vi.fn());
  handlers.confirmSubmit(false);
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

  const [url, request] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.test/faculty-submission/submission-ff055');
  expect((request as RequestInit).method).toBe('PUT');
  return JSON.parse(String((request as RequestInit).body));
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
      expect.soft(replacement.items.find((item) => item.backendItemId === '603')?.journalTitle).toBe('Persisted Journal');

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
        const original = resourceData(spec);
        const expectedJournal = original.journal !== undefined ? original.journal : original.journalTitle;
        expect(resource.is_reuse).toBe(spec.isReuse);
        expect(resource.faculty_notes).toBe(`Faculty note ${spec.id}`);
        expect.soft(resource.resource_data).toMatchObject(expectedDraftResource(spec));
        expect.soft(resource.resource_data).toMatchObject({
          isbn: original.isbn,
          publisher: original.publisher,
          url: original.url,
          displayStartDate: original.displayStartDate,
          displayEndDate: original.displayEndDate,
          journalTitle: expectedJournal,
          notes: `Faculty note ${spec.id}`,
        });
        expect(resource.source_resource_id).toBe(spec.sourceResourceId || (spec.isReuse ? `source-resource-${spec.id}` : null));
        expect.soft(resource.resource_data).not.toHaveProperty('libraryNotes');
      }

      const sourceItem = replacement.items.find((item) => item.backendItemId === '605');
      expect(sourceItem?.sourceResourceId).toBe('local-resource-605');
      expect(sourceItem?.holdingsId).toBeUndefined();
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

  it('compares submitted-update values with the original presented fixtures', async () => {
    const submission = backendSubmission('submitted');
    const loaded = mapSubmissionDetailItem(submission);
    const reserve: CourseReserve = {
      ...loaded,
      items: loaded.items.map((item) => item.backendItemId === '602'
        ? { ...item, status: 'complete' }
        : item),
    };
    expect(reserve.items.find((item) => item.backendItemId === '602')?.status).toBe('complete');
    const payload = await submitUpdate(reserve);
    expect(payload).toEqual({
      submission_notes: 'Faculty submission note',
      needed_by_date: '2026-12-01',
      folders: [{ folder_uuid: '701', folder_name: 'Week 1', display_order: 0 }],
      items: [
        expectedUpdateItem(specs[1], 0, '701', 0),
        expectedUpdateItem(specs[2], 0, '701', 1),
        expectedUpdateItem(specs[0], 0, '701', 2),
        expectedUpdateItem(specs[3], 1, null, null),
        expectedUpdateItem(specs[4], 2, null, null),
      ],
    });
  });

  it('keeps a changed journal through save, reload, and a second save', async () => {
    const submission = backendSubmission('submitted');
    const loaded = mapSubmissionDetailItem(submission);
    const edited = withItem(loaded, '601', { journalTitle: 'Edited Journal' });

    const firstSave = await submitUpdate(edited);
    expect(firstSave.items.find((item: { item_uuid: string }) => item.item_uuid === '601')?.journal).toBe('Edited Journal');

    persistJournal(submission, 601, 'Edited Journal');
    const reloaded = mapSubmissionDetailItem(submission);
    expect(reloaded.items.find((item) => item.backendItemId === '601')?.journalTitle).toBe('Edited Journal');
    const secondSave = await submitUpdate(reloaded);
    expect(secondSave.items.find((item: { item_uuid: string }) => item.item_uuid === '601')?.journal).toBe('Edited Journal');
  });

  it('round-trips Ebook pages through the index and sends a clear as null', async () => {
    const submission = backendSubmission('submitted');
    const ebook = submission.folders?.flatMap((folder) => folder.items || []).find((item) => item.id === 601);
    const resource = submission.newResources?.find((row) => row.id === 601);
    if (!ebook || !resource) throw new Error('Missing synthetic Ebook fixture');
    ebook.material_type = 'ebook';
    resource.assignedPages = '12-16';

    const loaded = mapSubmissionIndexItem(submission);
    const ebookItem = loaded.items.find((item) => item.id === 'material-601');
    expect(ebookItem).toMatchObject({ materialType: 'ebook', assignedPages: '12-16' });

    const submissionPayload = buildSubmissionPayload(loaded, false);
    expect(submissionPayload.resources.find((row) => row.resource_data.id === 'material-601')?.assignedPages).toBe('12-16');

    const firstUpdate = await submitUpdate(loaded);
    expect(firstUpdate.items.find((item: { item_uuid: string }) => item.item_uuid === '601')?.assignedPages).toBe('12-16');

    const reloaded = mapSubmissionIndexItem(submission);
    const secondUpdate = await submitUpdate(reloaded);
    expect(secondUpdate.items.find((item: { item_uuid: string }) => item.item_uuid === '601')?.assignedPages).toBe('12-16');

    const cleared: CourseReserve = {
      ...reloaded,
      items: reloaded.items.map((item) => item.id === 'material-601' ? { ...item, assignedPages: '' } : item),
    };
    const clearUpdate = await submitUpdate(cleared);
    expect(clearUpdate.items.find((item: { item_uuid: string }) => item.item_uuid === '601')?.assignedPages).toBeNull();
  });

  it('keeps an explicit journal clear through save, reload, and a second save', async () => {
    const submission = backendSubmission('submitted');
    const loaded = mapSubmissionDetailItem(submission);
    const edited = withItem(loaded, '601', { journalTitle: '' });

    const firstSave = await submitUpdate(edited);
    expect(firstSave.items.find((item: { item_uuid: string }) => item.item_uuid === '601')?.journal).toBeNull();

    persistJournal(submission, 601, null);
    const reloaded = mapSubmissionDetailItem(submission);
    expect(reloaded.items.find((item) => item.backendItemId === '601')?.journalTitle).toBe('');
    const secondSave = await submitUpdate(reloaded);
    expect(secondSave.items.find((item: { item_uuid: string }) => item.item_uuid === '601')?.journal).toBeNull();
  });

  it('keeps a local source id distinct from FOLIO ids and reuse detection', () => {
    const reserve = mapSubmissionDetailItem(backendSubmission('draft'));
    const item = reserve.items.find((candidate) => candidate.backendItemId === '605');
    if (!item) throw new Error('Missing local-source item');

    expect(item.sourceResourceId).toBe('local-resource-605');
    expect(item.holdingsId).toBeUndefined();
    const payload = JSON.parse(JSON.stringify(buildSubmissionPayload(reserve, false)));
    const resource = payload.resources.find((candidate: { resource_data: { id: string } }) => (
      candidate.resource_data.id === 'material-605'
    ));
    expect(resource).toMatchObject({ is_reuse: false, source_resource_id: 'local-resource-605' });
    expect(resource.resource_data.holdingsId).toBeUndefined();
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
      publisher: '',
      isbn: '',
      url: '',
      displayStartDate: '',
      displayEndDate: '',
    };
    const emptyResource = newResourceRow(emptySpec);
    emptyResource.faculty_notes = '';
    emptyResource.assignedPages = null;
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
      assignedPages: null,
      call_number: null,
      barcode: null,
    }]);
    expect(JSON.stringify(payload.items[0])).not.toContain('"undefined"');
    expect(JSON.stringify(payload.items[0])).not.toContain('"null"');
  });
});

function expectedUpdateItem(
  spec: ItemSpec,
  displayOrder: number,
  folderUuid: string | null,
  positionInFolder: number | null,
) {
  const data = resourceData(spec);
  const barcode = spec.isReuse ? `BC${spec.id}` : null;
  const callNumber = spec.isReuse ? `QA ${spec.id} .T1` : null;
  return {
    item_uuid: String(spec.id),
    display_order: displayOrder,
    folder_uuid: folderUuid,
    position_in_folder: positionInFolder,
    material_type: spec.materialType,
    title: spec.title,
    author: spec.authors || null,
    journal: (data.journal !== undefined ? data.journal : data.journalTitle) || null,
    publisher: data.publisher || null,
    isbn: data.isbn || null,
    url: data.url || null,
    display_start_date: data.displayStartDate || null,
    display_end_date: data.displayEndDate || null,
    faculty_notes: `Faculty note ${spec.id}`,
    assignedPages: '17-20',
    call_number: callNumber,
    barcode,
  };
}
