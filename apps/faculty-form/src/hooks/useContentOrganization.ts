import { useMemo } from 'react';
import type { CourseReserve } from '../store/courseReservesStore';
import { getLayoutState } from '@/store/reserve/layoutState';
import { filterContentBySearch, type OrganizedContent } from '@/utils/contentSearch';

/** Organizes course content into folders and ungrouped items. */
export const useOrganizedContent = (reserve: CourseReserve | undefined): OrganizedContent => {
  return useMemo(() => {
    if (!reserve) return { folders: [], ungroupedItems: [], mixedContent: [] };

    const layout = getLayoutState(reserve);
    const itemsById = new Map(layout.items.map((item) => [item.id, item]));
    const folders = layout.folders.map((folder) => ({
      ...folder,
      items: folder.itemIds.map((id) => itemsById.get(id)).filter((item) => item !== undefined),
    }));
    const ungroupedItems = layout.layout.flatMap((entry) => {
      const item = entry.kind === 'item' ? itemsById.get(entry.id) : undefined;
      return item ? [item] : [];
    });
    const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
    const mixedContent: OrganizedContent['mixedContent'] = [];

    layout.layout.forEach((entry, position) => {
      if (entry.kind === 'folder') {
        const folder = foldersById.get(entry.id);
        if (folder) mixedContent.push({ type: 'folder', folder, position });
        return;
      }
      const item = itemsById.get(entry.id);
      if (item) mixedContent.push({ type: 'item', item, position });
    });

    return { folders, ungroupedItems, mixedContent };
  }, [reserve]);
};

/** Memoizes the shared search rule for the editor list. */
export const useFilteredContent = (organizedContent: OrganizedContent, searchQuery: string) => {
  return useMemo(
    () => filterContentBySearch(organizedContent, searchQuery),
    [organizedContent, searchQuery]
  );
};
