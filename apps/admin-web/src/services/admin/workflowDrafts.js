export function excludeDraftWorkflowItems(items = []) {
  return items.filter((item) => (
    item?.status !== 'draft'
    && item?.submission_status !== 'draft'
    && item?.submissionStatus !== 'draft'
    && item?.submission?.status !== 'draft'
  ));
}
