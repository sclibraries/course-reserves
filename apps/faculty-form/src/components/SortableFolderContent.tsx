import { useDroppable } from '@dnd-kit/core';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SortableItem } from './SortableItem';
import { X } from 'lucide-react';
import type { CourseFolder, CourseItem } from '../store/courseReservesStore';

interface SortableFolderContentProps {
  folder: CourseFolder;
  isDraggingItem: boolean;
  newItemIds: string[];
  onEditItem: (item: CourseItem) => void;
  onDeleteItem: (itemId: string) => void;
  onRemoveItemFromFolder: (itemId: string) => void;
  onMoveItemInFolder?: (folderId: string, itemId: string, direction: 'up' | 'down') => void;
}

interface FolderDropzoneProps {
  id: string;
  folder: CourseFolder;
  label: string;
  compact?: boolean;
}

function FolderDropzone({ id, folder, label, compact = false }: FolderDropzoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'FolderDropzone', folder },
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-dashed px-3 text-sm transition-colors ${
        compact ? 'py-2' : 'py-4'
      } ${
        isOver
          ? 'border-blue-500 bg-blue-100 text-blue-800'
          : 'border-blue-300 bg-blue-50/80 text-blue-700'
      }`}
    >
      {label}
    </div>
  );
}

export function SortableFolderContent({
  folder,
  isDraggingItem,
  newItemIds,
  onEditItem,
  onDeleteItem,
  onRemoveItemFromFolder,
  onMoveItemInFolder,
}: SortableFolderContentProps) {
  const headerDropzoneId = `folder-dropzone-${folder.id}-top`;
  const footerDropzoneId = `folder-dropzone-${folder.id}-bottom`;
  const emptyDropzoneId = `folder-dropzone-${folder.id}-empty`;

  return (
    <>
      {isDraggingItem && (
        <CardContent className="pt-0 pb-3">
          <FolderDropzone
            id={headerDropzoneId}
            folder={folder}
            compact
            label={`Drop here to add an item to ${folder.title}`}
          />
        </CardContent>
      )}

      {folder.isOpen && (
        <CardContent className="pt-0">
          {folder.items.length > 0 ? (
            <div className="space-y-2 ml-4 border-l border-muted pl-4">
              {folder.items.map((item, itemIndex) => (
                <div key={item.id} className="relative">
                  <SortableItem
                    item={item}
                    isNew={newItemIds.includes(item.id)}
                    index={itemIndex}
                    totalItems={folder.items.length}
                    onEdit={onEditItem}
                    onDelete={onDeleteItem}
                    canMoveUp={itemIndex > 0}
                    canMoveDown={itemIndex < folder.items.length - 1}
                    onMoveUp={onMoveItemInFolder
                      ? () => onMoveItemInFolder(folder.id, item.id, 'up')
                      : undefined}
                    onMoveDown={onMoveItemInFolder
                      ? () => onMoveItemInFolder(folder.id, item.id, 'down')
                      : undefined}
                    isDragDisabled
                    availableFolders={[]}
                    onRemoveFromFolder={onRemoveItemFromFolder}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 hover:opacity-100 focus:opacity-100 bg-background/80 hover:bg-background"
                    onClick={() => onRemoveItemFromFolder(item.id)}
                    title="Remove from folder"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}

              {isDraggingItem && (
                <FolderDropzone
                  id={footerDropzoneId}
                  folder={folder}
                  compact
                  label={`Drop here to add to ${folder.title}`}
                />
              )}
            </div>
          ) : (
            <div className="ml-4">
              {isDraggingItem ? (
                <FolderDropzone
                  id={emptyDropzoneId}
                  folder={folder}
                  label={`Drop an item here to add it to ${folder.title}`}
                />
              ) : (
                <div className="p-4 border border-dashed border-muted rounded-lg text-center text-sm text-muted-foreground">
                  No items in this folder yet. Drag items here or use the folder actions.
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </>
  );
}
