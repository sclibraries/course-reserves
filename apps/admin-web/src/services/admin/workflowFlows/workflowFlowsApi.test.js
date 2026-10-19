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
});
