import apiClient from '@/services/apiClient';
import { API_ENDPOINTS } from '@/config/endpoints';

export interface FacultySyllabus {
  id: number;
  source: 'google_doc' | 'upload';
  source_url: string | null;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  extracted_text: string;
  created_at: string;
}

export type FacultySyllabusPayload =
  | { google_doc_url: string }
  | { filename: string; mime_type: string; content_base64: string; extracted_text: string };

const syllabiUrl = (uuid: string) => (
  `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_SYLLABI.replace(':uuid', encodeURIComponent(uuid))}`
);

export async function listFacultySyllabi(uuid: string): Promise<FacultySyllabus[]> {
  const response = await apiClient.get(syllabiUrl(uuid));
  return response.data.syllabi as FacultySyllabus[];
}

export async function createFacultySyllabus(
  uuid: string,
  payload: FacultySyllabusPayload,
): Promise<FacultySyllabus> {
  const response = await apiClient.post(syllabiUrl(uuid), payload);
  return response.data as FacultySyllabus;
}
