import { describe, expect, it } from 'vitest';
import {
  addFolder,
  addItem,
  assertLayout,
  canMoveDown,
  canMoveUp,
  deleteFolder,
  fromLegacy,
  fromServer,
  moveDown,
  moveOutOfFolder,
  moveTo,
  moveUp,
  removeItem,
  toPayloadOrder,
} from './listLayout';
import type { ListLayoutState } from './listLayout';
import type { CourseFolder, CourseItem } from '@/store/reserve/types';

const item = (id: string, folderId?: string): CourseItem => ({
  id, title: id, folderId, materialType: 'other', status: 'draft',
});
const folder = (id: string, itemIds: string[] = []): CourseFolder => ({
  id, title: id, isOpen: true, itemIds,
});
const entry = (kind: 'folder' | 'item', id: string) => ({ kind, id } as const);

function layoutState(): ListLayoutState {
  return {
    layout: [entry('folder', 'week-1'), entry('item', 'loose-1'), entry('folder', 'week-2'), entry('item', 'loose-2')],
    folders: [folder('week-1', ['week-1-a', 'week-1-b']), folder('week-2')],
    items: [item('week-1-a', 'week-1'), item('week-1-b', 'week-1'), item('loose-1'), item('loose-2')],
  };
}

const topLevelIds = (state: ListLayoutState) => state.layout.map((item) => item.id);

