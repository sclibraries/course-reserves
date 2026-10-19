import type { CourseItem } from '@/store/courseReservesStore';

export function moveItemInList(
  items: CourseItem[],
  itemId: string,
  direction: 'up' | 'down'
): CourseItem[] {
  const itemIndex = items.findIndex((item) => item.id === itemId);
  if (itemIndex === -1) return items;

  const item = items[itemIndex];
  const sameContainerIndexes = items.reduce<number[]>((indexes, candidate, index) => {
    if (candidate.folderId === item.folderId) indexes.push(index);
    return indexes;
  }, []);
  const containerIndex = sameContainerIndexes.indexOf(itemIndex);
  const adjacentContainerIndex = containerIndex + (direction === 'up' ? -1 : 1);
  if (adjacentContainerIndex < 0 || adjacentContainerIndex >= sameContainerIndexes.length) {
    return items;
  }

  const adjacentItemIndex = sameContainerIndexes[adjacentContainerIndex];
  const reorderedItems = [...items];
  [reorderedItems[itemIndex], reorderedItems[adjacentItemIndex]] =
    [reorderedItems[adjacentItemIndex], reorderedItems[itemIndex]];

  return reorderedItems;
}
