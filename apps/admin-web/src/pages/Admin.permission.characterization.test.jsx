import { describe, expect, it } from 'vitest';
import { createAdminTabRegistry, getDefaultAdminTab, getVisibleAdminGroups } from './adminTabRegistry';

const registryFor = ({ admin = false, permissions = [], role = 'employee' } = {}) => {
  const isAllowed = (permission) => admin || permissions.includes(permission);
  return createAdminTabRegistry({
    canManageCourses: isAllowed('manage_courses'),
    canManageResources: isAllowed('manage_resources'),
    canManageSubmissions: isAllowed('manage_submissions'),
    canViewReports: isAllowed('view_reports'),
    canManageWorkflows: admin,
    canCustomize: admin || permissions.some((permission) => permission.startsWith('customize_')),
    isAdmin: admin,
    canManageProxyAccess: ['staff', 'admin'].includes(role),
  });
};

describe('admin navigation permissions', () => {
  it('limits staff pages to granted pages and keeps admin settings out of staff navigation', () => {
    const registry = registryFor({ role: 'staff', permissions: ['manage_submissions'] });

    expect(getVisibleAdminGroups(registry).map(({ key }) => key)).toEqual(['my-work', 'team-queues', 'courses-records']);
    expect(registry.tabs.find(({ key }) => key === 'users').canAccess).toBe(false);
    expect(registry.tabs.find(({ key }) => key === 'proxy-access').canAccess).toBe(true);
    expect(registry.tabs.find(({ key }) => key === 'groups').label).toBe('Staff groups');
  });

  it('defaults staff without a work queue to their first allowed existing page', () => {
    const registry = registryFor({ permissions: ['view_reports'] });

    expect(getDefaultAdminTab(registry)).toBe('tracking');
  });

  it('shows all granted settings and the work-queue landing page to admins', () => {
    const registry = registryFor({ admin: true, role: 'admin' });

    expect(getVisibleAdminGroups(registry).map(({ key }) => key)).toEqual([
      'my-work', 'team-queues', 'courses-records', 'settings',
    ]);
    expect(getDefaultAdminTab(registry)).toBe('my-work');
  });
});
