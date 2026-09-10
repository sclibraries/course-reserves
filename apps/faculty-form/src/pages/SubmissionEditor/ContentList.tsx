import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { SortableFolder } from '@/components/SortableFolder';
import { SortableItem } from '@/components/SortableItem';
import { EmptyState } from '@/components/EmptyState';
import { ItemSortingToolbar } from '@/components/ItemSortingToolbar';
import type { SortOption, FilterOption } from '@/components/ItemSortingToolbar';
import { useSubmissionEditorContext } from './SubmissionEditorContext';

// Use ReturnType helpers to avoid duplicating type definitions
type OrgContent = ReturnType<typeof import('@/hooks/useContentOrganization').useOrganizedContent>;
type FilteredContent = ReturnType<typeof import('@/hooks/useContentOrganization').useFilteredAndSortedContent>;

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
    itemHandlers,
    folderHandlers,
    dragHandlers,
    removeItemFromFolder,
    moveItemInFolder,
    addItemToFolder,
    moveFolderPosition,
    duplicateSourceCourse,
    handleOpenCloneDialog,
    setDiscoverySearchOpen,
    setSyllabusUploadOpen,
  } = useSubmissionEditorContext();

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
          hasItems={reserve.items.length > 0}
          hasFolders={reserve.folders.length > 0}
          onAddItem={itemHandlers.handleAddItem}
          onCreateFolder={folderHandlers.handleCreateFolder}
          onClearFilters={resetFilters}
          onSearchLibrary={() => setDiscoverySearchOpen(true)}
          onPasteCitations={() => setSyllabusUploadOpen(true)}
          onUsePrevious={() => handleOpenCloneDialog('all', false)}
          hasPreviousCourse={duplicateSourceCourse !== null}
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
            collisionDetection={(args) => {
              const pointerCollisions = pointerWithin(args);
              if (pointerCollisions.length > 0) {
                return pointerCollisions;
              }

              return closestCenter(args);
            }}
            onDragEnd={dragHandlers.handleDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <SortableContext
              items={filteredAndSortedContent.mixedContent.map((item) =>
                item.type === 'folder' ? item.folder!.id : item.item!.id
              )}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {filteredAndSortedContent.mixedContent.map((contentItem, index) => {
                  if (contentItem.type === 'folder' && contentItem.folder) {
                    return (
                      <SortableFolder
                        key={contentItem.folder.id}
                        folder={contentItem.folder}
                        index={index}
                        totalFolders={filteredAndSortedContent.folders.length}
                        onEditItem={itemHandlers.handleEditItem}
                        onDeleteItem={itemHandlers.handleDeleteItem}
                        onUpdateFolder={folderHandlers.handleUpdateFolder}
                        onDeleteFolder={folderHandlers.handleDeleteFolder}
                        onToggleFolder={folderHandlers.handleToggleFolder}
                        onRemoveItemFromFolder={(itemId) => removeItemFromFolder(id, itemId)}
                        onMoveItemInFolder={(folderId, itemId, direction) =>
                          moveItemInFolder(id, folderId, itemId, direction)
                        }
                        onMoveFolderUp={
                          index > 0
                            ? () => moveFolderPosition(id, contentItem.folder!.id, 'up')
                            : undefined
                        }
                        onMoveFolderDown={
                          index < filteredAndSortedContent.mixedContent.length - 1
                            ? () => moveFolderPosition(id, contentItem.folder!.id, 'down')
                            : undefined
                        }
                        isDragDisabled={hasActiveFiltersOrSort}
                      />
                    );
                  } else if (contentItem.type === 'item' && contentItem.item) {
                    return (
                      <SortableItem
                        key={contentItem.item.id}
                        item={contentItem.item}
                        index={index}
                        totalItems={totalDisplayedItems}
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
