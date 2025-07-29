/**
 * Utility functions for sorting resources in the unified table
 */

/**
 * Extract sort key from a resource based on its type
 */
const getResourceTitle = (resource) => {
  if (resource.resourceType === 'electronic') {
    return resource.name || '';
  } else {
    return resource.copiedItem?.title || '';
  }
};

/**
 * Extract creation date from a resource based on its type
 */
const getResourceCreatedDate = (resource) => {
  if (resource.resourceType === 'electronic') {
    return new Date(resource.created_at || 0);
  } else {
    return new Date(resource.metadata?.createdDate || 0);
  }
};

/**
 * Extract material type from a resource
 */
const getResourceMaterialType = (resource) => {
  if (resource.resourceType === 'electronic') {
    return resource.material_type_name || 'Unknown';
  } else {
    // For print resources, we can infer material type or default to 'Book'
    return 'Book'; // Most print resources are books
  }
};

/**
 * Sort resources based on the selected sort type
 */
export const sortResources = (resources, sortType) => {
  const sortedResources = [...resources];

  switch (sortType) {
    case 'alphabetical-asc':
      return sortedResources.sort((a, b) => {
        const titleA = getResourceTitle(a).toLowerCase();
        const titleB = getResourceTitle(b).toLowerCase();
        return titleA.localeCompare(titleB);
      });

    case 'alphabetical-desc':
      return sortedResources.sort((a, b) => {
        const titleA = getResourceTitle(a).toLowerCase();
        const titleB = getResourceTitle(b).toLowerCase();
        return titleB.localeCompare(titleA);
      });

    case 'electronic-first-alpha-asc':
      return sortedResources.sort((a, b) => {
        if (a.resourceType === b.resourceType) {
          // If same type, sort by title A-Z
          const titleA = getResourceTitle(a).toLowerCase();
          const titleB = getResourceTitle(b).toLowerCase();
          return titleA.localeCompare(titleB);
        }
        // Electronic first
        return a.resourceType === 'electronic' ? -1 : 1;
      });

    case 'electronic-first-alpha-desc':
      return sortedResources.sort((a, b) => {
        if (a.resourceType === b.resourceType) {
          // If same type, sort by title Z-A
          const titleA = getResourceTitle(a).toLowerCase();
          const titleB = getResourceTitle(b).toLowerCase();
          return titleB.localeCompare(titleA);
        }
        // Electronic first
        return a.resourceType === 'electronic' ? -1 : 1;
      });

    case 'print-first-alpha-asc':
      return sortedResources.sort((a, b) => {
        if (a.resourceType === b.resourceType) {
          // If same type, sort by title A-Z
          const titleA = getResourceTitle(a).toLowerCase();
          const titleB = getResourceTitle(b).toLowerCase();
          return titleA.localeCompare(titleB);
        }
        // Print first
        return a.resourceType === 'print' ? -1 : 1;
      });

    case 'print-first-alpha-desc':
      return sortedResources.sort((a, b) => {
        if (a.resourceType === b.resourceType) {
          // If same type, sort by title Z-A
          const titleA = getResourceTitle(a).toLowerCase();
          const titleB = getResourceTitle(b).toLowerCase();
          return titleB.localeCompare(titleA);
        }
        // Print first
        return a.resourceType === 'print' ? -1 : 1;
      });

    case 'date-newest':
      return sortedResources.sort((a, b) => {
        const dateA = getResourceCreatedDate(a);
        const dateB = getResourceCreatedDate(b);
        return dateB - dateA; // Newest first
      });

    case 'date-oldest':
      return sortedResources.sort((a, b) => {
        const dateA = getResourceCreatedDate(a);
        const dateB = getResourceCreatedDate(b);
        return dateA - dateB; // Oldest first
      });

    case 'material-type':
      return sortedResources.sort((a, b) => {
        const typeA = getResourceMaterialType(a);
        const typeB = getResourceMaterialType(b);
        
        if (typeA === typeB) {
          // If same material type, sort by title
          const titleA = getResourceTitle(a).toLowerCase();
          const titleB = getResourceTitle(b).toLowerCase();
          return titleA.localeCompare(titleB);
        }
        
        return typeA.localeCompare(typeB);
      });

    case 'manual':
    default:
      // For manual sorting, sort by order field if available, otherwise maintain current order
      return sortedResources.sort((a, b) => {
        const orderA = (a.order === 999 || a.order === null || a.order === undefined) ? 999999 : a.order;
        const orderB = (b.order === 999 || b.order === null || b.order === undefined) ? 999999 : b.order;
        return orderA - orderB;
      });
  }
};

/**
 * Apply the new sort order to resources and update their order values
 */
export const applySortOrder = (resources, sortType) => {
  const sortedResources = sortResources(resources, sortType);
  
  // Update order values to match the new sort order
  return sortedResources.map((resource, index) => ({
    ...resource,
    order: index + 1
  }));
};

/**
 * Check if a sort type requires manual order preservation
 */
export const isManualSort = (sortType) => {
  return sortType === 'manual';
};
