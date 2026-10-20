import { SortableContext } from '@dnd-kit/sortable';
import type { SortingStrategy } from '@dnd-kit/sortable';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SortableItem } from './SortableItem';
import { X } from 'lucide-react';
import type { CourseFolder, CourseItem } from '../store/courseReservesStore';
import type { DiscoveryRecordReference } from '@/hooks/useOpenDiscoveryRecord';

interface SortableFolderContentProps {
  folder: CourseFolder & { items: CourseItem[] };
  newItemIds: string[];
  onEditItem: (item: CourseItem) => void;
  onDeleteItem: (itemId: string) => void;
  onViewFullRecord?: (record: DiscoveryRecordReference) => void;
  onRemoveItemFromFolder: (itemId: string) => void;
  onMoveItemInFolder: (folderId: string, itemId: string, direction: 'up' | 'down') => void;
  canMoveItemUp: (itemId: string) => boolean;
  canMoveItemDown: (itemId: string) => boolean;
  itemPositionById?: Map<string, number>;
  isDragDisabled?: boolean;
}

const noSortingStrategy: SortingStrategy = () => null;

export function SortableFolderContent({
  folder,
  newItemIds,
  onEditItem,
  onDeleteItem,
  onViewFullRecord,
  onRemoveItemFromFolder,
  onMoveItemInFolder,
  canMoveItemUp,
  canMoveItemDown,
  itemPositionById,
  isDragDisabled = false,
}: SortableFolderContentProps) {
  if (!folder.isOpen) return null;
  return (
    <CardContent className="pt-0">
      {folder.items.length > 0 ? (
        <SortableContext items={folder.items.map((item) => item.id)} strategy={noSortingStrategy}>
          <div className="space-y-2 ml-4 border-l border-muted pl-4">
            {folder.items.map((item, itemIndex) => {
              const itemPosition = itemPositionById?.get(item.id) ?? itemIndex;
              return (
                <div key={item.id} className="relative">
                  <SortableItem
                    item={item}
                    isNew={newItemIds.includes(item.id)}
                    isDragDisabled={isDragDisabled}
                    index={itemPosition}
                    positionLabel={`${folder.title} · ${itemPosition + 1}`}
                    totalItems={folder.items.length}
                    canMoveUp={canMoveItemUp(item.id)}
                    canMoveDown={canMoveItemDown(item.id)}
                    onEdit={onEditItem}
                    onDelete={onDeleteItem}
                    onViewFullRecord={onViewFullRecord}
                    onMoveUp={() => onMoveItemInFolder(folder.id, item.id, 'up')}
                    onMoveDown={() => onMoveItemInFolder(folder.id, item.id, 'down')}
                    availableFolders={[]}
                    onRemoveFromFolder={onRemoveItemFromFolder}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 z-30 h-6 w-6 p-0 opacity-0 hover:opacity-100 focus:opacity-100 bg-background/80 hover:bg-background"
                    onClick={() => onRemoveItemFromFolder(item.id)}
                    title="Remove from folder"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </SortableContext>
      ) : (
        <div className="ml-4 p-4 border border-dashed border-muted rounded-lg text-center text-sm text-muted-foreground">
          No items in this folder yet. Drag items here or use the folder actions.
        </div>
      )}
    </CardContent>
  );
}
