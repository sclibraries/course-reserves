export type DropZone = 'before' | 'into' | 'after';
export type DropTargetKind = 'folder' | 'item';

export function getDropZone(
  rect: { top: number; bottom: number },
  pointerY: number,
  targetKind: DropTargetKind
): DropZone {
  const height = rect.bottom - rect.top;
  const relativePosition = height > 0 ? (pointerY - rect.top) / height : 0.5;

  if (targetKind === 'folder') {
    if (relativePosition <= 0.25) return 'before';
    if (relativePosition >= 0.75) return 'after';
    return 'into';
  }

  return relativePosition < 0.5 ? 'before' : 'after';
}
