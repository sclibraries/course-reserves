import { getSafeErrorFeedback, notify } from "@/services/notify";
import type { CourseReserve, CourseFolder, CourseItem } from "../store/courseReservesStore";
import { getAuthHeaders } from "@/store/authStore";
import { useDraftStore } from "@/store/draftStore";
import { useEditorUIStore } from "@/store/useEditorUIStore";
import { API_ENDPOINTS, DEFAULT_CONFIG } from "@/config/endpoints";
import { validateReserveForSubmission } from "@/utils/reserveValidation";
import { CorrectionRequiredError, handleSubmitFailure } from "@/services/submissionUpdateErrors";
import { getSubmissionErrorMessage, SubmissionResponseError } from "./submissionErrorMessage";
import { buildSubmissionPayload } from './submissionPayload';
import { useReserveStore } from '@/store/useReserveStore';
import { shouldSubmitAsDraft } from './shouldSubmitAsDraft';

type MixedContentItem = { 
  type: 'folder' | 'item'; 
  folder?: CourseFolder & { items: CourseItem[] }; 
  item?: CourseItem; 
  position: number 
};

type SubmitResult = { success: true } | { success: false; message: string };

export const createSubmissionHandlers = (
  navigate: (path: string) => void,
  reserve: CourseReserve,
  organizedContent: {
    folders: (CourseFolder & { items: CourseItem[] })[];
    ungroupedItems: CourseItem[];
    mixedContent: MixedContentItem[];
  },
  setShowSubmitDialog: (show: boolean) => void,
  draftActions?: {
    submitDraft: (emailConfirmation: boolean) => Promise<string | null>;
    hasUnsavedChanges?: boolean;
  },
) => {
  const handleSubmit = () => {
    setShowSubmitDialog(true);
  };

  const confirmSubmit = async (emailConfirmation: boolean): Promise<SubmitResult> => {
    try {
      const validation = validateReserveForSubmission(reserve);
      if (!validation.valid) {
        const message = validation.errors[0];
        notify.error(`Submission failed: ${message}`);
        return { success: false, message };
      }

      const submissionPayload = buildSubmissionPayload(reserve, emailConfirmation, organizedContent);
      const foldersWithItems = submissionPayload.folders;
      const submittedItems = submissionPayload.items;
      const transformedResources = submissionPayload.resources;
      const isUpdate = reserve.status === 'submitted';

      if (draftActions && shouldSubmitAsDraft(reserve, draftActions.hasUnsavedChanges || false)) {
        const submissionUuid = await draftActions.submitDraft(emailConfirmation);
        if (!submissionUuid) {
          const draftStore = useDraftStore.getState();
          const saveError = draftStore.getSaveError(reserve.id);
          const alreadySurfaced = !!saveError || draftStore.getSavingStatus(reserve.id) === 'error';
          const message = saveError || (alreadySurfaced
            ? 'This list was changed on another device'
            : "Couldn't submit this reserve request");
          if (!alreadySurfaced) {
            const feedback = getSafeErrorFeedback(null, message);
            notify.error(feedback.message, { reference: feedback.reference });
          }
          return { success: false, message };
        }
        notify.success('Submission sent');
        useDraftStore.getState().deleteDraft(reserve.id);
        if (reserve.id.startsWith('reserve-')) useReserveStore.getState().deleteReserve(reserve.id);
        navigate(`/submission/${submissionUuid}?refresh=true`);
        return { success: true };
      }

      let url: string;
      let method: string;
      let payload: Record<string, unknown>;

      if (isUpdate) {
        // UPDATE existing submission using PUT endpoint
        url = `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_UPDATE.replace(':uuid', reserve.id)}`;
        method = 'PUT';
        payload = {
          submission_notes: reserve.submissionNotes || null,
          needed_by_date: reserve.neededByDate || null,
          folders: foldersWithItems.map((folder) => ({
            folder_uuid: folder.backendFolderId || folder.id.replace('folder-', ''),
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
              assignedPages: resource.assignedPages,
              call_number: resource.source_call_number,
              barcode: resource.source_barcode,
            };
          }),
        };
      } else {
        // CREATE new submission using POST endpoint
        url = `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_SUBMIT_COMPLETE}`;
        method = 'POST';
        payload = submissionPayload;
      }

      const res = await fetch(url, {
        method,
        ...DEFAULT_CONFIG,
        headers: {
          ...(DEFAULT_CONFIG.headers || {}),
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const result = await handleSubmitFailure(res, reserve, payload, getSubmissionErrorMessage);
        if (result === 'locked') return { success: false, message: 'This submission can no longer be edited' };
      }

      const result = await res.json();
      const submissionUuid = isUpdate ? reserve.id : (
        result?.submission?.submission_uuid ||
        result?.data?.submission_uuid ||
        result?.submission_uuid ||
        result?.uuid ||
        reserve.id
      );

      if (isUpdate) {
        notify.success('Submission updated');
      } else {
        notify.success(result?.success ? 'Submission submitted' : 'Submission sent');
      }

      useDraftStore.getState().deleteDraft(reserve.id);
      navigate(`/submission/${submissionUuid}?refresh=true`);
      return { success: true };
    } catch (err) {
      if (err instanceof CorrectionRequiredError) {
        useEditorUIStore.getState().openCorrectionRequiredDialog(err.detail);
        const feedback = getSafeErrorFeedback(err, "Couldn't submit this reserve request");
        notify.error(feedback.message, { reference: feedback.reference });
        return { success: false, message: feedback.message };
      }
      if (err instanceof SubmissionResponseError) {
        notify.error(err.message, { reference: err.reference });
        return { success: false, message: err.message };
      }
      const feedback = getSafeErrorFeedback(err, "Couldn't submit this reserve request");
      notify.error(feedback.message, { reference: feedback.reference });
      return { success: false, message: feedback.message };
    }
  };

  return {
    handleSubmit,
    confirmSubmit,
  };
};
