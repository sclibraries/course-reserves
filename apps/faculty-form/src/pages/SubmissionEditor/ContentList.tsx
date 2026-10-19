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
import { ItemSortingToolbar } from '@/components/ItemSortingToolbar';
import type { SortOption, FilterOption } from '@/components/ItemSortingToolbar';
import { useSubmissionEditorContext } from './SubmissionEditorContext';
import { canMoveDown, canMoveUp } from '@/utils/listLayout';
import { getLayoutState } from '@/store/reserve/layoutState';
import { listCollisionDetection } from '@/utils/listCollisionDetection';

// Use ReturnType helpers to avoid duplicating type definitions
type OrgContent = ReturnType<typeof import('@/hooks/useContentOrganization').useOrganizedContent>;
type FilteredContent = ReturnType<typeof import('@/hooks/useContentOrganization').useFilteredAndSortedContent>;
const noSortingStrategy: SortingStrategy = () => null;

interface ContentListProps {
  organizedContent: OrgContent;
  filteredAndSortedContent: FilteredContent;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filters: FilterOption;
  setFilters: (f: FilterOption) => void;
  resetFilters: () => void;
  hasActiveFiltersOrSort: boolean;
}

export default function ContentList({
  organizedContent,
  filteredAndSortedContent,
  sortBy,
  setSortBy,
  searchQuery,
  setSearchQuery,
  filters,
  setFilters,
  resetFilters,
  hasActiveFiltersOrSort,
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
    filteredAndSortedContent.folders.reduce((acc, folder) => acc + folder.items.length, 0) +
    filteredAndSortedContent.ungroupedItems.length;

  return (
    <>
      {(reserve.items.length > 0 || reserve.folders.length > 0) && (
        <div className="space-y-3">
          <ItemSortingToolbar
            totalItems={reserve.items.length}
            sortBy={sortBy}
            onSortChange={setSortBy}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={filters}
            onFiltersChange={setFilters}
            onResetFilters={resetFilters}
          />
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

      {totalDisplayedItems === 0 ? (
        <EmptyState
          hasItems={hasActiveFiltersOrSort && reserve.items.length > 0}
          hasFolders={hasActiveFiltersOrSort && reserve.folders.some((folder) => folder.itemIds.length > 0)}
          onAddItem={() => navigateToAddMaterials('type')}
          onCreateFolder={folderHandlers.handleCreateFolder}
          onClearFilters={resetFilters}
          onSearchLibrary={() => navigateToAddMaterials('search')}
          onPasteCitations={() => navigateToAddMaterials('paste')}
          onUsePrevious={() => navigateToAddMaterials('reuse')}
          hasPreviousCourse={hasPreviousOffering}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {filteredAndSortedContent.folders.length} folders,{' '}
              {filteredAndSortedContent.ungroupedItems.length} ungrouped items
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
              items={filteredAndSortedContent.mixedContent.map((item) =>
                item.type === 'folder' ? item.folder!.id : item.item!.id
              )}
              strategy={noSortingStrategy}
            >
              <div className="space-y-3">
                {filteredAndSortedContent.mixedContent.map((contentItem, index) => {
                  if (contentItem.type === 'folder' && contentItem.folder) {
                    return (
                      <SortableFolder
                        key={contentItem.folder.id}
                        folder={contentItem.folder}
                        index={index}
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
                        canMoveFolderUp={canMoveUp(layout, contentItem.folder.id)}
                        canMoveFolderDown={canMoveDown(layout, contentItem.folder.id)}
                        canMoveItemUp={(itemId) => canMoveUp(layout, itemId)}
                        canMoveItemDown={(itemId) => canMoveDown(layout, itemId)}
                        onMoveFolderUp={() => moveFolderPosition(id, contentItem.folder!.id, 'up')}
                        onMoveFolderDown={() => moveFolderPosition(id, contentItem.folder!.id, 'down')}
                        isDragDisabled={hasActiveFiltersOrSort}
                      />
                    );
                  } else if (contentItem.type === 'item' && contentItem.item) {
                    return (
                      <SortableItem
                        key={contentItem.item.id}
                        item={contentItem.item}
                        isNew={addedMaterials.some((added) => added.id === contentItem.item!.id)}
                        index={index}
                        totalItems={totalDisplayedItems}
                        canMoveUp={canMoveUp(layout, contentItem.item.id)}
                        canMoveDown={canMoveDown(layout, contentItem.item.id)}
                        onEdit={itemHandlers.handleEditItem}
                        onMoveUp={() => itemHandlers.handleMoveUp(contentItem.item!.id)}
                        onMoveDown={() => itemHandlers.handleMoveDown(contentItem.item!.id)}
                        onDelete={itemHandlers.handleDeleteItem}
                        isDragDisabled={hasActiveFiltersOrSort}
                        availableFolders={organizedContent.folders}
                        onAddToFolder={(itemId, folderId) => addItemToFolder(id, folderId, itemId)}
                        onRemoveFromFolder={(itemId) => removeItemFromFolder(id, itemId)}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </>
  );
}
