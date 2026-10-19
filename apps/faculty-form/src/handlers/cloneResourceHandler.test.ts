import { describe, expect, it, vi } from 'vitest';
import { createCloneResourceHandler } from './cloneResourceHandler';
import type { PreviewResource } from '@/hooks/useCourseCloning';
import type { CourseReserve } from '@/store/courseReservesStore';

describe('createCloneResourceHandler', () => {
  it('preserves the physical FOLIO identity when adding a reused item', () => {
    const location = { id: 'temporary-location', name: 'Temporary', code: 'TEMP' };
    const copiedItem = {
      title: 'Synthetic reserve book',
      barcode: 'BC-026',
      callNumber: 'QA 76 .C1',
      copy: '2',
      instanceId: 'folio-instance-026',
      holdingsId: 'folio-holdings-026',
      instanceHrid: 'in000026',
      temporaryLocationId: 'temporary-location',
      temporaryLocationObject: location,
      permanentLocationId: 'permanent-location',
      permanentLocationObject: { id: 'permanent-location', name: 'Permanent', code: 'PERM' },
    };
    const physicalReserve = { barcode: 'BC-026', copiedItem };
    const addItem = vi.fn(() => true);
    const handler = createCloneResourceHandler(
      { courseCode: 'TEST 026' } as CourseReserve,
      'reserve-026',
      addItem,
      false
    );

    handler.handleAddSingleResource({
      type: 'physical',
      title: 'Synthetic reserve book',
      materialType: 'book',
      _originalReserve: physicalReserve,
    } as PreviewResource);

    expect(addItem).toHaveBeenCalledWith('reserve-026', expect.objectContaining({
      title: 'Synthetic reserve book',
      barcode: 'BC-026',
      callNumber: 'QA 76 .C1',
      copy: '2',
      instanceId: 'folio-instance-026',
      holdingsId: 'folio-holdings-026',
      instanceHrid: 'in000026',
      temporaryLocationId: 'temporary-location',
      temporaryLocationObject: location,
      permanentLocationId: 'permanent-location',
      permanentLocationObject: { id: 'permanent-location', name: 'Permanent', code: 'PERM' },
      copiedItem,
    }));
  });
});
