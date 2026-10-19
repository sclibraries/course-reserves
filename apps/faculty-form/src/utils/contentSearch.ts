import type { CourseFolder, CourseItem } from '@/store/courseReservesStore';

export type OrganizedFolder = CourseFolder & { items: CourseItem[] };

export type OrganizedContentItem =
  | { type: 'folder'; folder: OrganizedFolder; position: number }
  | { type: 'item'; item: CourseItem; position: number };

export interface OrganizedContent {
  folders: OrganizedFolder[];
  ungroupedItems: CourseItem[];
  mixedContent: OrganizedContentItem[];
}

export const filterContentBySearch = (
  organizedContent: OrganizedContent,
  searchQuery: string
): OrganizedContent => {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return organizedContent;

  const matchesItem = (item: CourseItem) =>
    [item.title, item.authors || '', item.materialType]
      .some((value) => value.toLowerCase().includes(query));

  const ungroupedItems = organizedContent.ungroupedItems.filter(matchesItem);
  const folders = organizedContent.folders
    .map((folder) => {
      const folderMatches = folder.title.toLowerCase().includes(query);
      return {
        ...folder,
        items: folderMatches ? folder.items : folder.items.filter(matchesItem),
      };
    })
    .filter((folder) => folder.items.length > 0 || folder.title.toLowerCase().includes(query));

  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const itemIds = new Set(ungroupedItems.map((item) => item.id));
  const mixedContent = organizedContent.mixedContent.flatMap((entry) => {
    if (entry.type === 'folder') {
      const folder = foldersById.get(entry.folder.id);
      return folder ? [{ ...entry, folder }] : [];
    }
    return itemIds.has(entry.item.id) ? [entry] : [];
  });

  return { folders, ungroupedItems, mixedContent };
};
