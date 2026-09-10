import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/StatusBadge";
import { GripVertical, Edit2, ArrowUp, ArrowDown, Trash2, FolderPlus, FolderMinus } from "lucide-react";
import type { CourseItem, CourseFolder } from "../store/courseReservesStore";

interface SortableItemProps {
  item: CourseItem;
  index: number;
  totalItems: number;
  onEdit: (item: CourseItem) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: (itemId: string) => void;
  isDragDisabled?: boolean;
  availableFolders?: CourseFolder[];
  onAddToFolder?: (itemId: string, folderId: string) => void;
  onRemoveFromFolder?: (itemId: string) => void;
}

export const SortableItem = ({ 
  item, 
  index, 
  totalItems, 
  onEdit, 
  onMoveUp, 
  onMoveDown,
  onDelete,
  isDragDisabled = false,
  availableFolders = [],
  onAddToFolder,
  onRemoveFromFolder
}: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: item.id,
    disabled: isDragDisabled,
    data: {
      type: 'Item',
      item,
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? 'shadow-lg ring-2 ring-primary' : 'hover:shadow-md'}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Position indicator and drag handle */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Position number */}
            <div className="bg-primary/10 text-primary text-sm font-semibold rounded-full w-8 h-8 flex items-center justify-center">
              {index + 1}
            </div>
            
            {/* Drag handle */}
            <button
              {...attributes}
              {...(!isDragDisabled ? listeners : {})}
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

          {/* Item content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <h4 className="font-medium text-sm leading-tight">{item.title}</h4>
                {item.authors && (
                  <p className="text-sm text-muted-foreground mt-1">{item.authors}</p>
                )}
              </div>
              
              {/* Status badge */}
              <StatusBadge 
                status={
                  item.status === 'in-progress' ? 'partial' : 
                  item.status === 'needs-review' ? 'in-review' : 
                  item.status === 'complete' ? 'complete' : 'draft'
                } 
                className="text-xs flex-shrink-0"
              />
            </div>

            {/* Material type and additional info */}
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs capitalize">
                {item.materialType}
              </Badge>
            </div>

            {/* Additional metadata */}
            <div className="space-y-1">
              {item.isbn && (
                <p className="text-xs text-muted-foreground">ISBN: {item.isbn}</p>
              )}
              {item.journalTitle && (
                <p className="text-xs text-muted-foreground">
                  {item.journalTitle}
                  {item.volume && `, Vol. ${item.volume}`}
                  {item.issue && `, Issue ${item.issue}`}
                </p>
              )}
              {item.pages && (
                <p className="text-xs text-muted-foreground">Pages: {item.pages}</p>
              )}
            </div>

            {item.notes && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                Note: {item.notes}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-1">
            {/* Folder management buttons */}
            <div className="flex gap-1">
              {/* Add to folder or remove from folder */}
              {item.folderId ? (
                // Item is in a folder - show remove button
                onRemoveFromFolder && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                    onClick={() => onRemoveFromFolder(item.id)}
                    title="Remove from folder"
                  >
                    <FolderMinus className="h-3 w-3" />
                  </Button>
                )
              ) : (
                // Item is not in a folder - show add to folder dropdown
                availableFolders.length > 0 && onAddToFolder && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                        title="Add to folder"
                      >
                        <FolderPlus className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {availableFolders.map((folder) => (
                        <DropdownMenuItem
                          key={folder.id}
                          onClick={() => onAddToFolder(item.id, folder.id)}
                          className="cursor-pointer"
                        >
                          {folder.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              )}
            </div>
            
            {/* Precision ordering buttons */}
            <div className="flex gap-1">
              {index > 0 && onMoveUp && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={onMoveUp}
                  title="Move up"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
              )}
              {index < totalItems - 1 && onMoveDown && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={onMoveDown}
                  title="Move down"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              )}
            </div>
            
            {/* Edit button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onEdit(item)}
              title="Edit item"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            
            {/* Delete button */}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(item.id)}
                title="Delete item"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};