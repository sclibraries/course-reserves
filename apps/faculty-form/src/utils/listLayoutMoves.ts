import type { CourseFolder } from '@/store/reserve/types';
import type { ListLayoutState, MoveTarget } from './listLayoutTypes';

export function canMoveUp(state: ListLayoutState, id: string): boolean {
  const topIndex = state.layout.findIndex((entry) => entry.id === id);
  if (topIndex >= 0) return topIndex > 0;
  const folder = state.folders.find((candidate) => candidate.itemIds.includes(id));
  return !!folder && folder.itemIds.indexOf(id) > 0;
}

export function canMoveDown(state: ListLayoutState, id: string): boolean {
  const topIndex = state.layout.findIndex((entry) => entry.id === id);
  if (topIndex >= 0) return topIndex < state.layout.length - 1;
  const folder = state.folders.find((candidate) => candidate.itemIds.includes(id));
  return !!folder && folder.itemIds.indexOf(id) < folder.itemIds.length - 1;
}

export function moveUp(state: ListLayoutState, id: string): ListLayoutState {
  const topIndex = state.layout.findIndex((entry) => entry.id === id);
  if (topIndex > 0) return swapTopLevel(state, topIndex, topIndex - 1);
  if (topIndex === 0) return state;
  const folder = state.folders.find((candidate) => candidate.itemIds.includes(id));
  return folder ? moveFolderItem(state, folder, id, -1) : state;
}

export function moveDown(state: ListLayoutState, id: string): ListLayoutState {
  const topIndex = state.layout.findIndex((entry) => entry.id === id);
  if (topIndex >= 0) {
    return topIndex < state.layout.length - 1 ? swapTopLevel(state, topIndex, topIndex + 1) : state;
  }
  const folder = state.folders.find((candidate) => candidate.itemIds.includes(id));
  return folder ? moveFolderItem(state, folder, id, 1) : state;
}

export function moveTo(state: ListLayoutState, id: string, target: MoveTarget): ListLayoutState {
  const activeFolder = state.folders.find((folder) => folder.id === id);
  const activeItem = state.items.find((item) => item.id === id);
  if (!activeFolder && !activeItem) return state;
  if ('intoFolder' in target && activeFolder) return state;
  if (('before' in target && target.before === id) || ('after' in target && target.after === id)) return state;
  if ('intoFolder' in target && target.intoFolder === id) return state;

  const detached = detach(state, id);
  if (!detached) return state;

  let next: ListLayoutState | undefined;
  if ('intoFolder' in target) {
    const folder = detached.folders.find((candidate) => candidate.id === target.intoFolder);
    const item = detached.items.find((candidate) => candidate.id === id);
    if (!folder || !item) return state;
    const itemIds = folder.itemIds.slice();
    const insertAt = clamp(target.index ?? itemIds.length, 0, itemIds.length);
    itemIds.splice(insertAt, 0, id);
    next = {
      ...detached,
      folders: detached.folders.map((candidate) => candidate.id === folder.id
        ? { ...candidate, itemIds }
        : candidate),
      items: detached.items.map((candidate) => candidate.id === id
        ? { ...candidate, folderId: folder.id }
        : candidate),
    };
  } else if ('end' in target) {
    next = { ...detached, layout: [...detached.layout, { kind: activeFolder ? 'folder' : 'item', id }] };
  } else {
    const targetId = 'before' in target ? target.before : target.after;
    const targetFolder = detached.folders.find((folder) => folder.itemIds.includes(targetId));
    if (targetFolder) {
      if (activeFolder) return state;
      const itemIds = targetFolder.itemIds.slice();
      const targetIndex = itemIds.indexOf(targetId);
      itemIds.splice(targetIndex + ('after' in target ? 1 : 0), 0, id);
      next = {
        ...detached,
        folders: detached.folders.map((folder) => folder.id === targetFolder.id
          ? { ...folder, itemIds }
          : folder),
        items: detached.items.map((item) => item.id === id
          ? { ...item, folderId: targetFolder.id }
          : item),
      };
    } else {
      const targetIndex = detached.layout.findIndex((entry) => entry.id === targetId);
      if (targetIndex < 0) return state;
      const insertAt = targetIndex + ('after' in target ? 1 : 0);
      const layout = detached.layout.slice();
      layout.splice(insertAt, 0, { kind: activeFolder ? 'folder' : 'item', id });
      next = { ...detached, layout };
    }
  }

  return sameOrder(state, next) ? state : next;
}

function swapTopLevel(state: ListLayoutState, first: number, second: number): ListLayoutState {
  const layout = state.layout.slice();
  [layout[first], layout[second]] = [layout[second], layout[first]];
  return { ...state, layout };
}

function moveFolderItem(
  state: ListLayoutState,
  folder: CourseFolder,
  id: string,
  direction: -1 | 1
): ListLayoutState {
  const index = folder.itemIds.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= folder.itemIds.length) return state;
  const itemIds = folder.itemIds.slice();
  [itemIds[index], itemIds[target]] = [itemIds[target], itemIds[index]];
  return {
    ...state,
    folders: state.folders.map((candidate) => candidate.id === folder.id
      ? { ...candidate, itemIds }
      : candidate),
  };
}

function detach(state: ListLayoutState, id: string): ListLayoutState | undefined {
  const folder = state.folders.find((candidate) => candidate.id === id);
  if (folder) return { ...state, layout: state.layout.filter((entry) => entry.id !== id) };
  if (!state.items.some((item) => item.id === id)) return undefined;
  return {
    ...state,
    layout: state.layout.filter((entry) => entry.id !== id),
    folders: state.folders.map((candidate) => ({
      ...candidate,
      itemIds: candidate.itemIds.filter((itemId) => itemId !== id),
    })),
    items: state.items.map((candidate) => candidate.id === id
      ? { ...candidate, folderId: undefined }
      : candidate),
  };
}

function sameOrder(left: ListLayoutState, right: ListLayoutState): boolean {
  return JSON.stringify(left.layout) === JSON.stringify(right.layout) &&
    JSON.stringify(left.folders.map(({ id, itemIds }) => ({ id, itemIds }))) ===
      JSON.stringify(right.folders.map(({ id, itemIds }) => ({ id, itemIds }))) &&
    left.items.every((item) => item.folderId === right.items.find((candidate) => candidate.id === item.id)?.folderId);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
