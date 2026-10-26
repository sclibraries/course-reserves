import { workflowPath, requestWorkflow } from './workflowRequest';

const submissionPath = (name, submissionId) => workflowPath('workflowSyllabi', name)
  .replace(':submissionId', encodeURIComponent(submissionId));

export const submissionSyllabiService = {
  async getSyllabi(submissionId) {
    const payload = await requestWorkflow(submissionPath('getSyllabi', submissionId));
    return payload.syllabi;
  },

  downloadOriginal(submissionId, syllabusId) {
    const path = submissionPath('downloadOriginal', submissionId)
      .replace(':syllabusId', encodeURIComponent(syllabusId));
    return requestWorkflow(path, { responseType: 'blob' });
  },
};

export function getSubmissionSyllabusError(error, operation) {
  const message = operation === 'load'
    ? 'Syllabi could not be loaded. Please try again later.'
    : 'The original could not be downloaded. Please try again later.';
  return error?.payload?.reference ? `${message} Reference: ${error.payload.reference}` : message;
}
