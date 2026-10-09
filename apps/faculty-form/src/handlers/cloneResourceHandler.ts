import { toast } from "sonner";
import type { PreviewResource } from "@/hooks/useCourseCloning";
import type { CourseReserve, CourseItem, FolioLocation, FolioCopiedItem } from "../store/courseReservesStore";

/**
 * Create handler for adding resources from cloning
 */
export const createCloneResourceHandler = (
  reserve: CourseReserve | undefined,
  reserveId: string | undefined,
  addItem: (id: string, item: Partial<CourseItem>) => boolean
) => {
  const handleAddSingleResource = (resource: PreviewResource) => {
    if (!reserve || !reserveId) {
      console.error('No reserve or ID found');
      toast.error('Error: No course found');
      return;
    }
    
    console.log('Adding resource:', resource);
    
    try {
      // Handle physical resources
      if ((resource.type === 'physical' || resource._originalReserve) && resource._originalReserve) {
        const reserveData = resource._originalReserve;
        const item = reserveData.copiedItem || reserveData.item;
        
        if (!item || !item.title) {
          console.error('Invalid physical item data:', item);
          toast.error('Invalid resource data');
          return;
        }
        
        const primaryAuthor = item.contributors?.find((c: { primary?: boolean; name?: string }) => c.primary)?.name || 
                             item.contributors?.[0]?.name || '';
        const pubInfo = item.publication?.[0];
        
        // Get call number and barcode
        let callNumber = '';
        if ('callNumber' in item && item.callNumber) {
          callNumber = item.callNumber;
        } else if ('effectiveCallNumberComponents' in item && item.effectiveCallNumberComponents?.callNumber) {
          callNumber = item.effectiveCallNumberComponents.callNumber;
        }
        
        const barcode = reserveData.barcode || ('barcode' in item ? item.barcode : '') || '';
        const copy = ('copy' in item && typeof item.copy === 'string') ? item.copy : '';
        
        const newItem: Partial<CourseItem> = {
          title: item.title,
          authors: primaryAuthor,
          materialType: 'book' as const,
          status: 'draft' as const,
          isbn: '',
          publisher: pubInfo?.publisher || '',
          publicationYear: pubInfo?.dateOfPublication || '',
          notes: resource.notes || `Call Number: ${callNumber || 'N/A'}${barcode ? ` | Barcode: ${barcode}` : ''}`,
          
          // Preserve FOLIO metadata for backend submission
          barcode: barcode || undefined,
          callNumber: callNumber || undefined,
          copy: copy || undefined,
          instanceId: ('instanceId' in item && typeof item.instanceId === 'string') ? item.instanceId : undefined,
          holdingsId: ('holdingsId' in item && typeof item.holdingsId === 'string') ? item.holdingsId : undefined,
          instanceHrid: ('instanceHrid' in item && typeof item.instanceHrid === 'string') ? item.instanceHrid : undefined,
          temporaryLocationId: ('temporaryLocationId' in item && typeof item.temporaryLocationId === 'string') ? item.temporaryLocationId : undefined,
          temporaryLocationObject: ('temporaryLocationObject' in item && item.temporaryLocationObject && typeof item.temporaryLocationObject === 'object') ? item.temporaryLocationObject as FolioLocation : undefined,
          permanentLocationId: ('permanentLocationId' in item && typeof item.permanentLocationId === 'string') ? item.permanentLocationId : undefined,
          permanentLocationObject: ('permanentLocationObject' in item && item.permanentLocationObject && typeof item.permanentLocationObject === 'object') ? item.permanentLocationObject as FolioLocation : undefined,
          
          // Preserve the full copiedItem data for backend
          copiedItem: item as FolioCopiedItem,
        };
        
        console.log('Adding physical item with FOLIO metadata:', newItem);
        if (addItem(reserveId, newItem)) {
          toast.success(`Added "${resource.title}"`);
        } else {
          toast.error('This item is already in your reserve list.');
        }
        
      } 
      // Handle electronic resources
      else if ((resource.type === 'electronic' || resource._originalResource) && resource._originalResource) {
        const originalResource = resource._originalResource;
        let materialType: 'article' | 'video' | 'website' | 'other' = 'other';
        
        const url = originalResource.url || resource.url || '';
        if (url) {
          if (url.includes('youtube') || url.includes('video')) {
            materialType = 'video';
          } else if (url.includes('ebsco') || url.includes('journal') || originalResource.publication_title) {
            materialType = 'article';
          } else {
            materialType = 'website';
          }
        }
        
        const newItem = {
          title: resource.title || 'Untitled Resource',
          authors: resource.author,
          materialType,
          status: 'draft' as const,
          url: url,
          notes: resource.notes || '',
        };
        
        console.log('Adding electronic item:', newItem);
        if (addItem(reserveId, newItem)) {
          toast.success(`Added "${resource.title}"`);
        } else {
          toast.error('This item is already in your reserve list.');
        }
        
      } else {
        console.error('Invalid resource - no original data:', resource);
        toast.error('Invalid resource: missing original data');
        return;
      }
      
    } catch (error) {
      console.error('Failed to add resource:', error, resource);
      toast.error(`Failed to add resource: ${(error as Error).message || 'Unknown error'}`);
    }
  };

  return { handleAddSingleResource };
};
