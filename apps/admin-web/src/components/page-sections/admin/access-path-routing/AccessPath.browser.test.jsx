import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../../../../test/browser';

const mocks = vi.hoisted(() => ({
  getAdminFlows: vi.fn(),
  getAccessPathMapping: vi.fn(),
  putAccessPathMapping: vi.fn(),
  getAllGroups: vi.fn(),
  getGroupsForHandoff: vi.fn(),
  getItemFlow: vi.fn(),
  setAccessPath: vi.fn(),
}));

vi.mock('../../../../services/admin/workflowFlows/workflowFlowsApi', () => ({ workflowFlowsApi: mocks }));
vi.mock('../../../../services/admin/staffGroupsApi', () => ({ staffGroupsApi: mocks }));

import AccessPathSection from '../submission-page/item-pane/AccessPathSection';
import AccessPathRoutingTab from './AccessPathRoutingTab';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const routes = ['purchase', 'ags', 'ill', 'in_house_copy', 'faculty_supplies']
  .map((access_path) => ({ access_path, flow_id: null, group_id: null }));

describe('access path interfaces in Chromium', () => {
  let container;
  let root;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('reflows the process pane and routing tab without overflow and has no axe violations', async () => {
    mocks.getAdminFlows.mockResolvedValue({ flows: [{ id: 3, name: 'Synthetic article workflow' }] });
    mocks.getAccessPathMapping.mockResolvedValue({ mapping: routes });
    mocks.getAllGroups.mockResolvedValue({ groups: [{ id: 7, name: 'Synthetic acquisitions group' }] });
    mocks.getGroupsForHandoff.mockResolvedValue({ groups: [] });
    mocks.getItemFlow.mockResolvedValue({ flow: null });
    mocks.setAccessPath.mockResolvedValue({ warning: null });
    mocks.putAccessPathMapping.mockResolvedValue({ mapping: routes });

    container = document.createElement('main');
    container.className = 'tw-grid tw-min-w-0 tw-grid-cols-1 tw-gap-4';
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <>
        <AccessPathSection
          item={{
            kind: 'new', id: 9001, title: 'Synthetic article', readiness: 'missing',
            allowedAccessPaths: ['purchase', 'faculty_supplies'], claimed_by: 'devadmin',
          }}
          currentUsername="devadmin"
          flow={{ replaceFlowState: vi.fn() }}
        />
        <AccessPathRoutingTab />
      </>,
    ));
    await act(async () => {});

    const paneSection = container.querySelector('[aria-label="Access path"]');
    const routingTab = container.querySelector('[aria-label="Access path routing"]');
    expect(paneSection).toBeTruthy();
    expect(routingTab).toBeTruthy();
    await expectNoAxeViolations(paneSection);
    await expectNoAxeViolations(routingTab);
    await expectNoHorizontalOverflow();
  });
});
