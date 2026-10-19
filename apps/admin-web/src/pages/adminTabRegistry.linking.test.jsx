import { describe, expect, it } from 'vitest';
import { createAdminTabRegistry } from './adminTabRegistry';

const registryFor = (isDevelopment) => createAdminTabRegistry({
  canManageCourses: false,
  canManageResources: false,
  canManageSubmissions: true,
  canViewReports: false,
  canManageWorkflows: false,
  canCustomize: false,
  isAdmin: false,
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
});
