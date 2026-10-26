import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createFacultySyllabus,
  listFacultySyllabi,
  type FacultySyllabus,
  type FacultySyllabusPayload,
} from '@/services/api/facultySyllabusApi';
import { readSyllabusFile } from '@/services/syllabusTextExtractor';

interface SyllabusUploadOptions {
  reserveId: string;
  submissionUuid?: string;
  ensureServerUuid: () => Promise<string | undefined>;
  onReview: (text: string) => void;
}

export function useSyllabusUpload({
  reserveId,
  submissionUuid,
  ensureServerUuid,
  onReview,
}: SyllabusUploadOptions) {
  const [syllabi, setSyllabi] = useState<FacultySyllabus[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serverUuid = submissionUuid || (reserveId.startsWith('reserve-') ? undefined : reserveId);
  const previousServerUuid = useRef(serverUuid);

  useEffect(() => {
    if (!serverUuid) return;
    let active = true;
    if (previousServerUuid.current && previousServerUuid.current !== serverUuid) setSyllabi([]);
    previousServerUuid.current = serverUuid;
    listFacultySyllabi(serverUuid)
      .then((records) => { if (active) setSyllabi((current) => mergeSyllabi(records, current)); })
      .catch((reason: unknown) => { if (active) setError(friendlySyllabusError(reason)); });
    return () => { active = false; };
  }, [serverUuid]);

  const attach = useCallback(async (payload: FacultySyllabusPayload) => {
    setError(null);
    setIsReading(true);
    try {
      const uuid = await ensureServerUuid();
      if (!uuid) throw new Error('Draft could not be saved');
      const syllabus = await createFacultySyllabus(uuid, payload);
      setSyllabi((current) => mergeSyllabi(current, [syllabus]));
      onReview(syllabus.extracted_text);
    } catch (reason) {
      setError(friendlySyllabusError(reason));
    } finally {
      setIsReading(false);
    }
  }, [ensureServerUuid, onReview]);

  const attachGoogleDoc = useCallback((url: string) => {
    void attach({ google_doc_url: url.trim() });
  }, [attach]);

  const attachFile = useCallback(async (file?: File) => {
    if (!file) return;
    setError(null);
    setIsReading(true);
    try {
      const { payload } = await readSyllabusFile(file);
      await attach(payload);
    } catch (reason) {
      setError(friendlySyllabusError(reason));
    } finally {
      setIsReading(false);
    }
  }, [attach]);

  const reviewSyllabus = useCallback((syllabus: FacultySyllabus) => {
    onReview(syllabus.extracted_text);
  }, [onReview]);

  return { syllabi, isReading, error, attachGoogleDoc, attachFile, reviewSyllabus };
}

function mergeSyllabi(records: FacultySyllabus[], local: FacultySyllabus[]): FacultySyllabus[] {
  const byId = new Map(records.map((syllabus) => [syllabus.id, syllabus]));
  local.forEach((syllabus) => byId.set(syllabus.id, syllabus));
  return Array.from(byId.values());
}

function friendlySyllabusError(reason: unknown): string {
  const response = (reason as { response?: { data?: { error_code?: string; reference_id?: string } } })?.response;
  const code = response?.data?.error_code || (reason as { code?: string })?.code || '';
  const messages: Record<string, string> = {
    google_doc_not_shared: 'This Google Doc is not shared for link viewing. Set General access to “Anyone with the link” and Viewer, then try again. You can upload the file instead.',
    google_doc_unavailable: 'We could not read that Google Doc. Check that the link works, or upload a PDF or DOCX instead.',
    invalid_google_doc_url: 'Enter a Google Docs link, or upload a PDF or DOCX file.',
    syllabus_file_too_large: 'This file is over the 10 MB limit. Choose a smaller PDF or DOCX.',
    unsupported_syllabus_type: 'Choose a PDF or DOCX file.',
  };
  const message = messages[code] || 'We could not attach this syllabus. Please try again.';
  return response?.data?.reference_id ? `${message} Reference: ${response.data.reference_id}` : message;
}
