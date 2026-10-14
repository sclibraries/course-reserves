import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiConfig } from '../../config/api.config';
import { checklistService } from './checklistService';

const courseApi = apiConfig.urls.courseReserves;
const token = 'Bearer synthetic-aw043-token';
const headers = {
  Authorization: token,
  'Content-Type': 'application/json',
};
const result = { success: true, id: 17 };

let fetchMock;

beforeEach(() => {
  document.cookie = 'accessToken=synthetic-aw043-token; path=/';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  document.cookie = 'accessToken=; Max-Age=0; path=/';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const requestCases = [
  {
    name: 'listTemplates',
    invoke: () => checklistService.listTemplates(),
    url: `${courseApi}/checklist/list-templates`,
    init: { headers },
    expected: result,
  },
  {
    name: 'getTemplate',
    invoke: () => checklistService.getTemplate(3),
    url: `${courseApi}/checklist/get-template/3`,
    init: { headers },
    expected: result,
  },
  {
    name: 'createTemplate',
    invoke: () => checklistService.createTemplate({ name: 'Synthetic checklist' }, 'staff-test'),
    url: `${courseApi}/checklist/create-template`,
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Synthetic checklist', created_by: 'staff-test' }),
    },
    expected: result,
  },
  {
    name: 'updateTemplate',
    invoke: () => checklistService.updateTemplate(4, { name: 'Updated checklist' }, 'staff-test'),
    url: `${courseApi}/checklist/update-template/4`,
    init: {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'Updated checklist', updated_by: 'staff-test' }),
    },
    expected: result,
  },
  {
    name: 'deleteTemplate',
    invoke: () => checklistService.deleteTemplate(5),
    url: `${courseApi}/checklist/delete-template/5`,
    init: { method: 'DELETE', headers },
    expected: result,
  },
  {
    name: 'duplicateTemplate',
    invoke: () => checklistService.duplicateTemplate(6),
    url: `${courseApi}/checklist/duplicate-template/6`,
    init: { method: 'POST', headers },
    expected: result,
  },
  {
    name: 'getItemChecklist',
    invoke: () => checklistService.getItemChecklist(7),
    url: `${courseApi}/checklist/get-item-checklist/7`,
    init: { headers },
    expected: result,
  },
  {
    name: 'assignChecklistToItem',
    invoke: () => checklistService.assignChecklistToItem(8, 9, 'staff-test'),
    url: `${courseApi}/checklist/assign-checklist/8`,
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify({ template_id: 9, assigned_by: 'staff-test' }),
    },
    expected: result,
  },
  {
    name: 'updateTaskStatus',
    invoke: () => checklistService.updateTaskStatus(10, 11, true, 'Synthetic note', 'staff-test'),
    url: `${courseApi}/checklist/update-task/10/11`,
    init: {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ completed: true, notes: 'Synthetic note', completed_by: 'staff-test' }),
    },
    expected: result,
  },
  {
    name: 'completeItemChecklist',
    invoke: () => checklistService.completeItemChecklist(12, 'staff-test'),
    url: `${courseApi}/checklist/complete-checklist/12`,
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify({ completed_by: 'staff-test' }),
    },
    expected: result,
  },
];

describe('checklistService characterization', () => {
  it.each(requestCases)('$name preserves its authenticated request and response', async (testCase) => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: vi.fn().mockResolvedValue(testCase.responseBody ?? result),
    });

    await expect(testCase.invoke()).resolves.toEqual(testCase.expected);
    expect(fetchMock.mock.calls).toEqual([[testCase.url, testCase.init]]);
  });

  it('keeps the token accessor public without making a request', () => {
    expect(checklistService.getAuthToken()).toBe(token);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves the template fetch error when the API rejects the request', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
    });

    await expect(checklistService.getTemplate(3)).rejects.toThrow('Failed to fetch checklist template');
    expect(fetchMock.mock.calls).toEqual([[`${courseApi}/checklist/get-template/3`, { headers }]]);
  });
});
