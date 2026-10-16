import { toast } from "sonner";
import type { CourseReserve, CourseFolder, CourseItem } from "../store/courseReservesStore";
import { useAuthStore, getAuthHeaders } from "@/store/authStore";
import { useDraftStore } from "@/store/draftStore";
import { useEditorUIStore } from "@/store/useEditorUIStore";
import { API_ENDPOINTS, DEFAULT_CONFIG } from "@/config/endpoints";
import { validateReserveForSubmission } from "@/utils/reserveValidation";
import { CorrectionRequiredError, handleSubmitFailure } from "@/services/submissionUpdateErrors";
import { withActingForFaculty } from "./actingForPayload";
import { withRosterCourse } from "./rosterSubmissionPayload";
import { getSubmissionErrorMessage } from "./submissionErrorMessage";

type MixedContentItem = { 
  type: 'folder' | 'item'; 
  folder?: CourseFolder & { items: CourseItem[] }; 
  item?: CourseItem; 
  position: number 
};

/**
 * Transform a CourseItem into the backend submission_new_resources format
 */
const transformItemForBackend = (item: CourseItem, displayOrder: number, folderName?: string) => {
  // Determine if this is a reuse item (has barcode/call number from FOLIO)
  const isReuse = !!(item.barcode || item.callNumber || item.holdingsId);
  
  return {
    // Reuse metadata
    is_reuse: isReuse,
    source_barcode: item.barcode || null,
    source_call_number: item.callNumber || null,
    source_resource_id: item.holdingsId || null,
    source_folio_instance_id: item.instanceId || null,
    // Display/organization
    display_order: displayOrder,
    folder_name: folderName || null,
    // position_in_folder will be set externally based on actual folder position
    
    // Faculty notes
    faculty_notes: item.notes || null,
    
    // Priority (can be derived from status or default to medium)
    priority: item.status === 'needs-review' ? 'high' : 'medium',
    
    // Full resource data (JSON)
    resource_data: {
      // Core fields
      id: item.id,
      title: item.title,
      authors: item.authors,
      materialType: item.materialType,
      status: item.status,
      
      // Book/Chapter fields
      isbn: item.isbn,
      publisher: item.publisher,
      publicationYear: item.publicationYear,
      edition: item.edition,
      pages: item.pages,
      chapterTitle: item.chapterTitle,
      copy: item.copy,
      
      // Article fields
      journalTitle: item.journalTitle,
      volume: item.volume,
      issue: item.issue,
      doi: item.doi,
      issn: item.issn,
      eds: item.eds,
      // Electronic fields
      url: item.url,
      
      // Notes
      notes: item.notes,
      libraryNotes: item.libraryNotes,

      // Display window
      displayStartDate: item.displayStartDate,
      displayEndDate: item.displayEndDate,
      
      // FOLIO metadata (preserve everything for staff processing)
      barcode: item.barcode,
      callNumber: item.callNumber,
      instanceId: item.instanceId,
      instanceHrid: item.instanceHrid,
      holdingsId: item.holdingsId,
      temporaryLocationId: item.temporaryLocationId,
      temporaryLocationObject: item.temporaryLocationObject,
      permanentLocationId: item.permanentLocationId,
      permanentLocationObject: item.permanentLocationObject,
      
      // Full copiedItem data if available (contains all FOLIO details)
      copiedItem: item.copiedItem,
    }
  };
};

