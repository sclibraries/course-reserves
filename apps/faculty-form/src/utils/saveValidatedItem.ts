import { toast } from 'sonner';
import type { ItemData } from '@/components/ItemModal/itemFormData';
import { validateReserveItem } from './reserveValidation';

export function saveValidatedItem(item: ItemData, onSave: (item: ItemData) => void | boolean): boolean {
  const validation = validateReserveItem(item);
  if (!validation.valid) {
    toast.error(validation.errors[0]);
    return false;
  }
  return onSave(item) !== false;
}
