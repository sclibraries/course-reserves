import apiClient from '@/services/apiClient';
import { API_ENDPOINTS } from '@/config/endpoints';
import { mapSubmissionDetailItem, type BackendSubmission } from '@/store/reserve/submissionMapping';
import type { CourseReserve } from '@/store/courseReservesStore';

export interface DraftApiResponse {
  submission_uuid: string;
  status: 'draft';
  draft_version: number;
  existing?: boolean;
}

export interface DraftSaveResponse {
  draft_version: number;
}

export type DraftSyncResponse = DraftApiResponse;

type SubmissionPayload = Record<string, unknown>;

const endpoint = (path: string) => `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${path}`;
const uuidPath = (template: string, uuid: string) => template.replace(':uuid', encodeURIComponent(uuid));

export const createDraft = async (payload: SubmissionPayload): Promise<DraftApiResponse> => {
  const response = await apiClient.post(endpoint(API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_DRAFT), payload);
  return response.data as DraftApiResponse;
};

export const saveDraft = async (
  uuid: string,
  payload: SubmissionPayload,
  draftVersion: number,
): Promise<DraftSaveResponse> => {
  const response = await apiClient.put(
    endpoint(uuidPath(API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_UPDATE, uuid)),
    { ...payload, draft_version: draftVersion },
  );
  return response.data as DraftSaveResponse;
};

export const syncDraft = async (
  reserve: Pick<CourseReserve, 'id' | 'submissionUuid' | 'draftVersion'>,
  payload: SubmissionPayload,
): Promise<DraftSyncResponse> => {
  const uuid = reserve.submissionUuid || (!reserve.id.startsWith('reserve-') ? reserve.id : undefined);
  if (!uuid) return createDraft(payload);
  const response = await saveDraft(uuid, payload, reserve.draftVersion || 1);
  return { submission_uuid: uuid, status: 'draft', draft_version: response.draft_version };
};

export const submitDraft = async (uuid: string): Promise<{ status: 'submitted' }> => {
  const response = await apiClient.post(
    endpoint(uuidPath(API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_SUBMIT, uuid)),
  );
  return response.data as { status: 'submitted' };
};

export const discardDraft = async (uuid: string): Promise<void> => {
  await apiClient.delete(endpoint(uuidPath(API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_DELETE, uuid)));
};

export const getDraft = async (uuid: string): Promise<CourseReserve> => {
  const response = await apiClient.get(endpoint(API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_INDEX));
  const submission = (response.data?.items || []).find(
    (item: BackendSubmission) => item.submission_uuid === uuid,
  ) as BackendSubmission | undefined;

  if (!submission) throw new Error('Draft not found');
  return mapSubmissionDetailItem(submission);
};

export const isDraftConflict = (error: unknown): boolean => {
  const data = (error as { response?: { data?: { error_code?: string } } })?.response?.data;
  return data?.error_code === 'draft_conflict';
};
