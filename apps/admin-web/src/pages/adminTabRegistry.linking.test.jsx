import { describe, expect, it } from 'vitest';
import { createAdminTabRegistry } from './adminTabRegistry';

const registryFor = (isAdmin = false) => createAdminTabRegistry({
  canManageCourses: false,
  canManageResources: false,
  canManageSubmissions: true,
  canViewReports: false,
  canManageWorkflows: isAdmin,
  canCustomize: false,
  isAdmin,
  canManageProxyAccess: false,
});

describe('workflow pages in the admin navigation', () => {
  it('puts daily-work pages and team queues in their design groups', () => {
    const registry = registryFor();

    expect(registry.tabs.find(({ key }) => key === 'needs-linking'))
      .toMatchObject({ canAccess: true, group: 'team-queues' });
    expect(registry.tabs.find(({ key }) => key === 'item-queue'))
      .toMatchObject({ label: 'Item Queue', canAccess: true, group: 'team-queues' });
    expect(registry.tabs.find(({ key }) => key === 'my-items'))
      .toMatchObject({ label: 'My Items', canAccess: true, group: 'my-work' });
    expect(registry.tabs.find(({ key }) => key === 'my-groups'))
      .toMatchObject({ label: 'My Groups', canAccess: true, group: 'my-work' });
  });

  it('shows Workflow Templates to admins in every build', () => {
    expect(registryFor(true).tabs.find(({ key }) => key === 'workflow-templates'))
      .toMatchObject({ canAccess: true, group: 'settings' });
  });

  it('places admin groups and access-path routing under Settings', () => {
    const tabs = registryFor(true).tabs;

    expect(tabs.find(({ key }) => key === 'groups')).toMatchObject({ label: 'Staff groups', group: 'settings' });
    expect(tabs.find(({ key }) => key === 'access-path-routing'))
      .toMatchObject({ label: 'Access path routing', canAccess: true, group: 'settings' });
  });
});
