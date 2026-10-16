import type { CourseItem } from '@/store/courseReservesStore';

interface AddMaterialHandlerOptions {
  reserveId: string;
  addItem: (reserveId: string, item: Partial<CourseItem>) => boolean;
  markChanged: () => void;
  getLastAddedItem: () => CourseItem | undefined;
  onAdded?: (item: CourseItem) => void;
  defaultFolderId?: string;
}

export function createAddMaterialHandler({
  reserveId,
  addItem,
  markChanged,
  getLastAddedItem,
  onAdded,
  defaultFolderId,
}: AddMaterialHandlerOptions) {
  return (targetReserveId: string, item: Partial<CourseItem>): boolean => {
    if (targetReserveId !== reserveId) return false;
    const normalizedItem: Partial<CourseItem> = {
      ...item,
      title: item.title || 'Untitled',
      materialType: item.materialType || 'other',
      status: item.status || 'draft',
      ...(defaultFolderId ? { folderId: defaultFolderId } : {}),
    };
    if (!addItem(reserveId, normalizedItem)) return false;

    markChanged();
    const addedItem = getLastAddedItem();
    if (addedItem) onAdded?.(addedItem);
    return true;
  };
}
