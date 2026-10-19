import { describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { createItemHandlers } from './itemHandlers';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe('createItemHandlers search ordering guard', () => {
  it('blocks arrow moves while searching with the reorder message', () => {
    const moveItemInList = vi.fn(() => true);
    vi.mocked(toast.error).mockClear();
    const handlers = createItemHandlers(
      'reserve-1', vi.fn(), vi.fn(), vi.fn(), moveItemInList, vi.fn(), true, vi.fn(), vi.fn()
    );

    handlers.handleMoveUp('item-1');
    handlers.handleMoveDown('item-1');

    expect(moveItemInList).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenNthCalledWith(1, 'Clear the search to reorder.');
    expect(toast.error).toHaveBeenNthCalledWith(2, 'Clear the search to reorder.');
  });
});
