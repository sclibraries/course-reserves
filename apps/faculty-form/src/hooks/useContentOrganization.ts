import { useMemo } from "react";
import type { CourseReserve } from "../store/courseReservesStore";
import type { SortOption, FilterOption } from "@/components/ItemSortingToolbar";

/**
 * Organizes course content into folders and ungrouped items
 */
export const useOrganizedContent = (reserve: CourseReserve | undefined) => {
  return useMemo(() => {
    if (!reserve) return { folders: [], ungroupedItems: [], mixedContent: [] };
    
    const folders = reserve.folders || [];
    const items = reserve.items || [];
    
    // Get items that belong to folders and populate folder items
    const foldersWithItems = folders.map(folder => ({
      ...folder,
      items: items.filter(item => item.folderId === folder.id)
    }));
    
    // Get items that don't belong to any folder
    const ungroupedItems = items.filter(item => !item.folderId);
    
    // Create mixed content array for unified ordering
    const mixedContent: Array<{ 
      type: 'folder' | 'item', 
      folder?: typeof foldersWithItems[0], 
      item?: typeof ungroupedItems[0], 
      position: number 
    }> = [
      ...foldersWithItems.map((folder, index) => ({
        type: 'folder' as const,
        folder,
        position: folder.position ?? (1000 + index)
      })),
      ...ungroupedItems.map((item, index) => ({
        type: 'item' as const,
        item,
        position: index
      }))
    ];
    
    mixedContent.sort((a, b) => a.position - b.position);
    
    return { folders: foldersWithItems, ungroupedItems, mixedContent };
  }, [reserve]);
};

/**
 * Applies filtering and sorting to organized content
 */
export const useFilteredAndSortedContent = (
  organizedContent: ReturnType<typeof useOrganizedContent>,
  searchQuery: string,
  filters: FilterOption,
  sortBy: SortOption
) => {
  return useMemo(() => {
    let { folders, ungroupedItems } = organizedContent;

    // Apply search and filters
    if (searchQuery || filters.materialTypes.length > 0 || filters.statuses.length > 0) {
      const itemFilter = (item: typeof ungroupedItems[0]) => {
        const matchesSearch = !searchQuery || 
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.authors?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.materialType.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesMaterialType = filters.materialTypes.length === 0 || 
          filters.materialTypes.includes(item.materialType);
        
        const matchesStatus = filters.statuses.length === 0 || 
          filters.statuses.includes(item.status);
        
        return matchesSearch && matchesMaterialType && matchesStatus;
      };

      ungroupedItems = ungroupedItems.filter(itemFilter);

      // Filter folders
      folders = folders.map(folder => ({
        ...folder,
        items: folder.items.filter(itemFilter)
      })).filter(folder => {
        const folderMatches = !searchQuery || 
          folder.title.toLowerCase().includes(searchQuery.toLowerCase());
        return folder.items.length > 0 || folderMatches;
      });
    }

    // Apply sorting to ungrouped items only
    switch (sortBy) {
      case 'title-asc':
        ungroupedItems.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        ungroupedItems.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'author-asc':
        ungroupedItems.sort((a, b) => (a.authors || '').localeCompare(b.authors || ''));
        break;
      case 'author-desc':
        ungroupedItems.sort((a, b) => (b.authors || '').localeCompare(a.authors || ''));
        break;
      case 'material-type':
        ungroupedItems.sort((a, b) => a.materialType.localeCompare(b.materialType));
        break;
      case 'status':
        ungroupedItems.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case 'position':
      default:
        // Keep original order
        break;
    }

    // Create updated mixed content with filtered ungrouped items
    const filteredMixedContent = organizedContent.mixedContent
      .map(item => {
        if (item.type === 'folder') {
          return item;
        } else {
          const isIncluded = ungroupedItems.some(filteredItem => filteredItem.id === item.item?.id);
          return isIncluded ? item : null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return { folders, ungroupedItems, mixedContent: filteredMixedContent };
  }, [organizedContent, searchQuery, filters, sortBy]);
};
