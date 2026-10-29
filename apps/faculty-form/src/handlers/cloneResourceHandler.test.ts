import { describe, expect, it, vi } from 'vitest';
import { notify } from '@/services/notify';
import { createCloneResourceHandler } from './cloneResourceHandler';
import type { PreviewResource } from '@/hooks/useCourseCloning';
import type { CourseReserve } from '@/store/courseReservesStore';

vi.mock('@/services/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/notify')>();
  return { ...actual, notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } };
});

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
    const addItem = vi.fn(() => ({ id: 'added-physical', title: 'Synthetic reserve book' } as never));
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

  it('announces a reused electronic item after it is added', () => {
    const handler = createCloneResourceHandler({ courseCode: 'BIO 101' } as CourseReserve, 'reserve-1', vi.fn(() => ({ id: 'new-item' } as never)));

    handler.handleAddSingleResource({
      type: 'electronic',
      title: 'Synthetic article',
      _originalResource: { url: 'https://example.test/article' },
    } as PreviewResource);

    expect(notify.success).toHaveBeenCalledWith('Added "Synthetic article"');
  });

  it('announces a duplicate item failure without exposing server details', () => {
    const handler = createCloneResourceHandler({ courseCode: 'BIO 101' } as CourseReserve, 'reserve-1', vi.fn(() => false));

    handler.handleAddSingleResource({
      type: 'electronic',
      title: 'Synthetic article',
      _originalResource: { url: 'https://example.test/article' },
    } as PreviewResource);

    expect(notify.error).toHaveBeenCalledWith('This item is already in your reserve list.');
  });
});
