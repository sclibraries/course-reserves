import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reuseMocks = vi.hoisted(() => ({
  addItem: vi.fn(() => true),
  createFolder: vi.fn((_reserveId: string, folderName: string) => folderName === 'Week 1' ? 'target-week-1' : 'target-week-2'),
  moveFolderPosition: vi.fn(),
  fetchCourseResources: vi.fn(),
  fetchPreviousCourses: vi.fn(),
  courses: [
    {
      courseListingId: 'listing-bio-spring2099', courseNumber: 'BIO 026', courseName: 'Synthetic Biology',
      term: 'Spring 2099', instructor: 'Test Faculty', resourceCount: 1, electronicCount: 1, physicalCount: 0, isExactMatch: true,
    },
    {
      courseListingId: 'listing-bio-fall2099', courseNumber: 'BIO 026', courseName: 'Synthetic Biology',
      term: 'Fall 2099', instructor: 'Test Faculty', resourceCount: 3, electronicCount: 2, physicalCount: 1, isExactMatch: true,
    },
    {
      courseListingId: 'listing-chem-2099', courseNumber: 'CHEM 026', courseName: 'Synthetic Chemistry',
      term: 'Fall 2099', instructor: 'Test Faculty', resourceCount: 1, electronicCount: 1, physicalCount: 0, isExactMatch: false,
    },
  ],
}));

vi.mock('@/pages/SubmissionEditor/SubmissionEditorContext', () => ({
  useSubmissionEditorContext: () => ({
    id: 'reserve-026',
    reserve: {
      courseCode: 'BIO 026', courseTitle: 'Synthetic Biology',
      items: [{ id: 'existing-item', title: 'Already in list', authors: '', materialType: 'website', status: 'draft', url: 'https://example.test/already' }],
      folders: [{ id: 'existing-folder', title: 'Existing week', isOpen: true, items: [], position: 0 }],
    },
    user: { full_name: 'Test Faculty' },
    addItem: reuseMocks.addItem,
    createFolder: reuseMocks.createFolder,
    moveFolderPosition: reuseMocks.moveFolderPosition,
  }),
}));

vi.mock('@/hooks/useCourseCloning', () => ({
  useCourseCloning: () => ({
    loadingPreviousCourses: false,
    hasLoadedPreviousCourses: true,
    loadingOtherCourses: false,
    previousCourses: reuseMocks.courses,
    fetchPreviousCourses: reuseMocks.fetchPreviousCourses,
    fetchCourseResources: reuseMocks.fetchCourseResources,
  }),
}));

import ReuseTab from './ReuseTab';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const sourceResources = [
  {
    resource_type: 'electronic', id: 'electronic-1', title: 'Synthetic reading',
    item_url: 'https://example.test/reading', description: 'Description', external_note: 'Faculty note',
    internal_note: 'Staff-only note', folder_name: 'Week 1', order: 1,
  },
  {
    resource_type: 'physical', id: 'BC-026', title: 'Synthetic reserve book', folder_name: 'Week 1', order: 2,
  },
  {
    resource_type: 'electronic', id: 'electronic-2', title: 'Already in list',
    item_url: 'https://example.test/already', order: 3,
  },
  {
    resource_type: 'electronic', id: 'electronic-3', title: 'Synthetic chapter',
    item_url: 'https://example.test/chapter', folder_name: 'Week 2', order: 4,
  },
];

