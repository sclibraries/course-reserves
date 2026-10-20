export function getDraftWorkflowErrorMessage(error) {
  const payload = error?.payload;
  return payload?.error_code === 'submission_not_submitted'
    ? 'This submission is still a draft.'
    : null;
}
