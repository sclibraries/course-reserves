import { toast } from "sonner";
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import type { CourseItem } from "../store/courseReservesStore";

/**
 * Handlers for drag and drop operations
 */
export const createDragHandlers = (
  reserveId: string,
  items: CourseItem[],
  reorderItems: (id: string, itemIds: string[]) => void,
  addItemToFolder: (id: string, folderId: string, itemId: string) => void,
  hasActiveFiltersOrSort: boolean,
  moveFolderToPosition?: (id: string, folderId: string, targetContentId: string) => void
) => {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    // Only allow drag and drop when using the original order (no sorting/filtering that changes order)
    const isOriginalOrder = !hasActiveFiltersOrSort;

    if (!isOriginalOrder) {
      toast.error("Drag and drop is disabled when filters or sorting are applied. Clear filters to reorder items.");
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current as {
      type?: string;
      folder?: { id: string };
      item?: { id: string; folderId?: string };
    } | undefined;

    const targetFolderId = resolveFolderDropTarget(overData);

    // Handle dropping an item into a folder (rely on droppable data, not string parsing)
    if (activeData?.type === 'Item' && targetFolderId) {
      const itemId = active.id.toString();

      addItemToFolder(reserveId, targetFolderId, itemId);
      toast.success(`Item moved to folder`);
      return;
    }

    // Handle folder drag and drop
    if (activeData?.type === 'Folder') {
      const targetContentId = resolveFolderReorderTarget(overData);
      if (targetContentId && moveFolderToPosition) {
        moveFolderToPosition(reserveId, active.id.toString(), targetContentId);
      }
      return;
    }

    // Handle reordering items (existing logic)
    if (activeData?.type === 'Item' && overData?.type === 'Item') {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedItems = arrayMove(items, oldIndex, newIndex);
        reorderItems(reserveId, reorderedItems.map(item => item.id));
        toast.success("Items reordered successfully");
      }
    }
  };

  return { handleDragEnd };
};

function resolveFolderDropTarget(overData?: {
  type?: string;
  folder?: { id: string };
  item?: { id: string; folderId?: string };
}): string | null {
  if (!overData) {
    return null;
  }

  if ((overData.type === 'Folder' || overData.type === 'FolderDropzone') && overData.folder?.id) {
    return overData.folder.id;
  }

  if (overData.type === 'Item' && overData.item?.folderId) {
    return overData.item.folderId;
  }

  return null;
}

function resolveFolderReorderTarget(overData?: {
  type?: string;
  folder?: { id: string };
  item?: { id: string; folderId?: string };
}): string | null {
  if (overData?.type === 'Folder') return overData.folder?.id || null;
  if (overData?.type === 'Item' && !overData.item?.folderId) return overData.item.id;
  return null;
}
