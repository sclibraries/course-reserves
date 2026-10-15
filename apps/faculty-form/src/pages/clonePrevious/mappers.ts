import type { CourseItem } from '@/store/useReserveStore';
import type { CourseResource, ElectronicResource, PhysicalReserve } from './types';

const joinResourceNotes = (resource: ElectronicResource) => [
  resource.description,
  resource.external_note,
  resource.internal_note,
  resource.folder_name ? `Folder: ${resource.folder_name}` : null,
].filter(Boolean).join(' | ');

export const mapResourcesForPreview = (
  physicalReserves: PhysicalReserve[],
  electronicResources: ElectronicResource[]
): CourseResource[] => {
  const resources: CourseResource[] = [];

  physicalReserves.forEach((reserve) => {
    const item = reserve.copiedItem;
    if (!item) return;

    const primaryAuthor = item.contributors?.find((contributor) => contributor.primary)?.name ||
      item.contributors?.[0]?.name || 'Unknown Author';
    const publication = item.publication?.[0];
    const publicationInfo = publication
      ? [publication.publisher, publication.place, publication.dateOfPublication]
        .filter(Boolean).join(', ')
      : '';

    resources.push({
      id: reserve.id,
      title: item.title || 'Untitled Item',
      type: 'book',
      author: primaryAuthor,
      publicationInfo: publicationInfo || undefined,
      notes: `Call Number: ${item.callNumber || 'N/A'} | Barcode: ${item.barcode || 'N/A'}`,
      status: 'active',
    });
  });

  electronicResources.forEach((resource) => {
    let type: CourseResource['type'] = 'other';
    if (resource.item_url) {
      if (resource.item_url.includes('youtube') || resource.item_url.includes('video')) type = 'video';
      else if (resource.item_url.includes('ebsco') || resource.item_url.includes('journal')) type = 'article';
      else type = 'link';
    } else {
      type = 'file';
    }

    resources.push({
      id: resource.id,
      title: resource.title || 'Untitled Resource',
      type,
      url: resource.item_url || undefined,
      notes: joinResourceNotes(resource) || undefined,
      status: 'active',
    });
  });

  return resources;
};

export const mapResourcesForClone = (
  physicalReserves: PhysicalReserve[],
  electronicResources: ElectronicResource[]
): CourseItem[] => {
  const items: CourseItem[] = [];

  physicalReserves.forEach((reserve, index) => {
    const item = reserve.copiedItem;
    if (!item) return;

    const primaryAuthor = item.contributors?.find((contributor) => contributor.primary)?.name ||
      item.contributors?.[0]?.name || '';
    const publication = item.publication?.[0];
    items.push({
      id: `cloned-book-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      title: item.title || 'Untitled Item',
      authors: primaryAuthor,
      materialType: 'book',
      status: 'draft',
      priority: 'medium',
      isbn: '',
      publisher: publication?.publisher || '',
      publicationYear: publication?.dateOfPublication || '',
      pages: '',
      notes: `Call Number: ${item.callNumber || 'N/A'} | Barcode: ${item.barcode || 'N/A'}`,
    } as CourseItem);
  });

  electronicResources.forEach((resource, index) => {
    let materialType: CourseItem['materialType'] = 'other';
    if (resource.item_url) {
      if (resource.item_url.includes('youtube') || resource.item_url.includes('video')) materialType = 'video';
      else if (resource.item_url.includes('ebsco') || resource.item_url.includes('journal')) materialType = 'article';
      else materialType = 'website';
    }

    items.push({
      id: `cloned-${materialType}-${Date.now()}-${physicalReserves.length + index}-${Math.random().toString(36).substr(2, 9)}`,
      title: resource.title || 'Untitled Resource',
      materialType,
      status: 'draft',
      priority: 'medium',
      url: resource.item_url || '',
      notes: joinResourceNotes(resource) || '',
    } as CourseItem);
  });

  return items;
};
