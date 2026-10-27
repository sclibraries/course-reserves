import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getAllByRole, getByRole } from '@testing-library/dom';
import { createAdminTabRegistry, getVisibleAdminGroups } from '../../../pages/adminTabRegistry';

const mocks = vi.hoisted(() => ({
  getDefaultPins: vi.fn(),
  saveDefaultPins: vi.fn(),
}));

vi.mock('../../../services/admin/navPinsService', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    navPinsService: {
      getDefaultPins: mocks.getDefaultPins,
      saveDefaultPins: mocks.saveDefaultPins,
    },
  };
});

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
const groups = getVisibleAdminGroups(registry);
let container;
let root;

async function render(props = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(
    <DefaultPinsSettings groups={groups} {...props} />,
  ));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  mocks.getDefaultPins.mockReset().mockResolvedValue({ pins: ['submissions'] });
  mocks.saveDefaultPins.mockReset().mockImplementation(async (pins) => ({ pins }));
});

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('DefaultPinsSettings', () => {
  it('loads defaults and preserves the order pages are selected', async () => {
    await render();

    expect(mocks.getDefaultPins).toHaveBeenCalledOnce();
    expect(getByRole(container, 'checkbox', { name: 'Submissions Queue' }).checked).toBe(true);
    expect(getByRole(container, 'checkbox', { name: 'My Work Queue' }).checked).toBe(false);
    expect(container.textContent).toContain('These are the pins people see until they choose their own.');

    await act(async () => fireEvent.click(getByRole(container, 'checkbox', { name: 'Resource Management' })));
    await act(async () => fireEvent.click(getByRole(container, 'checkbox', { name: 'My Work Queue' })));
    const selected = getByRole(container, 'list', { name: 'Selected pins in order' });
    expect(getAllByRole(selected, 'listitem').map((item) => item.textContent)).toEqual([
      'Submissions Queue', 'Resource Management', 'My Work Queue',
    ]);

    await act(async () => fireEvent.click(getByRole(container, 'checkbox', { name: 'Submissions Queue' })));
    expect(getAllByRole(selected, 'listitem').map((item) => item.textContent)).toEqual([
      'Resource Management', 'My Work Queue',
    ]);

    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Save default pins' })));
    expect(mocks.saveDefaultPins).toHaveBeenCalledWith(['resources', 'my-work']);
    expect(getByRole(container, 'status').textContent).toBe('Default pins saved.');
  });

  it('disables further choices at ten and explains the limit', async () => {
    mocks.getDefaultPins.mockResolvedValueOnce({ pins: registry.tabs.slice(0, 10).map(({ key }) => key) });
    await render();
    const checkbox = getByRole(container, 'checkbox', { name: registry.tabs[10].label });

    expect(checkbox.disabled).toBe(true);
    expect(checkbox.getAttribute('aria-describedby')).toBe('default-pins-limit');
    expect(getByRole(container, 'note').textContent).toBe('Choose up to 10 pages. Remove a selected page to choose another.');
  });

  it('shows a generic save error without exposing server details', async () => {
    await render();
    mocks.saveDefaultPins.mockRejectedValueOnce(new Error('private server detail'));
    await act(async () => fireEvent.click(getByRole(container, 'checkbox', { name: 'My Work Queue' })));
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Save default pins' })));

    expect(getByRole(container, 'alert').textContent).toBe('Could not save default pins. Please try again.');
    expect(container.textContent).not.toContain('private server detail');
  });
});
