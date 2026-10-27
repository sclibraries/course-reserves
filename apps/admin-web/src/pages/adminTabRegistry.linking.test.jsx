import { describe, expect, it } from 'vitest';
import { createAdminTabRegistry } from './adminTabRegistry';

const registryFor = (isDevelopment, isAdmin = false) => createAdminTabRegistry({
  canManageCourses: false,
  canManageResources: false,
  canManageSubmissions: true,
  canViewReports: false,
  canManageWorkflows: false,
  canCustomize: false,
  isAdmin,
  canManageProxyAccess: false,
  isDevelopment,
});

describe('Needs linking workflow tab', () => {
  it('is available to staff with submission access inside Workflow', () => {
    const registry = registryFor(true);
    const tab = registry.tabs.find((entry) => entry.key === 'needs-linking');

    expect(registry.workflowVisible).toBe(true);
    expect(tab).toEqual(expect.objectContaining({ canAccess: true, navigationGroup: 'workflow' }));
  });

  it('keeps the existing production workflow visibility gate', () => {
    expect(registryFor(false).workflowVisible).toBe(false);
  });

  it('adds the item queue and My items to the dev-only Workflow area', () => {
    const registry = registryFor(true);
    const queue = registry.tabs.find((entry) => entry.key === 'item-queue');
    const myItems = registry.tabs.find((entry) => entry.key === 'my-items');

    expect(queue).toEqual(expect.objectContaining({ label: 'Item Queue', canAccess: true, navigationGroup: 'workflow' }));
    expect(myItems).toEqual(expect.objectContaining({ label: 'My Items', canAccess: true, navigationGroup: 'workflow' }));
    expect(registryFor(false).workflowVisible).toBe(false);
  });

  it('shows My groups to submission staff and restricts group settings to admins', () => {
    const staffRegistry = registryFor(true, false);
    const adminRegistry = registryFor(true, true);
    const staffGroups = staffRegistry.tabs.find((entry) => entry.key === 'my-groups');
    const settingsForStaff = staffRegistry.tabs.find((entry) => entry.key === 'groups');
    const settingsForAdmin = adminRegistry.tabs.find((entry) => entry.key === 'groups');

    expect(staffGroups).toEqual(expect.objectContaining({ label: 'My Groups', canAccess: true, navigationGroup: 'workflow' }));
    expect(settingsForStaff).toEqual(expect.objectContaining({ label: 'Groups', canAccess: false }));
    expect(settingsForAdmin).toEqual(expect.objectContaining({ label: 'Groups', canAccess: true }));
  });

  it('shows Access path routing to admins only', () => {
    const staffRegistry = registryFor(true, false);
    const adminRegistry = registryFor(true, true);

    expect(staffRegistry.tabs.find((entry) => entry.key === 'access-path-routing').canAccess).toBe(false);
    expect(adminRegistry.tabs.find((entry) => entry.key === 'access-path-routing'))
      .toEqual(expect.objectContaining({ label: 'Access path routing', canAccess: true }));
  });
});
