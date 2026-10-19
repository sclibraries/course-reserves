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
import { transformItemForBackend } from './submissionResourcePayload';
import { toPayloadOrder } from '@/utils/listLayout';
import { getLayoutState } from '@/store/reserve/layoutState';

type MixedContentItem = { 
  type: 'folder' | 'item'; 
  folder?: CourseFolder & { items: CourseItem[] }; 
  item?: CourseItem; 
  position: number 
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

    const order = toPayloadOrder(getLayoutState(reserve));
    const foldersWithItems = organizedContent.folders.map((folder) => {
      return {
        id: folder.id,
        backendFolderId: folder.backendFolderId, // Preserve backend folder ID
        title: folder.title,
        description: folder.description,
        position: order.folderOrder[folder.id] ?? 0,
        isOpen: folder.isOpen,
        items: folder.items,
      };
    });

    const displayOrder = order.displayOrder;

    // Resolve items to submit from current reserve (no override in this path)
    const submittedItems = reserve.items;

    // Transform items to backend format with proper display order and folder mapping
    const transformedResources = submittedItems.map((item) => {
      const folder = foldersWithItems.find(f => f.id === item.folderId);
      const positionInfo = order.resourceOrder[item.id] || { displayOrder: 0, positionInFolder: null };
      
      return {
        ...transformItemForBackend(item, positionInfo.displayOrder, folder?.title),
        position_in_folder: positionInfo.positionInFolder
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
            folders: foldersWithItems.map((folder) => ({
              folder_uuid: folder.backendFolderId || folder.id.replace('folder-', ''), // Use backend ID
              folder_name: folder.title,
              display_order: folder.position,
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

  return {
    handleSubmit,
    handleSaveDraft,
    confirmSubmit,
  };
};
