import { afterEach, describe, expect, it, vi } from 'vitest';
import { enrichCourseMaterials } from './enrichCourseMaterials';
import { normalizeCourseMaterials } from './normalizeCourseMaterials';
import { prepareCourseMaterials } from './prepareCourseMaterials';

describe('normalizeCourseMaterials', () => {
  afterEach(() => vi.restoreAllMocks());

  it('normalizes merged, FOLIO-only, and cross-linked resources and enriches physical records', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const printReserve = {
      id: 'test-folio-only',
      instanceId: 'test-folio-only',
      copiedItem: { instanceId: 'test-folio-only', title: 'Test FOLIO title' },
    };
    const mergedPhysical = {
      id: 'test-print', resource_type: 'physical', title: 'Test print title', order: '1',
    };
    const fetchInventoryDetails = vi.fn(async id => (
      id === 'test-print'
        ? {
            contributors: [{ name: 'Test Author' }],
            publication: [{ publisher: 'Test Press', place: 'Test City', dateOfPublication: '2020' }],
          }
        : null
    ));

    const prepared = prepareCourseMaterials([
        {
          id: 'test-electronic', resource_type: 'electronic', title: 'Test electronic', order: '2',
          item_url: 'https://example.test/resource',
        },
        {
          id: 'test-electronic', resource_type: 'electronic', title: 'Test duplicate', order: '3',
        },
        mergedPhysical,
      ], [
        { instanceId: 'test-print', copiedItem: { instanceId: 'test-print', title: 'duplicate' } },
        printReserve,
      ]);
    const { records: normalized, hasAnyPhysical } = normalizeCourseMaterials({
      ...prepared,
      crossLinkedCourses: [{
        resource_id: 'test-cross-linked', name: 'Test linked', item_url: 'https://example.test/linked',
      }],
    });
    const records = await enrichCourseMaterials(normalized, hasAnyPhysical, fetchInventoryDetails);

    expect(records.map(record => record.id)).toEqual([
      'test-electronic', 'test-print', 'test-folio-only', 'test-cross-linked',
    ]);
    expect(records[0]).toMatchObject({
      isElectronic: true,
      resource: { resource_id: 'test-electronic', name: 'Test electronic', links: [], metadata: [] },
      copiedItem: { instanceId: 'test-electronic', contributors: [], publication: [] },
    });
    expect(records[1]).toMatchObject({
      isElectronic: false,
      copiedItem: {
        instanceId: 'test-print',
        contributors: [{ name: 'Test Author' }],
        publication: [{ publisher: 'Test Press', place: 'Test City', dateOfPublication: '2020' }],
      },
    });
    expect(records[2]).toBe(printReserve);
    expect(records[3]).toMatchObject({
      id: 'test-cross-linked',
      isElectronic: true,
      resource: { name: 'Test linked', resource_id: 'test-cross-linked' },
    });
    expect(fetchInventoryDetails).toHaveBeenCalledWith('test-print');
  });
});
