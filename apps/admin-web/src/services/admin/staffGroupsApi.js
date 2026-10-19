import { requestWorkflow, workflowPath } from './workflowRequest';

function groupPath(name, id) {
  return workflowPath('workflowGroups', name).replace(':id', encodeURIComponent(id));
}

export const staffGroupsApi = {
  getGroupsForHandoff() {
    return requestWorkflow(workflowPath('workflowGroups', 'allGroups'));
  },

  getMyGroups() {
    return requestWorkflow(workflowPath('workflowGroups', 'myGroups'));
  },

  getGroupQueue(id) {
    return requestWorkflow(groupPath('groupQueue', id));
  },

  getAllGroups() {
    return requestWorkflow(workflowPath('workflowGroups', 'adminGroups'));
  },

  createGroup(body) {
    return requestWorkflow(workflowPath('workflowGroups', 'adminGroups'), { method: 'POST', body });
  },

  updateGroup(id, body) {
    return requestWorkflow(groupPath('adminGroup', id), { method: 'PUT', body });
  },

  deleteGroup(id) {
    return requestWorkflow(groupPath('adminGroup', id), { method: 'DELETE' });
  },

  getMembers(id) {
    return requestWorkflow(groupPath('groupMembers', id));
  },

  addMember(id, username) {
    return requestWorkflow(groupPath('groupMembers', id), { method: 'POST', body: { username } });
  },

  removeMember(id, username) {
    const path = groupPath('groupMember', id).replace(':username', encodeURIComponent(username));
    return requestWorkflow(path, { method: 'DELETE' });
  },
};
