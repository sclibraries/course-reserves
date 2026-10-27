import { describe, expect, it } from 'vitest';
import {
  ADMIN_NAV_GROUPS,
  createAdminTabRegistry,
  getAdminTabForPath,
  getDefaultAdminTab,
  getVisibleAdminGroups,
} from './adminTabRegistry';

const registryFor = (overrides = {}) => createAdminTabRegistry({
  canManageCourses: true,
  canManageResources: true,
  canManageSubmissions: true,
  canViewReports: true,
  canManageWorkflows: true,
  canCustomize: true,
  isAdmin: true,
  canManageProxyAccess: true,
  ...overrides,
});

describe('admin navigation registry', () => {
  it('groups pages in design order with their approved labels', () => {
    const registry = registryFor();

    expect(ADMIN_NAV_GROUPS.map(({ key, label }) => [key, label])).toEqual([
      ['my-work', 'My work'],
      ['team-queues', 'Team queues'],
      ['courses-records', 'Courses & records'],
      ['settings', 'Settings'],
    ]);
    expect(registry.tabs.map(({ key, group, label }) => [group, key, label])).toEqual([
      ['my-work', 'my-work', 'My Work Queue'],
      ['my-work', 'my-items', 'My Items'],
      ['my-work', 'my-groups', 'My Groups'],
      ['my-work', 'mentions', 'My Mentions'],
      ['team-queues', 'submissions', 'Submissions Queue'],
      ['team-queues', 'item-queue', 'Item Queue'],
      ['team-queues', 'needs-linking', 'Needs Linking'],
      ['courses-records', 'courses', 'Course Management'],
      ['courses-records', 'resources', 'Resource Management'],
      ['courses-records', 'proxy-access', 'Proxy access'],
      ['courses-records', 'tracking', 'Reports'],
      ['settings', 'workflow-templates', 'Workflow Templates'],
      ['settings', 'access-path-routing', 'Access path routing'],
      ['settings', 'groups', 'Staff groups'],
      ['settings', 'users', 'User Management'],
      ['settings', 'customizations', 'Customizations'],
    ]);
    expect(registry.tabs.every(({ icon }) => icon)).toBe(true);
    expect(registry.navigationOrder).toBeUndefined();
  });

  it('shows only allowed entries and hides empty groups', () => {
    const registry = registryFor({
      canManageCourses: false,
      canManageResources: false,
      canManageSubmissions: true,
      canViewReports: false,
      canManageWorkflows: false,
      canCustomize: false,
      isAdmin: false,
      canManageProxyAccess: false,
    });

    expect(getVisibleAdminGroups(registry).map(({ key }) => key)).toEqual(['my-work', 'team-queues']);
    expect(registry.tabs.find(({ key }) => key === 'groups')).toMatchObject({
      label: 'Staff groups', canAccess: false,
    });
  });

  it('opens My Work Queue by default and retains the previous allowed fallback', () => {
    expect(getDefaultAdminTab(registryFor())).toBe('my-work');
    expect(getDefaultAdminTab(registryFor({
      canManageSubmissions: false,
      canManageCourses: false,
      canManageResources: false,
      canViewReports: true,
      isAdmin: false,
      canManageProxyAccess: false,
      canCustomize: false,
      canManageWorkflows: false,
    }))).toBe('tracking');
  });

  it('maps detail routes to their parent navigation entries', () => {
    expect(getAdminTabForPath('/admin/work-queue/31')).toBe('my-work');
    expect(getAdminTabForPath('/admin/submissions/42')).toBe('submissions');
    expect(getAdminTabForPath('/admin/electronic/63/syllabus-request')).toBe('courses');
    expect(getAdminTabForPath('/admin/reports')).toBe('tracking');
    expect(getAdminTabForPath('/admin')).toBeNull();
  });

  it('keeps workflow pages visible in production whenever the caller grants access', () => {
    const registry = registryFor({ canManageWorkflows: true, canManageSubmissions: true });

    expect(registry.tabs.find(({ key }) => key === 'workflow-templates').canAccess).toBe(true);
    expect(registry.tabs.find(({ key }) => key === 'needs-linking').canAccess).toBe(true);
    expect(registry.workflowVisible).toBeUndefined();
  });
});
