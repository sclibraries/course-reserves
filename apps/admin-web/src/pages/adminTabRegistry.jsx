import { Spinner } from 'reactstrap';
import {
  AtSign, BarChart3, BookOpen, CheckSquare, ClipboardList, Link, Library,
  ListTodo, Route, Settings2, UserCog, UserRound, Users, UsersRound,
} from 'lucide-react';
import HorizontalAdminSidebar from '../components/layout/HorizontalAdminSidebar';
import HorizontalResourceSidebar from '../components/layout/HorizontalResourceSidebar';
import AdminCourseList from '../components/page-sections/admin/AdminCourseList';
import ResourceListTable from '../components/page-sections/admin/ResourceListTable';
import AdminCustomizations from '../components/page-sections/admin/AdminCustomizations';
import DefaultPinsSettings from '../components/page-sections/admin/DefaultPinsSettings';
import UserManagement from '../components/page-sections/admin/UserManagement';
import ChecklistTemplateManager from '../components/page-sections/admin/ChecklistTemplateManager';
import SubmissionQueue from '../components/page-sections/admin/SubmissionQueue';
import MyWorkQueue from '../components/page-sections/admin/MyWorkQueue';
import MyMentions from '../components/page-sections/admin/MyMentions';
import TrackingReport from './TrackingReport';
import FacultyProxyAccess from '../components/page-sections/admin/proxy-access/FacultyProxyAccess';
import NeedsLinkingList from '../components/page-sections/admin/linking/NeedsLinkingList';
import ClaimQueue from '../components/page-sections/admin/claims/ClaimQueue';
import MyClaimedItems from '../components/page-sections/admin/claims/MyClaimedItems';
import MyGroups from '../components/page-sections/admin/groups/MyGroups';
import AdminGroups from '../components/page-sections/admin/groups/AdminGroups';
import AccessPathRoutingTab from '../components/page-sections/admin/access-path-routing/AccessPathRoutingTab';
import { isStaffOrAdminRole } from '../util/roles';

export const ADMIN_NAV_GROUPS = [
  { key: 'my-work', label: 'My work', icon: CheckSquare },
  { key: 'team-queues', label: 'Team queues', icon: ClipboardList },
  { key: 'courses-records', label: 'Courses & records', icon: BookOpen },
  { key: 'settings', label: 'Settings', icon: Settings2 },
];

export const canAccessProxyTab = (role) => isStaffOrAdminRole(role);

