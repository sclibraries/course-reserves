import { describe, expect, it } from 'vitest';
import type { CourseFolder, CourseItem } from '@/store/courseReservesStore';
import { moveFolderInMixedList } from './moveFolderInMixedList';

describe('moveFolderInMixedList', () => {
  it('moves a folder from the first position to the last across folders and items', () => {
    const folders = [
      folder('folder-first', -1),
      folder('folder-middle', 0.5),
      folder('folder-last', 1.5),
    ];
    const items = [item('item-first'), item('item-middle'), item('item-last')];

    const moved = moveFolderInMixedList(folders, items, 'folder-first', 'item-last');

    expect(displayOrder(moved, items)).toEqual([
      'item-first',
      'folder-middle',
      'item-middle',
      'folder-last',
      'item-last',
      'folder-first',
    ]);
  });

  it('moves a folder from the last position to the first position', () => {
    const folders = [folder('folder-first', -1), folder('folder-last', 0.5)];
    const items = [item('item-first'), item('item-last')];

    const moved = moveFolderInMixedList(folders, items, 'folder-last', 'folder-first');

    expect(displayOrder(moved, items)).toEqual([
      'folder-last',
      'folder-first',
      'item-first',
      'item-last',
    ]);
  });
});

function folder(id: string, position: number): CourseFolder {
  return { id, title: id, isOpen: true, position, items: [] };
}

function item(id: string): CourseItem {
  return { id, title: id, materialType: 'article', status: 'draft' };
}

function displayOrder(folders: CourseFolder[], items: CourseItem[]) {
  return [
    ...folders.map((entry) => ({ id: entry.id, position: entry.position ?? 1000 })),
    ...items.map((entry, index) => ({ id: entry.id, position: index })),
  ].sort((left, right) => left.position - right.position).map(({ id }) => id);
}
