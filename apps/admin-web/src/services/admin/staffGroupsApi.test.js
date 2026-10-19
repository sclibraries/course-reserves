import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../http/authFetch', () => ({ authFetch: mocks.authFetch }));

import { apiConfig } from '../../config/api.config';
import { staffGroupsApi } from './staffGroupsApi';

const baseUrl = apiConfig.urls.courseReserves;
const okResponse = (payload = {}) => ({ ok: true, json: async () => payload });

beforeEach(() => {
  mocks.authFetch.mockReset().mockResolvedValue(okResponse());
});

describe('staffGroupsApi contract', () => {
  it('gets the current staff member’s groups and a group queue', async () => {
    await staffGroupsApi.getMyGroups();
    await staffGroupsApi.getGroupQueue(7);

    expect(mocks.authFetch).toHaveBeenNthCalledWith(1, `${baseUrl}/workflow/my-groups`, expect.objectContaining({ method: 'GET' }));
    expect(mocks.authFetch).toHaveBeenNthCalledWith(2, `${baseUrl}/workflow/group/7/queue`, expect.objectContaining({ method: 'GET' }));
  });

  it('gets all groups from the staff-visible hand-off route', async () => {
    await staffGroupsApi.getGroupsForHandoff();

    expect(mocks.authFetch).toHaveBeenCalledWith(`${baseUrl}/workflow/groups`, expect.objectContaining({ method: 'GET' }));
  });

  it('lists, creates, renames, and deletes groups through admin routes', async () => {
    await staffGroupsApi.getAllGroups();
    await staffGroupsApi.createGroup({ name: 'Synthetic acquisitions', description: 'Synthetic description' });
    await staffGroupsApi.updateGroup(7, { name: 'Synthetic course reserves', description: 'Updated description' });
    await staffGroupsApi.deleteGroup(7);

    expect(mocks.authFetch).toHaveBeenNthCalledWith(1, `${baseUrl}/workflow/admin/groups`, expect.objectContaining({ method: 'GET' }));
    expect(mocks.authFetch).toHaveBeenNthCalledWith(2, `${baseUrl}/workflow/admin/groups`, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ name: 'Synthetic acquisitions', description: 'Synthetic description' }),
    }));
    expect(mocks.authFetch).toHaveBeenNthCalledWith(3, `${baseUrl}/workflow/admin/groups/7`, expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ name: 'Synthetic course reserves', description: 'Updated description' }),
    }));
    expect(mocks.authFetch).toHaveBeenNthCalledWith(4, `${baseUrl}/workflow/admin/groups/7`, expect.objectContaining({ method: 'DELETE' }));
  });

  it('lists, adds, and removes group members', async () => {
    await staffGroupsApi.getMembers(7);
    await staffGroupsApi.addMember(7, 'test-api078-handler');
    await staffGroupsApi.removeMember(7, 'test-api078-handler');

    expect(mocks.authFetch).toHaveBeenNthCalledWith(1, `${baseUrl}/workflow/admin/groups/7/members`, expect.objectContaining({ method: 'GET' }));
    expect(mocks.authFetch).toHaveBeenNthCalledWith(2, `${baseUrl}/workflow/admin/groups/7/members`, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ username: 'test-api078-handler' }),
    }));
    expect(mocks.authFetch).toHaveBeenNthCalledWith(3, `${baseUrl}/workflow/admin/groups/7/members/test-api078-handler`, expect.objectContaining({ method: 'DELETE' }));
  });
});