export const createSubmissionHandlers = (
  navigate: (path: string) => void,
  reserve: CourseReserve,
  organizedContent: {
    folders: (CourseFolder & { items: CourseItem[] })[];
    ungroupedItems: CourseItem[];
    mixedContent: MixedContentItem[];
  },
  setShowSubmitDialog: (show: boolean) => void
) => {
  const handleSubmit = () => {
    setShowSubmitDialog(true);
  };

  const handleSaveDraft = () => {
    toast.success("Draft saved");
  };

  const confirmSubmit = (emailConfirmation: boolean) => {
    const validation = validateReserveForSubmission(reserve);
    if (!validation.valid) {
      toast.error(`Submission failed: ${validation.errors[0]}`);
      return;
    }

    // Use organizedContent to get folders with their items properly populated
    const foldersWithItems = organizedContent.folders.map((folder) => {
      const displayIndex = organizedContent.mixedContent.findIndex(
        (m) => m.type === 'folder' && m.folder?.id === folder.id
      );
      return {
        id: folder.id,
        backendFolderId: folder.backendFolderId, // Preserve backend folder ID
        title: folder.title,
        description: folder.description,
        position: displayIndex >= 0 ? displayIndex : 0,
        isOpen: folder.isOpen,
        items: folder.items,
      };
    });

    // Get the actual display order from mixedContent
    // Use the index as the clean display position (0, 1, 2, 3...)
    const displayOrder = organizedContent.mixedContent.map((item, index) => ({
      type: item.type,
      id: item.type === 'folder' ? item.folder!.id : item.item!.id,
      displayPosition: index, // Clean sequential position for backend
    }));

    // Resolve items to submit from current reserve (no override in this path)
    const submittedItems = reserve.items;

    // Calculate proper display order for each item based on mixedContent position
    // Track position within folders separately
    const itemPositionMap = new Map<string, { displayOrder: number; positionInFolder?: number }>();
    let globalPosition = 0;
    
    organizedContent.mixedContent.forEach((content) => {
      if (content.type === 'folder' && content.folder) {
        // Folder items get the folder's global position, plus their index within the folder
        content.folder.items.forEach((item, idx) => {
          itemPositionMap.set(item.id, {
            displayOrder: globalPosition,
            positionInFolder: idx
          });
        });
        globalPosition++; // Folder takes up one position
      } else if (content.type === 'item' && content.item) {
        // Ungrouped items just get the global position
        itemPositionMap.set(content.item.id, {
          displayOrder: globalPosition
        });
        globalPosition++;
      }
    });

    // Transform items to backend format with proper display order and folder mapping
    const transformedResources = submittedItems.map((item) => {
      const folder = foldersWithItems.find(f => f.id === item.folderId);
      const positionInfo = itemPositionMap.get(item.id) || { displayOrder: 0 };
      
      return {
        ...transformItemForBackend(item, positionInfo.displayOrder, folder?.title),
        position_in_folder: positionInfo.positionInFolder ?? null
      };
    });

    // Prepare submission data
    const submissionData = {
      reserveId: reserve.id,
      courseInfo: {
        courseCode: reserve.courseCode,
        courseTitle: reserve.courseTitle,
        section: reserve.section,
        instructors: reserve.instructors,
        term: reserve.term,
        status: reserve.status,
        lastUpdated: reserve.lastUpdated,
      },
      // Send both original items and transformed resources
      items: submittedItems, // Keep for backward compatibility
      resources: transformedResources, // New backend format
      folders: foldersWithItems,
      displayOrder,
      metadata: {
        totalItems: submittedItems.length,
        totalFolders: foldersWithItems.length,
        itemsInFolders: submittedItems.filter(item => item.folderId).length,
        ungroupedItems: submittedItems.filter(item => !item.folderId).length,
        reuseItems: transformedResources.filter(r => r.is_reuse).length,
        newItems: transformedResources.filter(r => !r.is_reuse).length,
        submittedAt: new Date().toISOString(),
        emailConfirmation,
        submittedBy: (() => {
          const user = useAuthStore.getState().user;
          return user ? {
            id: user.id,
            username: user.username,
            fullName: user.full_name,
            email: user.email,
            role: user.role,
            institution: user.institution,
          } : null;
        })(),
      }
    };

    // Check if this is an update to an existing submission or a new submission
    const isUpdate = reserve.status === 'submitted';
    
    // Submit to backend
    (async () => {
      try {
        let url: string;
        let method: string;
        let payload: typeof submissionData | Record<string, unknown>;
        
        if (isUpdate) {
          // UPDATE existing submission using PUT endpoint
          url = `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_UPDATE.replace(':uuid', reserve.id)}`;
          method = 'PUT';
          
          // Build update payload with backend field names
          payload = {
            submission_notes: reserve.submissionNotes || null,
            needed_by_date: reserve.neededByDate || null,
            folders: foldersWithItems.map((folder, index) => ({
              folder_uuid: folder.backendFolderId || folder.id.replace('folder-', ''), // Use backend ID
              folder_name: folder.title,
              display_order: index,
            })),
            items: transformedResources.map((resource) => {
              const sourceItem = submittedItems.find(i => resource.resource_data.id === i.id);
              return {
                item_uuid: sourceItem?.backendItemId || sourceItem?.id.replace('material-', '') || resource.resource_data.id,
                display_order: resource.display_order,
                folder_uuid: resource.folder_name ? 
                  foldersWithItems.find(f => f.title === resource.folder_name)?.backendFolderId || 
                  foldersWithItems.find(f => f.title === resource.folder_name)?.id.replace('folder-', '') || 
                  null : null,
                position_in_folder: resource.position_in_folder,
                material_type: resource.resource_data.materialType,
                title: resource.resource_data.title,
                author: resource.resource_data.authors || null,
                journal: resource.resource_data.journalTitle || null,
                publisher: resource.resource_data.publisher || null,
                isbn: resource.resource_data.isbn || null,
                url: resource.resource_data.url || null,
                display_start_date: resource.resource_data.displayStartDate || null,
                display_end_date: resource.resource_data.displayEndDate || null,
                faculty_notes: resource.faculty_notes,
                call_number: resource.source_call_number,
                barcode: resource.source_barcode,
              };
            }),
          };
        } else {
          // CREATE new submission using POST endpoint
          url = `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_SUBMIT_COMPLETE}`;
          method = 'POST';
          payload = withActingForFaculty(withRosterCourse(submissionData, reserve));
        }
        
        const res = await fetch(url, {
          method,
          ...DEFAULT_CONFIG,
          headers: {
            ...(DEFAULT_CONFIG.headers || {}),
            'Content-Type': 'application/json',
            ...getAuthHeaders(), // Add authentication token
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const result = await handleSubmitFailure(res, reserve, payload, getSubmissionErrorMessage);
          if (result === 'locked') return;
        }

        const result = await res.json();

        // Extract submission UUID from response (check multiple possible structures)
        // For updates, we already have the UUID; for new submissions, extract from response
        const submissionUuid = isUpdate ? reserve.id : (
          result?.submission?.submission_uuid || 
          result?.data?.submission_uuid || 
          result?.submission_uuid || 
          result?.uuid || 
          reserve.id
        );

        // Success message
        if (isUpdate) {
          toast.success(result?.message || 'Submission updated successfully');
        } else {
          if (result?.success) {
            toast.success(result?.message || 'Submission completed successfully');
          } else {
            toast.success('Submission sent');
          }
        }
        
        useDraftStore.getState().deleteDraft(reserve.id);

        // Navigate with query param to force fresh data fetch from backend
        navigate(`/submission/${submissionUuid}?refresh=true`);
      } catch (err) {
        if (err instanceof CorrectionRequiredError) {
          useEditorUIStore.getState().openCorrectionRequiredDialog(err.detail);
          return;
        }
        toast.error(`Submission failed: ${(err as Error).message}`);
      }
    })();
  };

  /**
   * Submit as a duplicate of previous course materials (no changes / additions)
   * Adds a metadata flag so staff can process quickly.
   */
  const confirmDuplicateSubmit = (emailConfirmation: boolean, overrideItems?: CourseItem[]) => {
    const duplicateValidation = validateReserveForSubmission({
      ...reserve,
      items: (overrideItems && overrideItems.length > 0) ? overrideItems : reserve.items,
    });
    if (!duplicateValidation.valid) {
      toast.error(`Duplicate submission failed: ${duplicateValidation.errors[0]}`);
      return;
    }

    const foldersWithItems = organizedContent.folders.map((folder) => {
      const displayIndex = organizedContent.mixedContent.findIndex(
        (m) => m.type === 'folder' && m.folder?.id === folder.id
      );
      return {
        id: folder.id,
        title: folder.title,
        description: folder.description,
        position: displayIndex >= 0 ? displayIndex : 0,
        isOpen: folder.isOpen,
        items: folder.items,
      };
    });

    const displayOrder = organizedContent.mixedContent.map((item, index) => ({
      type: item.type,
      id: item.type === 'folder' ? item.folder!.id : item.item!.id,
      displayPosition: index, // Clean sequential position for backend
    }));

    // Use override items if provided so backend gets full list immediately
    const submittedItems: CourseItem[] = (overrideItems && overrideItems.length > 0) ? overrideItems : reserve.items;

    // Calculate proper display order for each item based on mixedContent position
    // Track position within folders separately
    const itemPositionMap = new Map<string, { displayOrder: number; positionInFolder?: number }>();
    let globalPosition = 0;
    
    organizedContent.mixedContent.forEach((content) => {
      if (content.type === 'folder' && content.folder) {
        // Folder items get the folder's global position, plus their index within the folder
        content.folder.items.forEach((item, idx) => {
          itemPositionMap.set(item.id, {
            displayOrder: globalPosition,
            positionInFolder: idx
          });
        });
        globalPosition++; // Folder takes up one position
      } else if (content.type === 'item' && content.item) {
        // Ungrouped items just get the global position
        itemPositionMap.set(content.item.id, {
          displayOrder: globalPosition
        });
        globalPosition++;
      }
    });

    // Transform items to backend format with proper display order and folder mapping
    const transformedResources = submittedItems.map((item) => {
      const folder = foldersWithItems.find(f => f.id === item.folderId);
      const positionInfo = itemPositionMap.get(item.id) || { displayOrder: 0 };
      
      return {
        ...transformItemForBackend(item, positionInfo.displayOrder, folder?.title),
        position_in_folder: positionInfo.positionInFolder ?? null
      };
    });

    const submissionData = {
      reserveId: reserve.id,
      courseInfo: {
        courseCode: reserve.courseCode,
        courseTitle: reserve.courseTitle,
        section: reserve.section,
        instructors: reserve.instructors,
        term: reserve.term,
        status: reserve.status,
        lastUpdated: reserve.lastUpdated,
      },
      // Send both original items and transformed resources
      items: submittedItems, // Keep for backward compatibility
      resources: transformedResources, // New backend format
      folders: foldersWithItems,
      displayOrder,
      metadata: {
        totalItems: submittedItems.length,
        totalFolders: foldersWithItems.length,
        itemsInFolders: submittedItems.filter(item => item.folderId).length,
        ungroupedItems: submittedItems.filter(item => !item.folderId).length,
        reuseItems: transformedResources.filter(r => r.is_reuse).length,
        newItems: transformedResources.filter(r => !r.is_reuse).length,
        submittedAt: new Date().toISOString(),
        emailConfirmation,
        duplicatePreviousCourse: true,
        duplicateNote: 'Faculty indicates this submission reuses all materials from a previous offering with no changes.',
        submittedBy: (() => {
          const user = useAuthStore.getState().user;
          return user ? {
            id: user.id,
            username: user.username,
            fullName: user.full_name,
            email: user.email,
            role: user.role,
            institution: user.institution,
          } : null;
        })(),
      }
    };

    // Submit to backend (duplicate flow)
    (async () => {
      try {
        const url = `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_SUBMIT_COMPLETE}`;
        const res = await fetch(url, {
          method: 'POST',
          ...DEFAULT_CONFIG,
          headers: {
            ...(DEFAULT_CONFIG.headers || {}),
            'Content-Type': 'application/json',
            ...getAuthHeaders(), // Add authentication token
          },
          body: JSON.stringify(withActingForFaculty(withRosterCourse(submissionData, reserve)))
        });

        if (!res.ok) {
          throw new Error(await getSubmissionErrorMessage(res));
        }

        const result = await res.json();

        // Extract submission UUID from response (check multiple possible structures)
        const submissionUuid = result?.submission?.submission_uuid || 
                              result?.data?.submission_uuid || 
                              result?.submission_uuid || 
                              result?.uuid || 
                              reserve.id;

        if (result?.success) {
          toast.success(result?.message || 'Duplicate submission completed successfully');
        } else {
          toast.success('Duplicate submission sent');
        }
        
        useDraftStore.getState().deleteDraft(reserve.id);

        // Navigate with query param to force fresh data fetch from backend
        navigate(`/submission/${submissionUuid}?refresh=true`);
      } catch (err) {
        toast.error(`Duplicate submission failed: ${(err as Error).message}`);
      }
    })();
  };

  return {
    handleSubmit,
    handleSaveDraft,
    confirmSubmit,
    confirmDuplicateSubmit,
  };
};
