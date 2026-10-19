import { describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { createDragHandlers } from './dragHandlers';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

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
    vi.mocked(toast.error).mockClear();
    const { handleDragEnd } = createDragHandlers('reserve-1', moveTo, true);

    handleDragEnd({
      active: { id: 'item-1', data: { current: { type: 'Item' } } },
      over: { id: 'item-2', data: { current: { type: 'Item' } } },
    } as never);

    expect(moveTo).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Clear the search to reorder.');
  });
});
