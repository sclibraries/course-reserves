import { describe, expect, it, vi } from 'vitest';
import { notify } from '@/services/notify';
import { saveValidatedItem } from './saveValidatedItem';

vi.mock('@/services/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/notify')>();
  return { ...actual, notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } };
});

const item = { title: 'Synthetic reading', materialType: 'Book' } as never;

describe('saveValidatedItem', () => {
  it('passes a valid item to the save action', () => {
    const onSave = vi.fn();

    expect(saveValidatedItem(item, onSave)).toBe(true);
    expect(onSave).toHaveBeenCalledWith(item);
  });

  it('shows the validation message and does not save an invalid item', () => {
    const onSave = vi.fn();

    expect(saveValidatedItem({ title: '', materialType: 'Book' } as never, onSave)).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('Item title is required.', { reference: 'unavailable' });
  });
});
