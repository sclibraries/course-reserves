const ROSTER_COURSE_ERROR_MESSAGE = "This course isn't on your teaching roster for that term - contact the library";

export const getSubmissionErrorMessage = async (response: Response): Promise<string> => {
  const text = await response.text();
  if (!text) return `HTTP ${response.status}: ${response.statusText}`;

  try {
    const body = JSON.parse(text);
    if (body?.error_code === 'roster_course_required' || body?.error_code === 'roster_course_not_found') {
      return ROSTER_COURSE_ERROR_MESSAGE;
    }
    if (typeof body?.message === 'string' && body.message.trim()) return body.message;
    if (typeof body?.error === 'string' && body.error.trim()) return body.error;
  } catch {
    // Fall through to the response text when the backend returns plain text.
  }

  return text;
};
