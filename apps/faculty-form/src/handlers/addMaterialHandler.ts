import type { CourseItem } from '@/store/courseReservesStore';

interface AddMaterialHandlerOptions {
  reserveId: string;
  addItem: (reserveId: string, item: Partial<CourseItem>) => CourseItem | false;
  markChanged: () => void;
  onAdded?: (item: CourseItem) => void;
  defaultFolderId?: string;
}

export interface AddMaterialOptions {
  preserveFolder?: boolean;
}

export function createAddMaterialHandler({
  reserveId,
  addItem,
  markChanged,
  onAdded,
  defaultFolderId,
}: AddMaterialHandlerOptions) {
  return (targetReserveId: string, item: Partial<CourseItem>, options?: AddMaterialOptions): CourseItem | false => {
    if (targetReserveId !== reserveId) return false;
    const normalizedItem: Partial<CourseItem> = {
      ...item,
      title: item.title || 'Untitled',
      materialType: item.materialType || 'other',
      status: item.status || 'draft',
      ...(!options?.preserveFolder && defaultFolderId ? { folderId: defaultFolderId } : {}),
    };
    const addedItem = addItem(reserveId, normalizedItem);
    if (!addedItem) return false;

    markChanged();
    onAdded?.(addedItem);
    return addedItem;
  };
}
