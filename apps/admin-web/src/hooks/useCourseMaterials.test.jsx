import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCourseData,
  fetchCrossLinkedCourses,
  fetchItemAvailabilityData,
  fetchMergedResources,
  fetchRecords,
} from '../components/page-sections/course-record/api';
import { folioSearchService } from '../services/folioSearchService';
import { useCourseMaterials } from './useCourseMaterials';

vi.mock('../components/page-sections/course-record/api', () => ({
  fetchCourseData: vi.fn(),
  fetchCrossLinkedCourses: vi.fn(),
  fetchItemAvailabilityData: vi.fn(),
  fetchMergedResources: vi.fn(),
  fetchRecords: vi.fn(),
}));

vi.mock('../services/folioSearchService', () => ({
  folioSearchService: { getInventory: vi.fn() },
}));

const mountedRoots = [];

async function mountHook(record = 'test-course', options = {}) {
  let current;
  let currentRecord = record;
  let currentOptions = options;
  function Harness() {
    current = useCourseMaterials(currentRecord, currentOptions);
    return null;
  }

  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });

  const render = async (courseId = record, hookOptions = options) => {
    currentRecord = courseId;
    currentOptions = hookOptions;
    await act(async () => {
      root.render(createElement(Harness));
      for (let index = 0; index < 25; index += 1) await Promise.resolve();
    });
  };

  await render();
  return { get current() { return current; }, rerender: render };
}

const flattenResults = results => results.flatMap(result => (
  Array.isArray(result.items) ? result.items : [result]
));

function inventoryResponse(instance) {
  return {
    ok: true,
    json: async () => ({ data: { instances: instance ? [instance] : [] } }),
  };
}

