import { getSafeErrorFeedback } from '@/services/notify';

const ROSTER_COURSE_ERROR_MESSAGE = "This course isn't on your teaching roster for that term - contact the library";

export class SubmissionResponseError extends Error {
  constructor(message: string, readonly reference: string) {
    super(message);
    this.name = 'SubmissionResponseError';
  }
}

export const getSubmissionErrorMessage = async (response: Response): Promise<SubmissionResponseError> => {
  const text = await response.text();
  let body: Record<string, unknown> = {};

  if (text) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      // Keep malformed server text out of the user-facing error.
    }
  }

  const isRosterError = body.error_code === 'roster_course_required' || body.error_code === 'roster_course_not_found';
  const message = isRosterError ? ROSTER_COURSE_ERROR_MESSAGE : "Couldn't submit this reserve request";
  const feedback = getSafeErrorFeedback({ response: { data: body } }, message);
  return new SubmissionResponseError(feedback.message, feedback.reference);
};