describe('listLayout', () => {
  it('folder at 1, item at 2: up moves it to 1', () => {
    const state = layoutState();
    expect(topLevelIds(moveUp(state, 'loose-1'))).toEqual(['loose-1', 'week-1', 'week-2', 'loose-2']);
  });

  it('moves a folder or loose item by swapping with its top-level neighbor', () => {
    const state = layoutState();
    expect(topLevelIds(moveDown(state, 'week-1'))).toEqual(['loose-1', 'week-1', 'week-2', 'loose-2']);
    expect(topLevelIds(moveDown(state, 'loose-1'))).toEqual(['week-1', 'week-2', 'loose-1', 'loose-2']);
  });

  it('moves items inside their folder and leaves them in place at its ends', () => {
    const state = layoutState();
    expect(moveUp(state, 'week-1-b').folders[0].itemIds).toEqual(['week-1-b', 'week-1-a']);
    expect(moveDown(state, 'week-1-a').folders[0].itemIds).toEqual(['week-1-b', 'week-1-a']);
    expect(moveUp(state, 'week-1-a')).toBe(state);
    expect(moveDown(state, 'week-1-b')).toBe(state);
  });

  it('reports arrow capabilities from the shared layout order', () => {
    const state = layoutState();
    expect(canMoveUp(state, 'week-1')).toBe(false);
    expect(canMoveDown(state, 'week-1')).toBe(true);
    expect(canMoveUp(state, 'loose-2')).toBe(true);
    expect(canMoveDown(state, 'loose-2')).toBe(false);
    expect(canMoveUp(state, 'loose-1')).toBe(true);
    expect(canMoveUp(state, 'week-1-a')).toBe(false);
    expect(canMoveDown(state, 'week-1-a')).toBe(true);
    expect(canMoveUp(state, 'week-1-b')).toBe(true);
    expect(canMoveDown(state, 'week-1-b')).toBe(false);
  });

  it('item at 4 dropped before the folder at 3 goes to 3, not into the folder', () => {
    const state = {
      ...layoutState(),
      layout: [entry('item', 'loose-1'), entry('item', 'loose-2'), entry('folder', 'week-1'), entry('item', 'week-3')],
      items: [...layoutState().items, item('week-3')],
    };
    expect(topLevelIds(moveTo(state, 'week-3', { before: 'week-1' })))
      .toEqual(['loose-1', 'loose-2', 'week-3', 'week-1']);
  });

  it('inserts items before and after entries inside a folder', () => {
    const state = layoutState();
    expect(moveTo(state, 'loose-1', { before: 'week-1-b' }).folders[0].itemIds)
      .toEqual(['week-1-a', 'loose-1', 'week-1-b']);
    expect(moveTo(state, 'loose-2', { after: 'week-1-a' }).folders[0].itemIds)
      .toEqual(['week-1-a', 'loose-2', 'week-1-b']);
  });

  it('reorders an item relative to another item in its folder', () => {
    const next = moveTo(layoutState(), 'week-1-b', { before: 'week-1-a' });
    expect(next.folders[0].itemIds).toEqual(['week-1-b', 'week-1-a']);
  });

  it('moves an item into a folder and appends it by default', () => {
    const next = moveTo(layoutState(), 'loose-1', { intoFolder: 'week-1' });
    expect(next.folders[0].itemIds).toEqual(['week-1-a', 'week-1-b', 'loose-1']);
    expect(next.items.find((candidate) => candidate.id === 'loose-1')?.folderId).toBe('week-1');
    expect(next.layout).not.toContainEqual(entry('item', 'loose-1'));
  });

  it('moves an item to an explicit folder index or the end of the top-level list', () => {
    const state = layoutState();
    expect(moveTo(state, 'loose-1', { intoFolder: 'week-1', index: 1 }).folders[0].itemIds)
      .toEqual(['week-1-a', 'loose-1', 'week-1-b']);
    expect(topLevelIds(moveTo(state, 'loose-1', { end: true })))
      .toEqual(['week-1', 'week-2', 'loose-2', 'loose-1']);
  });

  it('does not allow folders to nest', () => {
    const state = layoutState();
    expect(moveTo(state, 'week-1', { intoFolder: 'week-2' })).toBe(state);
  });

  it('moves an item to the end of the top-level layout', () => {
    const next = moveTo(layoutState(), 'week-1-b', { end: true });
    expect(topLevelIds(next)).toEqual(['week-1', 'loose-1', 'week-2', 'loose-2', 'week-1-b']);
    expect(next.folders[0].itemIds).toEqual(['week-1-a']);
    expect(next.items.find((candidate) => candidate.id === 'week-1-b')?.folderId).toBeUndefined();
  });

  it('adds an item at the top level or to a requested folder', () => {
    const state = layoutState();
    const loose = addItem(state, item('new-loose'));
    expect(loose.layout.at(-1)).toEqual(entry('item', 'new-loose'));
    const nested = addItem(state, item('new-nested'), 'week-2');
    expect(nested.folders[1].itemIds).toEqual(['new-nested']);
    expect(nested.items.at(-1)?.folderId).toBe('week-2');
  });

  it('removes an item from every ordering collection and the item lookup', () => {
    const next = removeItem(layoutState(), 'week-1-a');
    expect(next.items.some((candidate) => candidate.id === 'week-1-a')).toBe(false);
    expect(next.folders[0].itemIds).not.toContain('week-1-a');
    expect(next.layout).not.toContainEqual(entry('item', 'week-1-a'));
  });

  it('moves a folder item out directly after its folder', () => {
    const next = moveOutOfFolder(layoutState(), 'week-1-b');
    expect(topLevelIds(next)).toEqual(['week-1', 'week-1-b', 'loose-1', 'week-2', 'loose-2']);
    expect(next.folders[0].itemIds).toEqual(['week-1-a']);
    expect(next.items.find((candidate) => candidate.id === 'week-1-b')?.folderId).toBeUndefined();
  });

  it('adds new folders at the top of the layout', () => {
    const next = addFolder(layoutState(), folder('week-3'));
    expect(next.layout[0]).toEqual(entry('folder', 'week-3'));
  });

  it('deletes a folder and leaves its items where the folder was in order', () => {
    const next = deleteFolder(layoutState(), 'week-1');
    expect(topLevelIds(next)).toEqual(['week-1-a', 'week-1-b', 'loose-1', 'week-2', 'loose-2']);
    expect(next.folders.map((candidate) => candidate.id)).toEqual(['week-2']);
    expect(next.items.filter((candidate) => candidate.id.startsWith('week-1-')).map((candidate) => candidate.folderId))
      .toEqual([undefined, undefined]);
  });

  it('creates API order fields from the single interleaved layout', () => {
    const order = toPayloadOrder(layoutState());
    expect(order.displayOrder).toEqual([
      { type: 'folder', id: 'week-1', displayPosition: 0 },
      { type: 'item', id: 'loose-1', displayPosition: 1 },
      { type: 'folder', id: 'week-2', displayPosition: 2 },
      { type: 'item', id: 'loose-2', displayPosition: 3 },
    ]);
    expect(order.folderOrder).toEqual({ 'week-1': 0, 'week-2': 2 });
    expect(order.resourceOrder).toEqual({
      'week-1-a': { displayOrder: 0, positionInFolder: 0 },
      'week-1-b': { displayOrder: 0, positionInFolder: 1 },
      'loose-1': { displayOrder: 1, positionInFolder: null },
      'loose-2': { displayOrder: 3, positionInFolder: null },
    });
    expect(order.orderedItemIds).toEqual(['week-1-a', 'week-1-b', 'loose-1', 'loose-2']);
  });

  it('round-trips interleaved server folders and loose items in display order', () => {
    const mapped = fromServer([
      { ...folder('week-1', ['week-1-a']), displayOrder: 0 },
      { ...folder('week-2', ['week-2-a']), displayOrder: 2 },
    ], [
      { ...item('week-1-a', 'week-1'), displayOrder: 0 },
      { ...item('loose-1'), displayOrder: 1 },
      { ...item('week-2-a', 'week-2'), displayOrder: 2 },
      { ...item('loose-2'), displayOrder: 3 },
    ]);
    expect(toPayloadOrder(mapped).displayOrder).toEqual([
      { type: 'folder', id: 'week-1', displayPosition: 0 },
      { type: 'item', id: 'loose-1', displayPosition: 1 },
      { type: 'folder', id: 'week-2', displayPosition: 2 },
      { type: 'item', id: 'loose-2', displayPosition: 3 },
    ]);
  });

  it('migrates the old folder-position and item-array order into the same visible order', () => {
    const migrated = fromLegacy(
      [
        { ...folder('week-2', ['old-nested']), position: 2 },
        { ...folder('week-1'), position: 0 },
      ],
      [item('loose-1'), item('old-nested', 'week-2'), item('loose-2')]
    );
    expect(topLevelIds(migrated)).toEqual(['week-1', 'loose-1', 'week-2', 'loose-2']);
    expect(migrated.folders.find((candidate) => candidate.id === 'week-2')?.itemIds).toEqual(['old-nested']);
    expect(assertLayout(migrated)).toBe(true);
  });

  it('rejects duplicate, missing, or unknown ids in the layout invariant', () => {
    const state = layoutState();
    expect(assertLayout(state)).toBe(true);
    expect(() => assertLayout({ ...state, layout: [...state.layout, entry('folder', 'week-1')] })).toThrow(/duplicate folder/i);
    expect(() => assertLayout({ ...state, layout: state.layout.slice(1) })).toThrow(/missing folder/i);
    expect(() => assertLayout({ ...state, folders: [folder('week-1', ['unknown']), state.folders[1]] })).toThrow(/unknown item/i);
  });
});