describe('useCourseMaterials characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    fetchMergedResources.mockResolvedValue({ resources: [] });
    fetchRecords.mockResolvedValue([]);
    fetchCourseData.mockResolvedValue([{ courseListingId: 'test-course' }]);
    fetchCrossLinkedCourses.mockResolvedValue([]);
    fetchItemAvailabilityData.mockResolvedValue([]);
    folioSearchService.getInventory.mockResolvedValue(inventoryResponse(null));
  });

  afterEach(async () => {
    await act(async () => {
      mountedRoots.splice(0).forEach(({ root, container }) => {
        root.unmount();
        container.remove();
      });
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads merged electronic, print, and cross-linked resources with their grouped order', async () => {
    fetchMergedResources.mockResolvedValue({ resources: [
      {
        id: 'electronic-1',
        resource_type: 'electronic',
        order: '2',
        folder_id: 'folder-readings',
        folder_name: 'Readings',
        title: 'Electronic reading',
        item_url: 'https://example.test/electronic',
      },
      {
        id: 'print-1',
        resource_type: 'physical',
        order: 1,
        title: 'Print book',
        callNumber: 'QA 1',
      },
    ] });
    fetchRecords.mockResolvedValue([{
      instanceId: 'print-1',
      copiedItem: { instanceId: 'print-1', barcode: 'reserve-1' },
    }]);
    fetchCrossLinkedCourses.mockResolvedValue([{
      resource_id: 'linked-1',
      name: 'Linked reading',
      folder_id: 'folder-supplemental',
      folder_name: 'Supplemental',
      item_url: 'https://example.test/linked',
    }]);
    fetchItemAvailabilityData.mockResolvedValue([
      { barcode: 'reserve-1', location: 'Reserve Shelf' },
      { barcode: 'other-1', location: 'Stacks' },
    ]);
    folioSearchService.getInventory.mockResolvedValue(inventoryResponse({
      contributors: [{ name: 'Ada Lovelace' }],
      publication: [{ publisher: 'Example Press', place: 'Boston', dateOfPublication: '2020' }],
    }));

    const hook = await mountHook();

    expect(hook.current.isLoading).toBe(false);
    expect(hook.current.error).toBe(null);
    expect(hook.current.course).toEqual([{ courseListingId: 'test-course' }]);
    expect(hook.current.hasElectronicReserves).toBe(true);
    expect(hook.current.materials.map(item => item.id)).toEqual([
      'electronic-1', 'print-1', 'linked-1',
    ]);
    expect(hook.current.materials[1].copiedItem.contributors).toEqual([
      { name: 'Ada Lovelace' },
    ]);
    expect(hook.current.reserveBarcodesByInstance).toEqual({ 'print-1': ['reserve-1'] });
    expect(hook.current.availability['print-1']).toEqual({
      holdings: [{ barcode: 'reserve-1', location: 'Reserve Shelf' }],
      allHoldings: [
        { barcode: 'reserve-1', location: 'Reserve Shelf' },
        { barcode: 'other-1', location: 'Stacks' },
      ],
    });
    expect(hook.current.combinedResults).toEqual([
      expect.objectContaining({ id: 'print-1' }),
      { folder: 'Readings', items: [expect.objectContaining({ id: 'electronic-1' })] },
      { folder: 'Supplemental', items: [expect.objectContaining({ id: 'linked-1' })] },
    ]);
  });

  it('exposes fetch failures and clears the loading state', async () => {
    fetchRecords.mockRejectedValue(new Error('fixture records failure'));

    const hook = await mountHook();

    expect(hook.current.isLoading).toBe(false);
    expect(hook.current.error).toBe('fixture records failure');
    expect(hook.current.materials).toEqual([]);
    expect(fetchCourseData).not.toHaveBeenCalled();
  });

  it('filters and searches visible results while counting visibility for all materials', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T17:00:00.000Z'));
    fetchMergedResources.mockResolvedValue({ resources: [
      {
        id: 'visible-electronic', resource_type: 'electronic', title: 'Visible Ada algebra',
      },
      {
        id: 'future-electronic-1', resource_type: 'electronic', title: 'Future algebra',
        start_visibility: '2025-01-20', use_resource_visibility: true,
      },
      {
        id: 'future-electronic-2', resource_type: 'electronic', title: 'Future calculus',
        start_visibility: '2025-01-25', use_resource_visibility: true,
      },
      {
        id: 'expired-electronic', resource_type: 'electronic', title: 'Expired physics',
        end_visibility: '2025-01-10', use_resource_visibility: true,
      },
      { id: 'print-1', resource_type: 'physical', title: 'Print chemistry' },
    ] });
    fetchRecords.mockResolvedValue([{
      instanceId: 'print-1', copiedItem: { instanceId: 'print-1', barcode: 'print-barcode' },
    }]);

    const hook = await mountHook();

    expect(hook.current.visibleCount).toBe(2);
    expect(hook.current.hiddenCount).toBe(3);
    expect(hook.current.nextAvailableDate).toEqual(new Date(2025, 0, 20));
    expect(flattenResults(hook.current.combinedResults).map(item => item.id)).toEqual([
      'print-1', 'visible-electronic',
    ]);

    await hook.rerender('test-course', { filter: 'electronic', searchQuery: 'ADA' });
    expect(flattenResults(hook.current.combinedResults).map(item => item.id)).toEqual([
      'visible-electronic',
    ]);
    expect(hook.current.visibleCount).toBe(2);
    expect(hook.current.hiddenCount).toBe(3);

    await hook.rerender('test-course', { canBypassVisibility: true });
    expect(hook.current.visibleCount).toBe(5);
    expect(hook.current.hiddenCount).toBe(0);
    expect(hook.current.nextAvailableDate).toBe(null);
    expect(flattenResults(hook.current.combinedResults)).toHaveLength(5);

    await hook.rerender('test-course', { filter: 'physical' });
    expect(flattenResults(hook.current.combinedResults).map(item => item.id)).toEqual(['print-1']);
  });

  it('counts all date-hidden electronic materials and reports the earliest future start', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T17:00:00.000Z'));
    fetchMergedResources.mockResolvedValue({ resources: [
      {
        id: 'test-future-later', resource_type: 'electronic', title: 'Future later',
        start_visibility: '2025-02-15',
      },
      {
        id: 'test-future-earlier', resource_type: 'electronic', title: 'Future earlier',
        start_visibility: '2025-02-01',
      },
      {
        id: 'test-expired', resource_type: 'electronic', title: 'Already expired',
        end_visibility: '2025-01-10',
      },
    ] });

    const hook = await mountHook();

    expect(hook.current.visibleCount).toBe(0);
    expect(hook.current.hiddenCount).toBe(3);
    expect(hook.current.nextAvailableDate).toEqual(new Date(2025, 1, 1));
    expect(flattenResults(hook.current.combinedResults)).toEqual([]);
  });

  it('toggles accordions and exposes a refetch function', async () => {
    const hook = await mountHook();

    await act(async () => hook.current.toggleAccordion('instance-1', 'details'));
    expect(hook.current.openAccordions).toEqual({ 'instance-1': ['details'] });

    await act(async () => hook.current.toggleAccordion('instance-1', 'details'));
    expect(hook.current.openAccordions).toEqual({ 'instance-1': [] });

    await act(async () => hook.current.refetch());
    expect(fetchMergedResources).toHaveBeenCalledTimes(2);
    expect(fetchRecords).toHaveBeenCalledTimes(2);
  });
});
