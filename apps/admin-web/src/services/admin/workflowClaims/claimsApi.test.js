import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../../http/authFetch', () => ({ authFetch: mocks.authFetch }));

import { apiConfig } from '../../../config/api.config';
import { claimsApi } from './claimsApi';

const baseUrl = apiConfig.urls.courseReserves;
const okResponse = (payload = {}) => ({ ok: true, json: async () => payload });

beforeEach(() => {
  mocks.authFetch.mockReset().mockResolvedValue(okResponse());
});

describe('claimsApi contract', () => {
  it('gets the queue with term, type, and page query parameters', async () => {
    await claimsApi.getQueue({ term: '2026FA', type: 'print', page: 2 });

    expect(mocks.authFetch).toHaveBeenCalledWith(`${baseUrl}/workflow/queue?term=2026FA&type=print&page=2`, expect.objectContaining({ method: 'GET' }));
  });

  it('includes empty queue filters in the contract path', async () => {
    await claimsApi.getQueue();

    expect(mocks.authFetch).toHaveBeenCalledWith(`${baseUrl}/workflow/queue?term=&type=&page=1`, expect.objectContaining({ method: 'GET' }));
  });

  it('gets my items from the staff claims endpoint', async () => {
    await claimsApi.getMyItems();

    expect(mocks.authFetch).toHaveBeenCalledWith(`${baseUrl}/workflow/my-items`, expect.objectContaining({ method: 'GET' }));
  });

  it('gets staff choices using the q parameter', async () => {
    await claimsApi.getStaff('test-api078');

    expect(mocks.authFetch).toHaveBeenCalledWith(`${baseUrl}/workflow/staff?q=test-api078`, expect.objectContaining({ method: 'GET' }));
  });

  it('gets an item timeline using kind and numeric row id', async () => {
    await claimsApi.getItemTimeline('reuse', 99907801);

    expect(mocks.authFetch).toHaveBeenCalledWith(`${baseUrl}/workflow/item/reuse/99907801/timeline`, expect.objectContaining({ method: 'GET' }));
  });

  it('claims an item without sending a request body', async () => {
    await claimsApi.claimItem('new', 99907802);

    expect(mocks.authFetch).toHaveBeenCalledWith(`${baseUrl}/workflow/item/new/99907802/claim`, expect.objectContaining({ method: 'POST' }));
    expect(mocks.authFetch.mock.calls[0][1]).not.toHaveProperty('body');
  });

  it('releases an item with an optional reason body', async () => {
    await claimsApi.releaseItem('reuse', 99907803, { reason: 'Returning to queue' });

    expect(mocks.authFetch).toHaveBeenCalledWith(`${baseUrl}/workflow/item/reuse/99907803/release`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ reason: 'Returning to queue' }),
    }));
  });

  it('hands an item to a staff username', async () => {
    await claimsApi.handoffItem('new', 99907804, { to_username: 'test-api078-handler' });

    expect(mocks.authFetch).toHaveBeenCalledWith(`${baseUrl}/workflow/item/new/99907804/handoff`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ to_username: 'test-api078-handler' }),
    }));
  });

  it('hands an item to a group id', async () => {
    await claimsApi.handoffItem('new', 99907804, { to_group_id: 7 });

    expect(mocks.authFetch).toHaveBeenCalledWith(`${baseUrl}/workflow/item/new/99907804/handoff`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ to_group_id: 7 }),
    }));
  });

  it('takes over an item with a reason', async () => {
    await claimsApi.takeoverItem('reuse', 99907805, { reason: 'Urgent course deadline' });

    expect(mocks.authFetch).toHaveBeenCalledWith(`${baseUrl}/workflow/item/reuse/99907805/takeover`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ reason: 'Urgent course deadline' }),
    }));
  });

  it('claims all items on a submission without a request body', async () => {
    await claimsApi.claimAllItems('synthetic-api078-submission');

    expect(mocks.authFetch).toHaveBeenCalledWith(`${baseUrl}/workflow/submission/synthetic-api078-submission/claim-all`, expect.objectContaining({ method: 'POST' }));
    expect(mocks.authFetch.mock.calls[0][1]).not.toHaveProperty('body');
  });
});
