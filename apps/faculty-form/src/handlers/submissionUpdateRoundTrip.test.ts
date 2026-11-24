import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseItem, CourseReserve, FolioLocation } from '@/store/reserve/types';
import type { BackendSubmission } from '@/store/reserve/submissionMapping';
import type { FacultyItemWire } from '@/store/reserve/facultyItemMapping';
import type { OrganizedContent } from '@/utils/contentSearch';
import { buildSubmissionPayload } from './submissionPayload';
import { createSubmissionHandlers } from './submissionHandlers';
import { mapSubmissionDetailItem, mapSubmissionIndexItem } from '@/store/reserve/submissionMapping';
import { useReserveStore } from '@/store/useReserveStore';
import { useDraftStore } from '@/store/draftStore';
import { useServerDraftSync } from '@/hooks/useServerDraftSync';
import { SubmissionDetailItemsTable } from '@/components/SubmissionDetailItemsTable';

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

  return {
    title: spec.title,
    authors: spec.authors,
    materialType: spec.materialType,
    status: 'pending',
    isbn: `9780000000${resourceId}`,
    publisher: `Publisher ${resourceId}`,
    publicationYear: '2024',
    edition: '2nd edition',
    oclcNumber: `OCLC-${resourceId}`,
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
    } : {}),
    libraryNotes: `Internal library note ${resourceId}`,
  };
}

function indexItem(spec: ItemSpec): FacultyItemWire {
  const data = resourceData(spec);
  return {
    kind: 'new',
    id: spec.id,
    folder_id: spec.folderName ? 701 : null,
    folder_name: spec.folderName,
    position: spec.positionInFolder,
    display_order: spec.displayOrder,
    is_reuse: spec.isReuse,
    status: 'pending',
    title: spec.title,
    authors: spec.authors,
    material_type: spec.materialType,
    assignedPages: '17-20',
    faculty_notes: `Faculty note ${spec.id}`,
    barcode: spec.isReuse ? `BC${spec.id}` : null,
    call_number: spec.isReuse ? `QA ${spec.id} .T1` : null,
    eds: data.eds ?? null,
    source_resource_id: spec.sourceResourceId || (spec.isReuse ? `source-resource-${spec.id}` : null),
    source_folio_instance_id: spec.isReuse ? `source-folio-${spec.id}` : null,
    instance_id: spec.isReuse ? `folio-instance-${spec.id}` : null,
    holdings_id: spec.isReuse ? `folio-holdings-${spec.id}` : null,
    temporary_location: spec.isReuse ? { id: 'temporary-1', name: 'Temporary', code: 'TEMP' } : null,
    permanent_location: spec.isReuse ? { id: 'permanent-1', name: 'Permanent', code: 'PERM' } : null,
    lock: { locked: false, kind: null, reason: null },
    capabilities: { edit: true, delete: true, move: true, reorder: true },
    journalTitle: spec.journal !== undefined ? spec.journal : spec.journalTitle ?? null,
    publisher: data.publisher ?? null,
    publicationYear: data.publicationYear ?? null,
    isbn: data.isbn ?? null,
    issn: data.issn ?? null,
    doi: data.doi ?? null,
    edition: data.edition ?? null,
    oclcNumber: data.oclcNumber ?? null,
    volume: data.volume ?? null,
    issue: data.issue ?? null,
    pages: data.pages ?? null,
    url: data.url ?? null,
    displayStartDate: data.displayStartDate ?? null,
    displayEndDate: data.displayEndDate ?? null,
    instance_hrid: spec.isReuse ? `in000${spec.id}` : null,
    chapter_title: data.chapterTitle ?? null,
    copy: data.copy ?? null,
    temporary_location_id: spec.isReuse ? 'temporary-1' : null,
    permanent_location_id: spec.isReuse ? 'permanent-1' : null,
  };
}

function backendSubmission(status: 'draft' | 'submitted' = 'draft'): BackendSubmission {
  const rows = specs.map(indexItem);
  const folderItems = rows.filter((item) => item.folder_id === 701)
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  const unfolderedItems = rows.filter((item) => item.folder_id === null);

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
    can_edit: true,
    folders: [{ folder_id: 701, name: 'Week 1', display_order: 0, ambiguous: false, items: folderItems }],
    unfoldered_items: unfolderedItems,
  };
}

