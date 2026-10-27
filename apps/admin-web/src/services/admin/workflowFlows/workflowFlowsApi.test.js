import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../../http/authFetch', () => ({ authFetch: mocks.authFetch }));

import { apiConfig } from '../../../config/api.config';
import { workflowFlowsApi } from './workflowFlowsApi';

const baseUrl = apiConfig.urls.courseReserves;
const okResponse = (payload = {}) => ({ ok: true, json: async () => payload });

beforeEach(() => {
  mocks.authFetch.mockReset().mockResolvedValue(okResponse());
});

describe('workflowFlowsApi contract', () => {
  it('gets an item flow and the available flow choices', async () => {
    await workflowFlowsApi.getItemFlow('reuse', 99907812);
    await workflowFlowsApi.getFlows();

    expect(mocks.authFetch).toHaveBeenNthCalledWith(1, `${baseUrl}/workflow/item/reuse/99907812/flow`, expect.objectContaining({ method: 'GET' }));
    expect(mocks.authFetch).toHaveBeenNthCalledWith(2, `${baseUrl}/workflow/flows`, expect.objectContaining({ method: 'GET' }));
  });

  it('posts an outcome and switches flows with the exact request bodies', async () => {
    await workflowFlowsApi.submitStepResult('new', 99907811, {
      step_key: 'own_it', outcome_key: 'no', notes: 'Not owned locally', reason: 'Order needed',
    });
    await workflowFlowsApi.switchFlow('new', 99907811, { flow_id: 7, reason: 'Use the article flow' });

    expect(mocks.authFetch).toHaveBeenNthCalledWith(1, `${baseUrl}/workflow/item/new/99907811/step-result`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ step_key: 'own_it', outcome_key: 'no', notes: 'Not owned locally', reason: 'Order needed' }),
    }));
    expect(mocks.authFetch).toHaveBeenNthCalledWith(2, `${baseUrl}/workflow/item/new/99907811/switch-flow`, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ flow_id: 7, reason: 'Use the article flow' }),
    }));
  });

  it('sets an item access path and reads and saves admin routing', async () => {
    const mapping = [{ access_path: 'purchase', flow_id: 7, group_id: 2 }];
    await workflowFlowsApi.setAccessPath('new', 99907811, { access_path: 'purchase' });
    await workflowFlowsApi.getAdminFlows();
    await workflowFlowsApi.getAccessPathMapping();
    await workflowFlowsApi.putAccessPathMapping({ mapping });

    expect(mocks.authFetch).toHaveBeenNthCalledWith(1, `${baseUrl}/workflow/item/new/99907811/access-path`, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ access_path: 'purchase' }),
    }));
    expect(mocks.authFetch).toHaveBeenNthCalledWith(2, `${baseUrl}/workflow/admin/flows`, expect.objectContaining({ method: 'GET' }));
    expect(mocks.authFetch).toHaveBeenNthCalledWith(3, `${baseUrl}/workflow/admin/access-path-mapping`, expect.objectContaining({ method: 'GET' }));
    expect(mocks.authFetch).toHaveBeenNthCalledWith(4, `${baseUrl}/workflow/admin/access-path-mapping`, expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ mapping }),
    }));
  });
});
