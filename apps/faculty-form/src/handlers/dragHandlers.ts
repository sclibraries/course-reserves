import { toast } from 'sonner';
import type { DragEndEvent } from '@dnd-kit/core';
import type { MoveTarget } from '@/utils/listLayout';

type DragData = {
  type?: string;
  folder?: { id: string };
  item?: { id: string; folderId?: string };
  dropTarget?: MoveTarget;
};

export const createDragHandlers = (
  reserveId: string,
  moveTo: (reserveId: string, id: string, target: MoveTarget) => void,
  hasActiveFiltersOrSort: boolean
) => {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (hasActiveFiltersOrSort) {
      toast.error('Drag and drop is disabled when filters or sorting are applied. Clear filters to reorder items.');
      return;
    }

    const activeData = active.data.current as DragData | undefined;
    const overData = over.data.current as DragData | undefined;
    if (activeData?.type !== 'Folder' && activeData?.type !== 'Item') return;

    const target = overData?.dropTarget || keyboardFallbackTarget(activeData, overData);
    if (!target) return;

    moveTo(reserveId, String(active.id), target);
    toast.success('List order updated');
  };

  return { handleDragEnd };
};

function keyboardFallbackTarget(active: DragData, over?: DragData): MoveTarget | null {
  if (active.type === 'Folder') {
    const targetId = over?.folder?.id || (!over?.item?.folderId ? over?.item?.id : undefined);
    return targetId ? { before: targetId } : null;
  }
  if (over?.folder?.id) return { intoFolder: over.folder.id };
  return over?.item?.id ? { before: over.item.id } : null;
}
