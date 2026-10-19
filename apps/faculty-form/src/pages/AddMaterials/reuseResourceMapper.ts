import type { ElectronicResource, PhysicalReserve, PreviewResource } from '@/hooks/useCourseCloning';

interface MergedCourseResource {
  resource_type?: string;
  id?: string | number;
  title?: string;
  item_url?: string;
  description?: string;
  notes?: string;
  external_note?: string;
  folder_name?: string | null;
  order?: string | number;
  links?: Array<{ url?: string; title?: string }>;
  [key: string]: unknown;
}

export function mapReuseResources(
  orderedResources: unknown[],
  physicalReserves: PhysicalReserve[]
): PreviewResource[] {
  return orderedResources.flatMap((value, index) => {
    const resource = value as MergedCourseResource;
    if (resource.resource_type === 'physical') {
      const reserve = findPhysicalReserve(resource.id, physicalReserves);
      const item = reserve?.copiedItem || reserve?.item;
      return [{
        type: 'physical',
        title: resource.title || item?.title || 'Untitled Item',
        author: item?.contributors?.find((contributor) => contributor.primary)?.name || item?.contributors?.[0]?.name || '',
        materialType: 'book',
        callNumber: getCallNumber(item),
        notes: getPhysicalNotes(reserve),
        order: index,
        folderName: resource.folder_name || undefined,
        _originalReserve: reserve,
      }];
    }

    if (resource.resource_type !== 'electronic') return [];
    const originalResource = resource as ElectronicResource;
    const url = resource.item_url || resource.links?.find((link) => link.url)?.url || '';
    return [{
      type: 'electronic',
      title: resource.title || 'Untitled Resource',
      author: originalResource.authors || '',
      materialType: getElectronicMaterialType(url, originalResource.publication_title),
      url: url || undefined,
      description: resource.description || undefined,
      notes: [resource.notes, resource.description, resource.external_note].filter(Boolean).join(' ') || undefined,
      order: index,
      folderName: resource.folder_name || undefined,
      _originalResource: originalResource,
    }];
  });
}

function findPhysicalReserve(resourceId: string | number | undefined, reserves: PhysicalReserve[]) {
  const id = resourceId === undefined ? '' : String(resourceId);
  if (!id) return undefined;
  return reserves.find((reserve) => {
    const item = reserve.copiedItem || reserve.item;
    return [
      reserve.temporaryItemId,
      reserve.barcode,
      reserve.copiedItem?.barcode,
      reserve.item?.barcode,
      getStringProperty(item, 'instanceId'),
      getStringProperty(item, 'instanceHrid'),
    ].some((value) => value === id);
  });
}

function getStringProperty(value: object | undefined, property: string): string | undefined {
  if (!value || !(property in value)) return undefined;
  const propertyValue = (value as Record<string, unknown>)[property];
  return typeof propertyValue === 'string' ? propertyValue : undefined;
}

function getCallNumber(item: PhysicalReserve['copiedItem'] | PhysicalReserve['item']): string | undefined {
  if (!item) return undefined;
  if ('callNumber' in item && item.callNumber) return item.callNumber;
  if ('effectiveCallNumberComponents' in item) return item.effectiveCallNumberComponents?.callNumber;
  return undefined;
}

function getPhysicalNotes(reserve: PhysicalReserve | undefined): string | undefined {
  const item = reserve?.copiedItem || reserve?.item;
  const callNumber = getCallNumber(item);
  const barcode = reserve?.barcode || ('barcode' in (item || {}) ? item?.barcode : undefined);
  const copy = getStringProperty(item, 'copy');
  const notes = [
    callNumber ? `Call Number: ${callNumber}` : undefined,
    barcode ? `Barcode: ${barcode}` : undefined,
    copy ? `Copy: ${copy}` : undefined,
  ].filter(Boolean);
  return notes.length > 0 ? notes.join(' | ') : undefined;
}

function getElectronicMaterialType(url: string, publicationTitle?: string): string {
  if (url.includes('youtube') || url.includes('video')) return 'video';
  if (url.includes('ebsco') || url.includes('journal') || publicationTitle) return 'article';
  return url ? 'website' : 'other';
}

export function toReuseDuplicateCandidate(resource: PreviewResource) {
  if (resource.type === 'physical' && resource._originalReserve) {
    const item = resource._originalReserve.copiedItem || resource._originalReserve.item;
    return {
      title: item?.title || resource.title,
      authors: resource.author,
      barcode: resource._originalReserve.barcode || ('barcode' in (item || {}) ? item?.barcode : undefined),
    };
  }
  return {
    title: resource.title,
    authors: resource.author || resource._originalResource?.authors,
    url: resource.url,
  };
}
