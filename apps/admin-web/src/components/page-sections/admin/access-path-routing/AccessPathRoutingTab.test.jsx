import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { getByRole, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  getAdminFlows: vi.fn(),
  getAccessPathMapping: vi.fn(),
  putAccessPathMapping: vi.fn(),
  getAllGroups: vi.fn(),
}));

vi.mock('../../../../services/admin/workflowFlows/workflowFlowsApi', () => ({ workflowFlowsApi: mocks }));
vi.mock('../../../../services/admin/staffGroupsApi', () => ({ staffGroupsApi: mocks }));

import AccessPathRoutingTab from './AccessPathRoutingTab';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
expect.extend({ toHaveNoViolations });

const paths = ['purchase', 'ags', 'ill', 'in_house_copy', 'faculty_supplies'];
const mapping = () => paths.map((access_path) => ({ access_path, flow_id: null, group_id: null }));
const configuredMapping = () => mapping().map((route, index) => (
  index === 1 ? { ...route, flow_id: 3, group_id: 7 } : route
));
let root;
let container;

async function renderTab() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const user = userEvent.setup();
  await act(async () => {
    root.render(<AccessPathRoutingTab />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { user, container };
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getAdminFlows.mockResolvedValue({ flows: [{ id: 3, name: 'Article workflow' }] });
  mocks.getAllGroups.mockResolvedValue({ groups: [{ id: 7, name: 'Acquisitions' }] });
  mocks.getAccessPathMapping.mockResolvedValue({ mapping: configuredMapping() });
  mocks.putAccessPathMapping.mockResolvedValue({ mapping: mapping() });
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('AccessPathRoutingTab', () => {
  it('loads five routes, offers optional flow/group choices, and saves None as null', async () => {
    const { user, container: tab } = await renderTab();
    let flow;
    await act(async () => { flow = await waitFor(() => getByRole(tab, 'combobox', { name: 'Flow for Purchase' })); });
    const group = getByRole(tab, 'combobox', { name: 'Group for Purchase' });
    const articleFlow = getByRole(tab, 'combobox', { name: 'Flow for Article Galaxy Scholar' });
    const articleGroup = getByRole(tab, 'combobox', { name: 'Group for Article Galaxy Scholar' });

    expect(mocks.getAccessPathMapping).toHaveBeenCalledTimes(1);
    expect(mocks.getAdminFlows).toHaveBeenCalledTimes(1);
    expect(mocks.getAllGroups).toHaveBeenCalledTimes(1);
    expect(tab.querySelectorAll('fieldset')).toHaveLength(5);
    expect(flow.querySelector('option[value="3"]')?.textContent).toBe('Article workflow');
    expect(group.querySelector('option[value="7"]')?.textContent).toBe('Acquisitions');
    expect(flow.querySelector('option[value=""]')?.textContent).toBe('None');
    await act(async () => user.selectOptions(flow, '3'));
    await act(async () => user.selectOptions(group, '7'));
    await act(async () => user.selectOptions(articleFlow, ''));
    await act(async () => user.selectOptions(articleGroup, ''));
    await act(async () => user.click(getByRole(tab, 'button', { name: 'Save routing' })));

    await act(async () => waitFor(() => expect(mocks.putAccessPathMapping).toHaveBeenCalledWith({ mapping: [
      { access_path: 'purchase', flow_id: 3, group_id: 7 },
      ...paths.slice(1).map((access_path) => ({ access_path, flow_id: null, group_id: null })),
    ] })));
    expect(getByRole(tab, 'status').textContent).toContain('Access path routing saved.');
    expect(await axe(tab)).toHaveNoViolations();
  });

  it('explains an invalid mapping response in words', async () => {
    mocks.putAccessPathMapping.mockRejectedValueOnce({ payload: { error_code: 'invalid_mapping' } });
    const { user, container: tab } = await renderTab();
    await act(async () => waitFor(() => expect(getByRole(tab, 'button', { name: 'Save routing' }).disabled).toBe(false)));
    await act(async () => user.click(getByRole(tab, 'button', { name: 'Save routing' })));

    await act(async () => waitFor(() => expect(getByRole(tab, 'alert').textContent)
      .toContain('Choose a listed flow or None and a listed group or None for each access path.')));
    expect(getByRole(tab, 'combobox', { name: 'Flow for Purchase' }).getAttribute('aria-describedby'))
      .toBe('access-path-routing-error');
  });

  it('does not save default None values when the initial routing load fails', async () => {
    mocks.getAccessPathMapping.mockRejectedValueOnce(new Error('offline'));
    const { container: tab } = await renderTab();
    await act(async () => waitFor(() => expect(getByRole(tab, 'alert').textContent).toContain('reload this tab')));
    const save = getByRole(tab, 'button', { name: 'Save routing' });

    expect(save.disabled).toBe(true);
    expect(mocks.putAccessPathMapping).not.toHaveBeenCalled();
  });
});
