import { requestWorkflow, workflowPath } from '../workflowRequest';

function itemPath(name, kind, id) {
  return workflowPath('workflowClaims', name)
    .replace(':kind', encodeURIComponent(kind))
    .replace(':id', encodeURIComponent(id));
}

export const claimsApi = {
  getQueue({ term = '', type = '', page = 1 } = {}) {
    const query = new URLSearchParams({ term, type, page: String(page) });
    return requestWorkflow(`${workflowPath('workflowClaims', 'queue')}?${query.toString()}`);
  },

  getMyItems() {
    return requestWorkflow(workflowPath('workflowClaims', 'myItems'));
  },

  getStaff(query = '') {
    return requestWorkflow(`${workflowPath('workflowClaims', 'staff')}?${new URLSearchParams({ q: query }).toString()}`);
  },

  getItemTimeline(kind, id) {
    return requestWorkflow(itemPath('itemTimeline', kind, id));
  },

  claimItem(kind, id) {
    return requestWorkflow(itemPath('itemClaim', kind, id), { method: 'POST' });
  },

  releaseItem(kind, id, body) {
    return requestWorkflow(itemPath('itemRelease', kind, id), { method: 'POST', body });
  },

  handoffItem(kind, id, body) {
    return requestWorkflow(itemPath('itemHandoff', kind, id), { method: 'POST', body });
  },

  takeoverItem(kind, id, body) {
    return requestWorkflow(itemPath('itemTakeover', kind, id), { method: 'POST', body });
  },

  claimAllItems(uuid) {
    const path = workflowPath('workflowClaims', 'submissionClaimAll').replace(':uuid', encodeURIComponent(uuid));
    return requestWorkflow(path, { method: 'POST' });
  },
};
