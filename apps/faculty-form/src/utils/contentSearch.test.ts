import { describe, expect, it } from 'vitest';
import { filterContentBySearch, type OrganizedContent } from './contentSearch';

const looseBook = { id: 'loose-book', title: 'Sea Change', authors: 'A. Writer', materialType: 'book' };
const folderBook = { id: 'folder-book', title: 'Ocean Life', authors: 'B. Writer', materialType: 'chapter' };
const folderVideo = { id: 'folder-video', title: 'Coastal Film', authors: 'C. Writer', materialType: 'video' };
const content: OrganizedContent = {
  folders: [
    { id: 'folder-1', title: 'Week 1', itemIds: [folderBook.id, folderVideo.id], items: [folderBook, folderVideo] },
  ],
  ungroupedItems: [looseBook],
  mixedContent: [
    { type: 'item', item: looseBook, position: 0 },
    {
      type: 'folder',
      folder: { id: 'folder-1', title: 'Week 1', itemIds: [folderBook.id, folderVideo.id], items: [folderBook, folderVideo] },
      position: 1,
    },
  ],
};

describe('filterContentBySearch', () => {
  it('filters loose items by title, author, and material type', () => {
    expect(filterContentBySearch(content, 'writer').ungroupedItems.map((item) => item.id)).toEqual(['loose-book']);
    expect(filterContentBySearch(content, 'VIDEO').ungroupedItems).toEqual([]);
    expect(filterContentBySearch(content, 'BOOK').ungroupedItems.map((item) => item.id)).toEqual(['loose-book']);
    expect(filterContentBySearch(content, 'sea change').ungroupedItems.map((item) => item.id)).toEqual(['loose-book']);
  });

  it('keeps only matching items inside a nonmatching folder', () => {
    const result = filterContentBySearch(content, 'ocean');

    expect(result.folders[0].items.map((item) => item.id)).toEqual(['folder-book']);
    expect(filterContentBySearch(content, 'CHAPTER').folders[0].items.map((item) => item.id)).toEqual(['folder-book']);
    expect(result.mixedContent).toHaveLength(1);
    const [renderedFolder] = result.mixedContent;
    expect(renderedFolder?.type).toBe('folder');
    if (renderedFolder?.type === 'folder') expect(renderedFolder.folder).toBe(result.folders[0]);
  });

  it('shows every folder item when the folder title matches', () => {
    const result = filterContentBySearch(content, 'week 1');

    expect(result.folders[0].items.map((item) => item.id)).toEqual(['folder-book', 'folder-video']);
    expect(result.ungroupedItems).toEqual([]);
  });

  it('hides folders and loose items when none match', () => {
    expect(filterContentBySearch(content, 'no match')).toEqual({
      folders: [],
      ungroupedItems: [],
      mixedContent: [],
    });
  });

  it('matches text without regard to case', () => {
    expect(filterContentBySearch(content, 'COASTAL').folders[0].items.map((item) => item.id)).toEqual(['folder-video']);
  });
});