describe('ReuseTab', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    reuseMocks.fetchCourseResources.mockResolvedValue({
      orderedResources: sourceResources,
      physicalReserves: [{
        temporaryItemId: 'folio-item-026', barcode: 'BC-026',
        copiedItem: {
          title: 'Synthetic reserve book', barcode: 'BC-026', callNumber: 'QA 76 .B1', copy: '1',
          instanceId: 'folio-instance-026', holdingsId: 'folio-holdings-026', instanceHrid: 'in000026',
          temporaryLocationId: 'temp-026', temporaryLocationObject: { id: 'temp-026', name: 'Temporary', code: 'TMP' },
          permanentLocationId: 'perm-026', permanentLocationObject: { id: 'perm-026', name: 'Permanent', code: 'PERM' },
        },
      }],
      electronicResources: [],
    });
    reuseMocks.fetchPreviousCourses.mockResolvedValue(reuseMocks.courses);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
  });

  async function renderReuseTab(entry = '/submission/reserve-026/edit/add?tab=reuse') {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<MemoryRouter initialEntries={[entry]}><ReuseTab /></MemoryRouter>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  async function flushUi() {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }

  it('pins the latest same-number offering before other courses and labels it', async () => {
    await renderReuseTab();

    const courseRows = Array.from(container!.querySelectorAll<HTMLButtonElement>('[data-course-listing-id]'));
    expect(courseRows[0].getAttribute('data-course-listing-id')).toBe('listing-bio-fall2099');
    expect(courseRows[0].textContent).toContain('Last time you taught this course');
    expect(courseRows.map((button) => button.getAttribute('data-course-listing-id')))
      .toEqual(['listing-bio-fall2099', 'listing-bio-spring2099', 'listing-chem-2099']);
  });

  it('preselects the last same-number course and shows existing items with an in-list badge', async () => {
    await renderReuseTab('/submission/reserve-026/edit/add?tab=reuse&course=last');

    await flushUi();
    expect(reuseMocks.fetchCourseResources).toHaveBeenCalledWith('listing-bio-fall2099');
    expect(container!.textContent).toContain('Synthetic reading');
    expect(container!.textContent).toContain('In your list ✓');
    expect(container!.textContent).toContain('Folder: Week 1');
  });

  it('adds all available resources in source order and keeps their source folder', async () => {
    await renderReuseTab('/submission/reserve-026/edit/add?tab=reuse&course=last');
    await flushUi();

    const addAllButton = Array.from(container!.querySelectorAll('button')).find((button) => /add all/i.test(button.textContent || ''));
    await act(async () => { addAllButton?.click(); });

    expect(reuseMocks.addItem).toHaveBeenCalledTimes(3);
    expect(reuseMocks.createFolder).toHaveBeenCalledWith('reserve-026', 'Week 1');
    expect(reuseMocks.createFolder).toHaveBeenCalledWith('reserve-026', 'Week 2');
    expect(reuseMocks.moveFolderPosition.mock.calls).toEqual([
      ['reserve-026', 'target-week-1', 'down'],
      ['reserve-026', 'target-week-1', 'down'],
      ['reserve-026', 'target-week-2', 'down'],
      ['reserve-026', 'target-week-2', 'down'],
      ['reserve-026', 'target-week-2', 'down'],
    ]);
    expect(reuseMocks.addItem.mock.calls.map(([, item]) => item.title))
      .toEqual(['Synthetic reading', 'Synthetic reserve book', 'Synthetic chapter']);
    expect(reuseMocks.addItem.mock.calls.map(([, item]) => item.folderId))
      .toEqual(['target-week-1', 'target-week-1', 'target-week-2']);
    expect(reuseMocks.addItem.mock.calls[0][1].notes).toBe('Description Faculty note');
    expect(reuseMocks.addItem.mock.calls[0][1].notes).not.toContain('Staff-only note');
  });

  it('passes all physical FOLIO identifiers through the shared add handler', async () => {
    await renderReuseTab('/submission/reserve-026/edit/add?tab=reuse&course=last');
    await flushUi();

    const addPhysicalButton = container!.querySelector<HTMLButtonElement>('[aria-label="Add Synthetic reserve book"]');
    await act(async () => { addPhysicalButton?.click(); });

    expect(reuseMocks.addItem).toHaveBeenCalledTimes(1);
    expect(reuseMocks.addItem).toHaveBeenCalledWith('reserve-026', expect.objectContaining({
      title: 'Synthetic reserve book', barcode: 'BC-026', callNumber: 'QA 76 .B1', copy: '1',
      instanceId: 'folio-instance-026', holdingsId: 'folio-holdings-026', instanceHrid: 'in000026',
      temporaryLocationId: 'temp-026', temporaryLocationObject: { id: 'temp-026', name: 'Temporary', code: 'TMP' },
      permanentLocationId: 'perm-026', copiedItem: expect.objectContaining({ barcode: 'BC-026' }),
      folderId: 'target-week-1',
    }));
  });
});
