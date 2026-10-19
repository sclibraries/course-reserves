import { describe, expect, it } from 'vitest';
import type { CourseItem } from '@/store/courseReservesStore';
import { moveItemInList } from './moveItemInList';

describe('moveItemInList', () => {
  it('does not move the first item above its ungrouped container', () => {
    const items = [item('first'), item('second')];

    expect(moveItemInList(items, 'first', 'up')).toBe(items);
  });

  it('moves a middle item one place within its container', () => {
    const items = [item('first'), item('middle'), item('last')];

    expect(ids(moveItemInList(items, 'middle', 'down'))).toEqual(['first', 'last', 'middle']);
  });

  it('does not move the last item below its ungrouped container', () => {
    const items = [item('first'), item('last')];

    expect(moveItemInList(items, 'last', 'down')).toBe(items);
  });

  it.each([0, 1, 2])(
    'moves an ungrouped item one place when %i foldered items are between its neighbors',
    (folderItemsBetween) => {
      const items = [
        item('ungrouped-before'),
        ...Array.from({ length: folderItemsBetween }, (_, index) => item(`folder-item-${index}`, `folder-${index}`)),
        item('ungrouped-target'),
      ];

      const moved = moveItemInList(items, 'ungrouped-target', 'up');

      expect(moved.filter((entry) => !entry.folderId).map((entry) => entry.id))
        .toEqual(['ungrouped-target', 'ungrouped-before']);
      expect(moved.filter((entry) => entry.folderId).map((entry) => entry.id))
        .toEqual(Array.from({ length: folderItemsBetween }, (_, index) => `folder-item-${index}`));
    }
  );

  it('moves a foldered item within its own folder and leaves other containers in place', () => {
    const items = [
      item('folder-a-first', 'folder-a'),
      item('ungrouped'),
      item('folder-a-middle', 'folder-a'),
      item('folder-b-only', 'folder-b'),
      item('folder-a-last', 'folder-a'),
    ];

    const moved = moveItemInList(items, 'folder-a-middle', 'down');

    expect(moved.map((entry) => entry.id)).toEqual([
      'folder-a-first',
      'ungrouped',
      'folder-a-last',
      'folder-b-only',
      'folder-a-middle',
    ]);
  });

  it('keeps a foldered item at the edge of its own folder', () => {
    const items = [
      item('folder-a-first', 'folder-a'),
      item('folder-b-only', 'folder-b'),
      item('folder-a-last', 'folder-a'),
    ];

    expect(moveItemInList(items, 'folder-a-first', 'up')).toBe(items);
    expect(moveItemInList(items, 'folder-a-last', 'down')).toBe(items);
  });
});

function item(id: string, folderId?: string): CourseItem {
  return { id, title: id, materialType: 'article', status: 'draft', folderId };
}

function ids(items: CourseItem[]) {
  return items.map((entry) => entry.id);
}
