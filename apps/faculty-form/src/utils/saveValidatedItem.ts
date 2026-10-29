import { notify } from '@/services/notify';
import type { ItemData } from '@/components/ItemModal/itemFormData';
import { validateReserveItem } from './reserveValidation';

export function saveValidatedItem(item: ItemData, onSave: (item: ItemData) => void | boolean): boolean {
  const validation = validateReserveItem(item);
  if (!validation.valid) {
    notify.error(validation.errors[0], { reference: 'unavailable' });
    return false;
  }
  return onSave(item) !== false;
}