export function createAdminTabRegistry({
  canManageCourses,
  canManageResources,
  canManageSubmissions,
  canViewReports,
  canManageWorkflows,
  canCustomize,
  isAdmin,
  canManageProxyAccess,
}) {
  return {
    tabs: [
      {
        key: 'my-work', label: 'My Work Queue', group: 'my-work', icon: CheckSquare,
        canAccess: canManageSubmissions,
        renderContent: () => <div className="fade-in"><MyWorkQueue /></div>,
      },
      {
        key: 'my-items', label: 'My Items', group: 'my-work', icon: CheckSquare,
        canAccess: canManageSubmissions,
        renderContent: () => <div className="fade-in"><MyClaimedItems /></div>,
      },
      {
        key: 'my-groups', label: 'My Groups', group: 'my-work', icon: UsersRound,
        canAccess: canManageSubmissions,
        renderContent: () => <div className="fade-in"><MyGroups /></div>,
      },
      {
        key: 'mentions', label: 'My Mentions', group: 'my-work', icon: AtSign,
        canAccess: canManageSubmissions,
        renderContent: () => <div className="fade-in"><MyMentions /></div>,
      },
      {
        key: 'submissions', label: 'Submissions Queue', group: 'team-queues', icon: ClipboardList,
        canAccess: canManageSubmissions,
        renderContent: () => <div className="fade-in"><SubmissionQueue /></div>,
      },
      {
        key: 'item-queue', label: 'Item Queue', group: 'team-queues', icon: ListTodo,
        canAccess: canManageSubmissions,
        renderContent: () => <div className="fade-in"><ClaimQueue /></div>,
      },
      {
        key: 'needs-linking', label: 'Needs Linking', group: 'team-queues', icon: Link,
        canAccess: canManageSubmissions,
        renderContent: () => <div className="fade-in"><NeedsLinkingList /></div>,
      },
      {
        key: 'courses', label: 'Course Management', group: 'courses-records', icon: BookOpen,
        ariaLabel: 'Course Management Tab', canAccess: canManageCourses,
        renderContent: ({ courses, courseLoading, onCourseDetails }) => (
          <>
            <div className="d-flex justify-content-between align-items-center mb-4 fade-in">
              <h1 className="h3 mb-0">Course Management</h1>
            </div>
            <HorizontalAdminSidebar />
            {courseLoading ? (
              <div className="text-center mt-5 fade-in">
                <Spinner color="primary" />
                <p className="mt-2">Loading courses...</p>
              </div>
            ) : (
              <AdminCourseList courses={courses} onCourseDetails={onCourseDetails} />
            )}
          </>
        ),
      },
      {
        key: 'resources', label: 'Resource Management', group: 'courses-records', icon: Library,
        ariaLabel: 'Resource Management Tab', canAccess: canManageResources,
        renderContent: ({ resources, resourceLoading, resourcePagination, refreshResources }) => (
          <>
            <div className="d-flex justify-content-between align-items-center mb-4 fade-in">
              <h1 className="h3 mb-0">Resource Management</h1>
            </div>
            <HorizontalResourceSidebar refreshResources={refreshResources} />
            {resourceLoading ? (
              <div className="text-center mt-5 fade-in">
                <Spinner color="primary" />
                <p className="mt-2">Loading resources...</p>
              </div>
            ) : (
              <ResourceListTable
                resources={resources}
                pagination={resourcePagination}
                refreshResources={refreshResources}
              />
            )}
          </>
        ),
      },
      {
        key: 'proxy-access', label: 'Proxy access', group: 'courses-records', icon: UserRound,
        ariaLabel: 'Proxy Access Tab', canAccess: canManageProxyAccess,
        renderContent: () => <div className="fade-in"><FacultyProxyAccess /></div>,
      },
      {
        key: 'tracking', label: 'Reports', group: 'courses-records', icon: BarChart3,
        ariaLabel: 'Tracking Reports Tab', canAccess: canViewReports,
        renderContent: () => <div className="fade-in"><TrackingReport isEmbedded /></div>,
      },
      {
        key: 'workflow-templates', label: 'Workflow Templates', group: 'settings', icon: ListTodo,
        ariaLabel: 'Workflow Templates Tab', canAccess: canManageWorkflows,
        renderContent: () => <div className="fade-in"><ChecklistTemplateManager /></div>,
      },
      {
        key: 'access-path-routing', label: 'Access path routing', group: 'settings', icon: Route,
        ariaLabel: 'Access path routing Tab', canAccess: isAdmin,
        renderContent: () => <div className="fade-in"><AccessPathRoutingTab /></div>,
      },
      {
        key: 'groups', label: 'Staff groups', group: 'settings', icon: Users,
        ariaLabel: 'Staff Groups Tab', canAccess: isAdmin,
        renderContent: () => <div className="fade-in"><AdminGroups /></div>,
      },
      {
        key: 'users', label: 'User Management', group: 'settings', icon: UserCog,
        ariaLabel: 'User Management Tab', canAccess: isAdmin,
        renderContent: () => <div className="fade-in"><UserManagement /></div>,
      },
      {
        key: 'customizations', label: 'Customizations', group: 'settings', icon: Settings2,
        ariaLabel: 'Customizations Tab', canAccess: canCustomize,
        renderContent: ({ userInstitution, tabRegistry }) => (
          <div className="fade-in">
            <AdminCustomizations userInstitution={userInstitution} isAdmin={isAdmin} />
            {isAdmin && <DefaultPinsSettings isAdmin groups={getVisibleAdminGroups(tabRegistry)} />}
          </div>
        ),
      },
    ],
  };
}

export function getVisibleAdminGroups(registry) {
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    tabs: registry.tabs.filter((tab) => tab.group === group.key && tab.canAccess),
  })).filter(({ tabs }) => tabs.length > 0);
}

export function getFirstAllowedAdminTab(registry) {
  const preferredKeys = [
    'courses', 'resources', 'submissions', 'tracking', 'customizations', 'proxy-access',
  ];
  return preferredKeys.find((key) => registry.tabs.some((tab) => tab.key === key && tab.canAccess)) || null;
}

export function getDefaultAdminTab(registry) {
  const myWork = registry.tabs.find((tab) => tab.key === 'my-work' && tab.canAccess);
  return myWork?.key || getFirstAllowedAdminTab(registry);
}

export function getAdminTabForPath(pathname) {
  const detailRoutes = [
    [/^\/admin\/work-queue\//, 'my-work'],
    [/^\/admin\/submissions\//, 'submissions'],
    [/^\/admin\/electronic\//, 'courses'],
    [/^\/admin\/reports(?:\/|$)/, 'tracking'],
  ];
  return detailRoutes.find(([pattern]) => pattern.test(pathname))?.[1] || null;
}

export const getAdminTab = (registry, key) => registry.tabs.find((tab) => tab.key === key);
export const hasAdminTabAccess = (registry) => registry.tabs.some((tab) => tab.canAccess);
