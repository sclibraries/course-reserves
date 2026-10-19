import { useDroppable } from '@dnd-kit/core';
import type { CourseFolder, CourseItem } from '@/store/courseReservesStore';
import type { MoveTarget } from '@/utils/listLayout';
import { FOLDER_DROP_EDGE_RATIO, ITEM_DROP_BEFORE_RATIO } from '@/utils/listDropZone';

const itemZoneHeight = `${ITEM_DROP_BEFORE_RATIO * 100}%`;
const folderMiddleHeight = `${(1 - 2 * FOLDER_DROP_EDGE_RATIO) * 100}%`;
const folderEdgeHeight = `${FOLDER_DROP_EDGE_RATIO * 100}%`;

function DropZone({
  id,
  target,
  label,
  className,
  targetKind,
  targetFolderId,
  style,
}: {
  id: string;
  target: MoveTarget;
  label?: string;
  className: string;
  targetKind: 'folder' | 'item';
  targetFolderId?: string;
  style?: { height?: string };
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'drop-zone', dropTarget: target, targetKind, targetFolderId },
  });
  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'border-blue-600 bg-blue-500/20 text-blue-900' : ''}`}
      aria-label={label}
      style={style}
    >
      {isOver && label}
    </div>
  );
}

export function ItemDropZones({ item }: { item: CourseItem }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col pointer-events-none">
      <DropZone
        id={`drop-item-${item.id}-before`}
        target={{ before: item.id }}
        targetKind="item"
        targetFolderId={item.folderId}
        className="border-t-2 border-transparent pointer-events-auto"
        style={{ height: itemZoneHeight }}
      />
      <DropZone
        id={`drop-item-${item.id}-after`}
        target={{ after: item.id }}
        targetKind="item"
        targetFolderId={item.folderId}
        className="border-b-2 border-transparent pointer-events-auto"
        style={{ height: itemZoneHeight }}
      />
    </div>
  );
}

export function FolderDropZones({ folder }: { folder: CourseFolder }) {
  return (
    <div
      className="absolute inset-0 z-20 grid pointer-events-none"
      style={{ gridTemplateRows: `${folderEdgeHeight} ${folderMiddleHeight} ${folderEdgeHeight}` }}
    >
      <DropZone
        id={`drop-folder-${folder.id}-before`}
        target={{ before: folder.id }}
        targetKind="folder"
        className="border-t-2 border-transparent pointer-events-auto"
      />
      <DropZone
        id={`drop-folder-${folder.id}-into`}
        target={{ intoFolder: folder.id }}
        targetKind="folder"
        label={`Drop into ${folder.title}`}
        className="flex items-center justify-center rounded bg-blue-50/80 text-sm font-medium text-blue-700 pointer-events-auto"
      />
      <DropZone
        id={`drop-folder-${folder.id}-after`}
        target={{ after: folder.id }}
        targetKind="folder"
        className="border-b-2 border-transparent pointer-events-auto"
      />
    </div>
  );
}
