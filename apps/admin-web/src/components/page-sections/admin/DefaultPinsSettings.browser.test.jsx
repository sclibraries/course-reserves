import 'bootstrap/dist/css/bootstrap.min.css';
import '../../../index.css';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getByRole } from '@testing-library/dom';
import { page } from '@vitest/browser/context';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../../../test/browser';
import { createAdminTabRegistry, getVisibleAdminGroups } from '../../../pages/adminTabRegistry';

const mocks = vi.hoisted(() => ({ getDefaultPins: vi.fn(), saveDefaultPins: vi.fn() }));
vi.mock('../../../services/admin/navPinsService', () => ({ navPinsService: {
  getDefaultPins: mocks.getDefaultPins,
  saveDefaultPins: mocks.saveDefaultPins,
} }));

import DefaultPinsSettings from './DefaultPinsSettings';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const registry = createAdminTabRegistry({
  canManageCourses: true,
  canManageResources: true,
  canManageSubmissions: true,
  canViewReports: true,
  canManageWorkflows: true,
  canCustomize: true,
  isAdmin: true,
  canManageProxyAccess: true,
});
let container;
let root;

async function render() {
  await page.viewport(1280, 900);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(
    <DefaultPinsSettings isAdmin groups={getVisibleAdminGroups(registry)} />,
  ));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('DefaultPinsSettings in Chromium', () => {
  it('reflows at mobile, tablet, and desktop widths and has no axe violations', async () => {
    mocks.getDefaultPins.mockReset().mockResolvedValue({ pins: ['my-work', 'submissions', 'customizations'] });
    await render();

    expect(getByRole(container, 'heading', { name: 'Default pins' })).toBeTruthy();
    await expectNoHorizontalOverflow([320, 768, 1280]);
    await expectNoAxeViolations(container);
  });
});
