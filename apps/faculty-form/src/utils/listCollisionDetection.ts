import { closestCenter, pointerWithin } from '@dnd-kit/core';
import type { CollisionDetection } from '@dnd-kit/core';
import { getDropZone } from './listDropZone';
import type { MoveTarget } from './listLayout';

export const listCollisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;
  if (activeType !== 'Folder' && activeType !== 'Item') return [];
  if (!args.pointerCoordinates) return closestCenter(args);

  return pointerWithin(args).filter((collision) => {
    const container = args.droppableContainers.find((entry) => entry.id === collision.id);
    const data = container?.data.current as {
      type?: string;
      dropTarget?: MoveTarget;
      targetKind?: 'folder' | 'item';
      targetFolderId?: string;
    } | undefined;
    if (data?.type !== 'drop-zone' || !data.dropTarget) return false;
    if (activeType === 'Folder') {
      if ('intoFolder' in data.dropTarget || (data.targetKind === 'item' && data.targetFolderId)) return false;
    }
    const targetId = targetIdentifier(data.dropTarget);
    const rowRect = args.droppableRects.get(targetId);
    const pointerY = args.pointerCoordinates?.y;
    if (!rowRect || pointerY === undefined || !data.targetKind) return false;
    const zone = getDropZone(rowRect, pointerY, data.targetKind);
    return ('intoFolder' in data.dropTarget && zone === 'into') ||
      ('before' in data.dropTarget && zone === 'before') ||
      ('after' in data.dropTarget && zone === 'after');
  });
};

function targetIdentifier(target: MoveTarget): string {
  if ('before' in target) return target.before;
  if ('after' in target) return target.after;
  if ('intoFolder' in target) return target.intoFolder;
  return '';
}
