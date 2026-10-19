export type DropZone = 'before' | 'into' | 'after';
export type DropTargetKind = 'folder' | 'item';
export const FOLDER_DROP_EDGE_RATIO = 0.25;
export const ITEM_DROP_BEFORE_RATIO = 0.5;

export function getDropZone(
  rect: { top: number; bottom: number },
  pointerY: number,
  targetKind: DropTargetKind
): DropZone {
  const height = rect.bottom - rect.top;
  const relativePosition = height > 0 ? (pointerY - rect.top) / height : 0.5;

  if (targetKind === 'folder') {
    if (relativePosition <= FOLDER_DROP_EDGE_RATIO) return 'before';
    if (relativePosition >= 1 - FOLDER_DROP_EDGE_RATIO) return 'after';
    return 'into';
  }

  return relativePosition < ITEM_DROP_BEFORE_RATIO ? 'before' : 'after';
}
