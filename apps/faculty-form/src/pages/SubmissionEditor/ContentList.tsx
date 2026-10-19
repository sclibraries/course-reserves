import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Trash2, Plus } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { SortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableFolder } from '@/components/SortableFolder';
import { SortableItem } from '@/components/SortableItem';
import { EmptyState } from '@/components/EmptyState';
import { ListSearchToolbar } from '@/components/ListSearchToolbar';
import { useSubmissionEditorContext } from './SubmissionEditorContext';
import { canMoveDown, canMoveUp } from '@/utils/listLayout';
import { getLayoutState } from '@/store/reserve/layoutState';
import { listCollisionDetection } from '@/utils/listCollisionDetection';
import type { OrganizedContent } from '@/utils/contentSearch';

const noSortingStrategy: SortingStrategy = () => null;

interface ContentListProps {
  organizedContent: OrganizedContent;
  filteredContent: OrganizedContent;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
}

export default function ContentList({
  organizedContent,
  filteredContent,
  searchQuery,
  setSearchQuery,
  isSearching,
}: ContentListProps) {
  const {
    id,
    reserve,
    hasPreviousOffering,
    addedMaterials,
    itemHandlers,
    folderHandlers,
    dragHandlers,
    removeItemFromFolder,
    moveItemInFolder,
    addItemToFolder,
    moveFolderPosition,
  } = useSubmissionEditorContext();
  const navigate = useNavigate();
  const newItemIds = addedMaterials.map((item) => item.id);
  const layout = getLayoutState(reserve);
  const itemPositionsByFolderId = new Map(organizedContent.folders.map((folder) => [
    folder.id,
    new Map(folder.items.map((item, index) => [item.id, index])),
  ]));
  const navigateToAddMaterials = (tab: string, folderId?: string) => {
    const params = new URLSearchParams({ tab });
    if (folderId) params.set('folder', folderId);
    navigate(`/submission/${id}/edit/add?${params.toString()}`);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const totalDisplayedItems =
    filteredContent.folders.reduce((acc, folder) => acc + folder.items.length, 0) +
    filteredContent.ungroupedItems.length;

  return (
    <>
      {(reserve.items.length > 0 || reserve.folders.length > 0) && (
        <div className="space-y-3">
          <ListSearchToolbar
            totalItems={reserve.items.length}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          {isSearching && (
            <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Clear the search to reorder.</span>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setSearchQuery('')}>
                Clear search
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => itemHandlers.handleClearAll(reserve.items.length, reserve.folders.length)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All
            </Button>
          </div>
        </div>
      )}

      {filteredContent.mixedContent.length === 0 ? (
        <EmptyState
          searchQuery={searchQuery}
          onAddItem={() => navigateToAddMaterials('type')}
          onClearSearch={() => setSearchQuery('')}
          onSearchLibrary={() => navigateToAddMaterials('search')}
          onPasteCitations={() => navigateToAddMaterials('paste')}
          onUsePrevious={() => navigateToAddMaterials('reuse')}
          hasPreviousCourse={hasPreviousOffering}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {filteredContent.folders.length} folders,{' '}
              {filteredContent.ungroupedItems.length} ungrouped items
            </span>
            <Button variant="outline" size="sm" onClick={folderHandlers.handleCreateFolder}>
              <Plus className="mr-2 h-4 w-4" />
              Create Folder
            </Button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={listCollisionDetection}
            onDragEnd={dragHandlers.handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={filteredContent.mixedContent.map((item) =>
                item.type === 'folder' ? item.folder.id : item.item.id
              )}
              strategy={noSortingStrategy}
            >
              <div className="space-y-3">
                {filteredContent.mixedContent.map((contentItem) => {
                  if (contentItem.type === 'folder') {
                    return (
                      <SortableFolder
                        key={contentItem.folder.id}
                        folder={contentItem.folder}
                        index={contentItem.position}
                        onEditItem={itemHandlers.handleEditItem}
                        onDeleteItem={itemHandlers.handleDeleteItem}
                        onUpdateFolder={folderHandlers.handleUpdateFolder}
                        onDeleteFolder={folderHandlers.handleDeleteFolder}
                        onToggleFolder={folderHandlers.handleToggleFolder}
                        onAddMaterials={(folderId) => navigateToAddMaterials('search', folderId)}
                        newItemIds={newItemIds}
                        onRemoveItemFromFolder={(itemId) => removeItemFromFolder(id, itemId)}
                        onMoveItemInFolder={(folderId, itemId, direction) =>
                          moveItemInFolder(id, folderId, itemId, direction)
                        }
                        canMoveFolderUp={!isSearching && canMoveUp(layout, contentItem.folder.id)}
                        canMoveFolderDown={!isSearching && canMoveDown(layout, contentItem.folder.id)}
                        canMoveItemUp={(itemId) => !isSearching && canMoveUp(layout, itemId)}
                        canMoveItemDown={(itemId) => !isSearching && canMoveDown(layout, itemId)}
                        itemPositionById={itemPositionsByFolderId.get(contentItem.folder.id)}
                        onMoveFolderUp={() => moveFolderPosition(id, contentItem.folder.id, 'up')}
                        onMoveFolderDown={() => moveFolderPosition(id, contentItem.folder.id, 'down')}
                        isDragDisabled={isSearching}
                      />
                    );
                  }
                  return (
                    <SortableItem
                      key={contentItem.item.id}
                      item={contentItem.item}
                      isNew={addedMaterials.some((added) => added.id === contentItem.item.id)}
                      index={contentItem.position}
                      totalItems={totalDisplayedItems}
                      canMoveUp={!isSearching && canMoveUp(layout, contentItem.item.id)}
                      canMoveDown={!isSearching && canMoveDown(layout, contentItem.item.id)}
                      onEdit={itemHandlers.handleEditItem}
                      onMoveUp={() => itemHandlers.handleMoveUp(contentItem.item.id)}
                      onMoveDown={() => itemHandlers.handleMoveDown(contentItem.item.id)}
                      onDelete={itemHandlers.handleDeleteItem}
                      isDragDisabled={isSearching}
                      availableFolders={organizedContent.folders}
                      onAddToFolder={(itemId, folderId) => addItemToFolder(id, folderId, itemId)}
                      onRemoveFromFolder={(itemId) => removeItemFromFolder(id, itemId)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </>
  );
}