function expectedDraftResource(spec: ItemSpec) {
  return {
    publicationYear: '2024',
    edition: '2nd edition',
    oclcNumber: `OCLC-${spec.id}`,
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

function persistJournal(submission: BackendSubmission, id: number, journal: string | null) {
  const item = [...(submission.folders || []).flatMap((folder) => folder.items), ...(submission.unfoldered_items || [])]
    .find((row) => row.id === id);
  if (!item) {
    throw new Error(`Missing presented item ${id}`);
  }
  item.journalTitle = journal;
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

  it('filters legacy reuse rows from the shared save payload but keeps reused new rows', () => {
    const submission = {
      submission_uuid: 'submission-legacy-filter',
      course_code: 'BIO 220',
      course_title: 'Ecology',
      section: '01',
      faculty_display_name: 'Test Faculty',
      term_code: '2026FA',
      status: 'draft',
      updated_at: '2026-08-01T12:00:00Z',
      can_edit: true,
      folders: [{
        folder_id: 701,
        name: 'Week 1',
        display_order: 0,
        ambiguous: false,
        items: [
          facultyItem('new', 606, { is_reuse: true }),
          facultyItem('reuse', 606),
        ],
      }],
      unfoldered_items: [],
    } as unknown as BackendSubmission;
    const reserve = mapSubmissionDetailItem(submission);

    const payload = buildSubmissionPayload(reserve, false);

    expect(payload.resources).toHaveLength(1);
    expect(payload.resources[0].resource_data.id).toBe('material-new-606');
    expect(payload.items.map((item) => item.id)).toEqual(['material-new-606']);
    expect(payload.folders[0].items.map((item) => item.id)).toEqual(['material-new-606']);
    expect(payload.displayOrder).toEqual([{ type: 'folder', id: 'folder-701', displayPosition: 0 }]);
  });

  it('uses backend ids for new-item message counts and no count for legacy reuse', async () => {
    const reserve = mapSubmissionDetailItem({
      submission_uuid: 'submission-message-identity',
      course_code: 'BIO 220',
      course_title: 'Ecology',
      faculty_display_name: 'Test Faculty',
      term_code: '2026FA',
      status: 'submitted',
      updated_at: '2026-08-01T12:00:00Z',
      can_edit: true,
      folders: [],
      unfoldered_items: [facultyItem('new', 607), facultyItem('reuse', 607)],
    } as unknown as BackendSubmission);
    const getItemMessageCount = vi.fn(() => 0);
    const getItemUnreadCount = vi.fn(() => 0);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => root.render(React.createElement(SubmissionDetailItemsTable, {
        reserve,
        onItemMessage: vi.fn(async () => {}),
        getItemMessageCount,
        getItemUnreadCount,
        onAddMaterials: vi.fn(),
      })));

      expect(getItemMessageCount.mock.calls).toEqual([[607]]);
      expect(getItemUnreadCount.mock.calls).toEqual([[607]]);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('replaces a server draft with complete faculty-safe items and keeps create payload fields', async () => {
    const submission = backendSubmission('draft');
    api.get.mockResolvedValue({ data: { items: [submission], meta: { totalCount: 1 } } });
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

      expect(api.get).toHaveBeenCalledWith('https://api.test/faculty-submission/index?per-page=50&page=1');
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
        expect.soft(item).not.toHaveProperty('copiedItem');
        expect.soft(item.notes).toBe(`Faculty note ${spec.id}`);
        expect.soft(item.libraryNotes).toBeUndefined();
        expect.soft(item).not.toHaveProperty('staff_notes');
        expect.soft(item).not.toHaveProperty('internal_note');
      }

      expect.soft(replacement.items.map((item) => item.id)).toEqual([
        'material-new-602', 'material-new-603', 'material-new-601', 'material-new-604', 'material-new-605',
      ]);
      expect.soft(replacement.folders[0].itemIds).toEqual(['material-new-602', 'material-new-603', 'material-new-601']);

      const payload = JSON.parse(JSON.stringify(buildSubmissionPayload(replacement, false)));
      for (const spec of specs) {
        const resource = payload.resources.find((candidate: { resource_data: { id: string } }) => (
          candidate.resource_data.id === `material-new-${spec.id}`
        ));
        if (!resource) throw new Error(`Missing create payload resource ${spec.id}`);
        const original = resourceData(spec);
        const expectedJournal = original.journal !== undefined ? original.journal : original.journalTitle;
        expect(resource.is_reuse).toBe(spec.isReuse);
        expect(resource.faculty_notes).toBe(`Faculty note ${spec.id}`);
        expect.soft(resource.resource_data).toMatchObject(expectedDraftResource(spec));
        expect.soft(resource.resource_data).not.toHaveProperty('copiedItem');
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

  it('clones mapped items without server identities or lock state and keeps source values', () => {
    const source = mapSubmissionDetailItem(backendSubmission());
    useReserveStore.setState({ reserves: [source] });

    const cloneId = useReserveStore.getState().cloneReserve(source.id, {
      courseCode: 'BIO 221', courseTitle: 'Ecology II', section: '02', instructors: 'Test Faculty', term: '2027SP',
    });
    const clone = useReserveStore.getState().getReserveById(cloneId);
    if (!clone) throw new Error('Cloned reserve was not stored');
    const reusedNewItem = clone.items.find((item) => item.title === 'Rainfall Patterns');
    if (!reusedNewItem) throw new Error('Cloned reuse item was not stored');

    expect(clone).not.toHaveProperty('submissionUuid');
    expect(clone).not.toHaveProperty('draftVersion');
    expect(clone).not.toHaveProperty('courseAssignmentId');
    expect(clone.folders[0]).not.toHaveProperty('backendFolderId');
    expect(clone.folders[0]).not.toHaveProperty('ambiguous');
    expect(reusedNewItem).not.toHaveProperty('backendItemId');
    expect(reusedNewItem).not.toHaveProperty('backendKind');
    expect(reusedNewItem).not.toHaveProperty('lock');
    expect(reusedNewItem).not.toHaveProperty('capabilities');
    expect(reusedNewItem).toMatchObject({
      isReuse: true,
      sourceResourceId: 'source-resource-602',
      sourceFolioInstanceId: 'source-folio-602',
      instanceId: 'folio-instance-602',
    });
    const clonedPayload = buildSubmissionPayload(clone, false);
    const clonedReuse = clonedPayload.resources.find((resource) => resource.resource_data.title === 'Rainfall Patterns');
    expect(clonedReuse).toMatchObject({ is_reuse: true, source_folio_instance_id: 'source-folio-602' });
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
    if (!ebook) throw new Error('Missing synthetic Ebook fixture');
    ebook.material_type = 'ebook';
    ebook.assignedPages = '12-16';

    const loaded = mapSubmissionIndexItem(submission);
    const ebookItem = loaded.items.find((item) => item.id === 'material-new-601');
    expect(ebookItem).toMatchObject({ materialType: 'ebook', assignedPages: '12-16' });

    const submissionPayload = buildSubmissionPayload(loaded, false);
    expect(submissionPayload.resources.find((row) => row.resource_data.id === 'material-new-601')?.assignedPages).toBe('12-16');

    const firstUpdate = await submitUpdate(loaded);
    expect(firstUpdate.items.find((item: { item_uuid: string }) => item.item_uuid === '601')?.assignedPages).toBe('12-16');

    const reloaded = mapSubmissionIndexItem(submission);
    const secondUpdate = await submitUpdate(reloaded);
    expect(secondUpdate.items.find((item: { item_uuid: string }) => item.item_uuid === '601')?.assignedPages).toBe('12-16');

    const cleared: CourseReserve = {
      ...reloaded,
      items: reloaded.items.map((item) => item.id === 'material-new-601' ? { ...item, assignedPages: '' } : item),
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
      candidate.resource_data.id === 'material-new-605'
    ));
    expect(resource).toMatchObject({ is_reuse: false, source_resource_id: 'local-resource-605' });
    expect(resource.resource_data.holdingsId).toBeUndefined();
  });

  it('keeps numeric source identities separate from instance identities in both save shapes', () => {
    const submission = backendSubmission();
    const sourceItem = submission.folders?.[0].items.find((item) => item.id === 601);
    if (!sourceItem) throw new Error('Missing source identity item');
    sourceItem.source_resource_id = 1701;
    sourceItem.source_folio_instance_id = 'source-instance-1701';
    sourceItem.instance_id = 'instance-data-1701';
    sourceItem.material_type = null;
    sourceItem.journalTitle = null;
    sourceItem.oclcNumber = null;
    sourceItem.eds = { dbId: null, an: 'synthetic-an', plink: null };
    sourceItem.temporary_location_id = 'temporary-source-id';
    sourceItem.temporary_location = { id: 'temporary-source-id', name: null, code: 'TMP' };

    const reserve = mapSubmissionDetailItem(submission);
    const item = reserve.items.find((candidate) => candidate.backendItemId === '601');
    expect(item).toMatchObject({
      sourceResourceId: '1701',
      sourceFolioInstanceId: 'source-instance-1701',
      instanceId: 'instance-data-1701',
      materialType: 'other',
      journalTitle: '',
      eds: { dbId: '', an: 'synthetic-an' },
      temporaryLocationId: 'temporary-source-id',
      temporaryLocationObject: { id: 'temporary-source-id', name: '', code: 'TMP' },
    });
    expect(item?.oclcNumber).toBeUndefined();
    expect(item?.eds).not.toHaveProperty('plink');
    const resource = buildSubmissionPayload(reserve, false).resources
      .find((candidate) => candidate.resource_data.id === 'material-new-601');
    expect(resource).toMatchObject({
      source_resource_id: '1701',
      source_folio_instance_id: 'source-instance-1701',
      resource_data: { instanceId: 'instance-data-1701' },
    });
  });

  it('keeps a new browser id intact as the submitted item fallback', async () => {
    const loaded = mapSubmissionDetailItem(backendSubmission('submitted'));
    const reserve = {
      ...loaded,
      items: loaded.items.map((item) => item.backendItemId === '601'
        ? { ...item, backendItemId: undefined }
        : item),
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const handlers = createSubmissionHandlers(vi.fn(), reserve, organizedContent(reserve), vi.fn());

    handlers.confirmSubmit(false);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, request] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String((request as RequestInit).body));

    expect(payload.items.find((item: { title: string }) => item.title === 'Climate Systems')?.item_uuid)
      .toBe('material-new-601');
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
    emptyItem.journalTitle = '';
    emptyItem.publisher = '';
    emptyItem.isbn = '';
    emptyItem.url = '';
    emptyItem.displayStartDate = '';
    emptyItem.displayEndDate = '';
    emptyItem.faculty_notes = '';
    emptyItem.assignedPages = null;
    const reserve = mapSubmissionDetailItem({
      ...submission,
      folders: [],
      unfoldered_items: [emptyItem],
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

function facultyItem(
  kind: 'new' | 'reuse',
  id: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    kind,
    id,
    folder_id: 701,
    folder_name: 'Week 1',
    position: null,
    display_order: 0,
    is_reuse: kind === 'reuse',
    status: 'pending',
    title: `Synthetic ${kind} item`,
    journalTitle: null,
    material_type: 'book',
    assignedPages: null,
    faculty_notes: null,
    barcode: null,
    call_number: null,
    eds: null,
    source_resource_id: null,
    source_folio_instance_id: null,
    instance_id: null,
    holdings_id: null,
    temporary_location: null,
    permanent_location: null,
    lock: { locked: false, kind: null, reason: null },
    capabilities: { edit: true, delete: true, move: true, reorder: true },
    authors: null,
    publisher: null,
    publicationYear: null,
    isbn: null,
    issn: null,
    doi: null,
    edition: null,
    oclcNumber: null,
    volume: null,
    issue: null,
    pages: null,
    url: null,
    displayStartDate: null,
    displayEndDate: null,
    instance_hrid: null,
    chapter_title: null,
    copy: null,
    temporary_location_id: null,
    permanent_location_id: null,
    ...overrides,
  };
}

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
