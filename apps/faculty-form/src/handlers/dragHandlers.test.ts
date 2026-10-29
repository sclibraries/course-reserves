import { describe, expect, it, vi } from 'vitest';
import { createDragHandlers } from './dragHandlers';
import { notify } from '@/services/notify';

vi.mock('@/services/notify', () => ({ notify: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

describe('createDragHandlers', () => {
  it('applies the target zone once when an item drops into a folder', () => {
    const moveTo = vi.fn();
    const { handleDragEnd } = createDragHandlers('reserve-1', moveTo, false);

    handleDragEnd({
      active: { id: 'item-1', data: { current: { type: 'Item' } } },
      over: { id: 'folder-zone', data: { current: {
        type: 'drop-zone', dropTarget: { intoFolder: 'folder-1' },
      } } },
    } as never);

    expect(moveTo).toHaveBeenCalledTimes(1);
    expect(moveTo).toHaveBeenCalledWith('reserve-1', 'item-1', { intoFolder: 'folder-1' });
    expect(notify.success).toHaveBeenCalledWith('List order updated');
  });

  it('moves an item before a folder when the pointer is in its before zone', () => {
    const moveTo = vi.fn();
    const { handleDragEnd } = createDragHandlers('reserve-1', moveTo, false);

    handleDragEnd({
      active: { id: 'item-4', data: { current: { type: 'Item' } } },
      over: { id: 'folder-before', data: { current: {
        type: 'drop-zone', dropTarget: { before: 'folder-3' },
      } } },
    } as never);

    expect(moveTo).toHaveBeenCalledWith('reserve-1', 'item-4', { before: 'folder-3' });
  });

  it('moves an item after a folder when the pointer is in its after zone', () => {
    const moveTo = vi.fn();
    const { handleDragEnd } = createDragHandlers('reserve-1', moveTo, false);

    handleDragEnd({
      active: { id: 'item-1', data: { current: { type: 'Item' } } },
      over: { id: 'folder-after', data: { current: {
        type: 'drop-zone', dropTarget: { after: 'folder-1' },
      } } },
    } as never);

    expect(moveTo).toHaveBeenCalledWith('reserve-1', 'item-1', { after: 'folder-1' });
  });

  it('blocks drag while searching with the reorder message', () => {
    const moveTo = vi.fn();
    vi.mocked(notify.error).mockClear();
    const { handleDragEnd } = createDragHandlers('reserve-1', moveTo, true);

    handleDragEnd({
      active: { id: 'item-1', data: { current: { type: 'Item' } } },
      over: { id: 'item-2', data: { current: { type: 'Item' } } },
    } as never);

    expect(moveTo).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('Clear the search to reorder.');
  });
});
