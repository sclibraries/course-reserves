import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDndContext } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  GripVertical, 
  ChevronDown, 
  ChevronRight, 
  FolderOpen, 
  FolderClosed,
  Edit2, 
  Trash2, 
  Check,
  X,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { SortableFolderContent } from './SortableFolderContent';
import { FolderDropZones } from './ListDropZones';
import type { CourseFolder, CourseItem } from "../store/courseReservesStore";
import type { DiscoveryRecordReference } from '@/hooks/useOpenDiscoveryRecord';

interface SortableFolderProps {
  folder: CourseFolder & { items: CourseItem[] };
  index: number;
  onEditItem: (item: CourseItem) => void;
  onDeleteItem: (itemId: string) => void;
  onViewFullRecord?: (record: DiscoveryRecordReference) => void;
  onUpdateFolder: (folderId: string, updates: Partial<Pick<CourseFolder, 'title' | 'description' | 'isOpen'>>) => void;
  onDeleteFolder: (folderId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onAddMaterials?: (folderId: string) => void;
  newItemIds?: string[];
  onRemoveItemFromFolder: (itemId: string) => void;
  onMoveItemInFolder: (folderId: string, itemId: string, direction: 'up' | 'down') => void;
  onMoveFolderUp: () => void;
  onMoveFolderDown: () => void;
  canMoveFolderUp: boolean;
  canMoveFolderDown: boolean;
  canMoveItemUp: (itemId: string) => boolean;
  canMoveItemDown: (itemId: string) => boolean;
  itemPositionById?: Map<string, number>;
  isDragDisabled?: boolean;
}

export const SortableFolder = ({ 
  folder,
  index,
  onEditItem,
  onDeleteItem,
  onViewFullRecord,
  onUpdateFolder,
  onDeleteFolder,
  onToggleFolder,
  onAddMaterials,
  newItemIds = [],
  onRemoveItemFromFolder,
  onMoveItemInFolder,
  onMoveFolderUp,
  onMoveFolderDown,
  canMoveFolderUp,
  canMoveFolderDown,
  canMoveItemUp,
  canMoveItemDown,
  itemPositionById,
  isDragDisabled = false
}: SortableFolderProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: folder.id,
    disabled: isDragDisabled,
    data: {
      type: 'Folder',
      folder,
    }
  });
  const { active } = useDndContext();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState(folder.title);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSaveTitle = () => {
    if (editingTitle.trim() && editingTitle !== folder.title) {
      onUpdateFolder(folder.id, { title: editingTitle.trim() });
    } else {
      setEditingTitle(folder.title);
    }
    setIsEditingTitle(false);
  };

  const handleCancelEdit = () => {
    setEditingTitle(folder.title);
    setIsEditingTitle(false);
  };

  const handleToggle = () => {
    onToggleFolder(folder.id);
  };

  return (
    <Card
      style={style}
      className={`group relative border-l-4 border-l-blue-500 ${
        isDragging 
          ? 'shadow-lg ring-2 ring-primary' 
          : 'hover:shadow-md'
      }`}
    >
      <CardHeader ref={setNodeRef} className="relative pb-3">
        <div className="flex items-center gap-3">
          {/* Position indicator and drag handle */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Position number */}
            <div className="bg-blue-500/10 text-blue-600 text-sm font-semibold rounded-full w-8 h-8 flex items-center justify-center">
              {index + 1}
            </div>
            
            {/* Drag handle */}
            <button
              {...attributes}
              {...(!isDragDisabled ? listeners : {})}
              aria-label="Reorder folder"
              className={`p-1 transition-colors ${
                isDragDisabled 
                  ? 'cursor-not-allowed text-muted-foreground/50' 
                  : 'cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground'
              }`}
              disabled={isDragDisabled}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>

          {/* Folder toggle and icon */}
          <button
            onClick={handleToggle}
            aria-expanded={folder.isOpen}
            className="flex items-center gap-2 flex-1 min-w-0 hover:bg-muted/50 rounded p-1 -m-1"
          >
            {folder.isOpen ? (
              <>
                <ChevronDown className="h-4 w-4 text-blue-600" />
                <FolderOpen className="h-5 w-5 text-blue-600" />
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4 text-blue-600" />
                <FolderClosed className="h-5 w-5 text-blue-600" />
              </>
            )}
            
            <span className="font-medium text-sm flex-1 text-left truncate">
              {folder.title} ({folder.items.length} items)
            </span>
          </button>

          {/* Action buttons */}
          <div className="flex gap-1">
            {onAddMaterials && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(event) => {
                  event.stopPropagation();
                  onAddMaterials(folder.id);
                }}
              >
                Add materials
              </Button>
            )}
            {/* Move folder up/down buttons */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 disabled:opacity-40"
              onClick={(e) => {
                e.stopPropagation();
                onMoveFolderUp();
              }}
              disabled={!canMoveFolderUp}
              title="Move folder up"
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 disabled:opacity-40"
              onClick={(e) => {
                e.stopPropagation();
                onMoveFolderDown();
              }}
              disabled={!canMoveFolderDown}
              title="Move folder down"
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
            
            {/* Edit title button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
              aria-label="Edit folder name"
              title="Edit folder name"
            >
              <Edit2 className="h-3 w-3" />
            </Button>

            {isEditingTitle && (
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSaveTitle();
                }}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) handleSaveTitle();
                }}
              >
                <Input
                  aria-label="Folder name"
                  value={editingTitle}
                  onChange={(event) => setEditingTitle(event.target.value)}
                  className="h-6 w-40 text-sm font-medium"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') handleCancelEdit();
                  }}
                />
                <Button type="submit" size="sm" variant="ghost" className="h-6 w-6 p-0" aria-label="Save folder name">
                  <Check className="h-3 w-3" />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleCancelEdit} aria-label="Cancel folder name edit">
                  <X className="h-3 w-3" />
                </Button>
              </form>
            )}
            
            {/* Delete folder button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete folder "${folder.title}" and move all items out of the folder?`)) {
                  onDeleteFolder(folder.id);
                }
              }}
              title="Delete folder"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {active && <FolderDropZones folder={folder} />}
      </CardHeader>

      <SortableFolderContent
        folder={folder}
        newItemIds={newItemIds}
        onEditItem={onEditItem}
        onDeleteItem={onDeleteItem}
        onViewFullRecord={onViewFullRecord}
        onRemoveItemFromFolder={onRemoveItemFromFolder}
        onMoveItemInFolder={onMoveItemInFolder}
        canMoveItemUp={canMoveItemUp}
        canMoveItemDown={canMoveItemDown}
        itemPositionById={itemPositionById}
        isDragDisabled={isDragDisabled}
      />
    </Card>
  );
};
