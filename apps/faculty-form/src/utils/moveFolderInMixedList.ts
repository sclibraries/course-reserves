import type { CourseFolder, CourseItem } from '@/store/courseReservesStore';

type ListEntry =
  | { type: 'folder'; id: string; position: number }
  | { type: 'item'; id: string; position: number };

export function moveFolderInMixedList(
  folders: CourseFolder[],
  items: CourseItem[],
  folderId: string,
  targetContentId: string
): CourseFolder[] {
  const ungroupedItems = items.filter((item) => !item.folderId);
  const orderedContent: ListEntry[] = [
    ...folders.map((folder, index) => ({
      type: 'folder' as const,
      id: folder.id,
      position: folder.position ?? (1000 + index),
    })),
    ...ungroupedItems.map((item, index) => ({ type: 'item' as const, id: item.id, position: index })),
  ].sort((left, right) => left.position - right.position);

  const sourceIndex = orderedContent.findIndex((entry) => entry.type === 'folder' && entry.id === folderId);
  const targetIndex = orderedContent.findIndex((entry) => entry.id === targetContentId);
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return folders;

  const [movingFolder] = orderedContent.splice(sourceIndex, 1);
  orderedContent.splice(targetIndex, 0, movingFolder);

  const folderCountsBySlot = new Map<number, number>();
  let itemsBefore = 0;
  orderedContent.forEach((entry) => {
    if (entry.type === 'item') {
      itemsBefore += 1;
      return;
    }
    folderCountsBySlot.set(itemsBefore, (folderCountsBySlot.get(itemsBefore) || 0) + 1);
  });

  const foldersUsedBySlot = new Map<number, number>();
  const positionsByFolderId = new Map<string, number>();
  itemsBefore = 0;
  orderedContent.forEach((entry) => {
    if (entry.type === 'item') {
      itemsBefore += 1;
      return;
    }

    const folderNumber = (foldersUsedBySlot.get(itemsBefore) || 0) + 1;
    foldersUsedBySlot.set(itemsBefore, folderNumber);
    const previousItemPosition = itemsBefore === 0 ? -1 : itemsBefore - 1;
    const slotSize = folderCountsBySlot.get(itemsBefore) || 0;
    positionsByFolderId.set(entry.id, previousItemPosition + folderNumber / (slotSize + 1));
  });

  return folders.map((folder) => {
    const position = positionsByFolderId.get(folder.id);
    return position === undefined ? folder : { ...folder, position };
  });
}
