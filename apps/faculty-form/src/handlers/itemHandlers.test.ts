import { describe, expect, it, vi } from 'vitest';
import { createItemHandlers } from './itemHandlers';
import { notify } from '@/services/notify';

vi.mock('@/services/notify', () => ({ notify: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

describe('createItemHandlers search ordering guard', () => {
  it('blocks arrow moves while searching with the reorder message', () => {
    const moveItemInList = vi.fn(() => true);
    vi.mocked(notify.error).mockClear();
    const handlers = createItemHandlers(
      'reserve-1', vi.fn(), vi.fn(), vi.fn(), moveItemInList, vi.fn(), true, vi.fn(), vi.fn()
    );

    handlers.handleMoveUp('item-1');
    handlers.handleMoveDown('item-1');

    expect(moveItemInList).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenNthCalledWith(1, 'Clear the search to reorder.', { reference: 'unavailable' });
    expect(notify.error).toHaveBeenNthCalledWith(2, 'Clear the search to reorder.', { reference: 'unavailable' });
  });

  it('announces successful item moves by name', () => {
    const handlers = createItemHandlers(
      'reserve-1', vi.fn(), vi.fn(), vi.fn(), vi.fn(() => true), vi.fn(), false, vi.fn(), vi.fn()
    );

    handlers.handleMoveUp('item-1');
    handlers.handleMoveDown('item-2');

    expect(notify.success).toHaveBeenNthCalledWith(1, 'Item moved up');
    expect(notify.success).toHaveBeenNthCalledWith(2, 'Item moved down');
  });
});
