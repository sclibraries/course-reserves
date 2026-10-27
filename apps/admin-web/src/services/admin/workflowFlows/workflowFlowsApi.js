import { requestWorkflow, workflowPath } from '../workflowRequest';

function itemPath(name, kind, id) {
  return workflowPath('workflowFlows', name)
    .replace(':kind', encodeURIComponent(kind))
    .replace(':id', encodeURIComponent(id));
}

export const workflowFlowsApi = {
  getItemFlow(kind, id) {
    return requestWorkflow(itemPath('itemFlow', kind, id));
  },

  submitStepResult(kind, id, body) {
    return requestWorkflow(itemPath('stepResult', kind, id), { method: 'POST', body });
  },

  switchFlow(kind, id, body) {
    return requestWorkflow(itemPath('switchFlow', kind, id), { method: 'POST', body });
  },

  setAccessPath(kind, id, body) {
    return requestWorkflow(itemPath('itemAccessPath', kind, id), { method: 'POST', body });
  },

  getFlows() {
    return requestWorkflow(workflowPath('workflowFlows', 'flows'));
  },

  getAdminFlows() {
    return requestWorkflow(workflowPath('workflowFlows', 'adminFlows'));
  },

  getAccessPathMapping() {
    return requestWorkflow(workflowPath('workflowFlows', 'accessPathMapping'));
  },

  putAccessPathMapping(body) {
    return requestWorkflow(workflowPath('workflowFlows', 'accessPathMapping'), { method: 'PUT', body });
  },
};
