import { describe, expect, it } from 'vitest';
import { canAccessProxyTab, createAdminTabRegistry } from './adminTabRegistry';

describe('Proxy access navigation permission', () => {
  it('allows staff and admins and keeps it hidden from other roles', () => {
    expect(canAccessProxyTab('staff')).toBe(true);
    expect(canAccessProxyTab('admin')).toBe(true);
    expect(canAccessProxyTab('employee')).toBe(false);
  });

  it('keeps proxy access out of the registry for non-staff roles', () => {
    const registry = createAdminTabRegistry({
      canManageCourses: false,
      canManageResources: false,
      canManageSubmissions: true,
      canViewReports: false,
      canManageWorkflows: false,
      canCustomize: false,
      isAdmin: false,
      canManageProxyAccess: canAccessProxyTab('employee'),
    });

    expect(registry.tabs.find(({ key }) => key === 'proxy-access').canAccess).toBe(false);
  });
});
