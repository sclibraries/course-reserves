import { describe, expect, it } from 'vitest';
import { findFolderByName } from './folderNames';

const folders = [
  { id: 'folder-first', title: '  Week 1 ' },
  { id: 'folder-second', title: 'week 1' },
  { id: 'folder-third', title: 'Week 2' },
];

describe('findFolderByName', () => {
  it.each([
    ['  wEeK 1 ', undefined, 'folder-first'],
    ['week 1', 'folder-first', 'folder-second'],
    ['Week 3', undefined, undefined],
  ])('finds the first matching folder for %s, except %s', (name, exceptId, expectedId) => {
    expect(findFolderByName(folders, name, exceptId)?.id).toBe(expectedId);
  });
});
