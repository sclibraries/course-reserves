import { Spinner } from 'reactstrap';
import HorizontalAdminSidebar from '../components/layout/HorizontalAdminSidebar';
import HorizontalResourceSidebar from '../components/layout/HorizontalResourceSidebar';
import AdminCourseList from '../components/page-sections/admin/AdminCourseList';
import ResourceListTable from '../components/page-sections/admin/ResourceListTable';
import AdminCustomizations from '../components/page-sections/admin/AdminCustomizations';
import UserManagement from '../components/page-sections/admin/UserManagement';
import ChecklistTemplateManager from '../components/page-sections/admin/ChecklistTemplateManager';
import SubmissionQueue from '../components/page-sections/admin/SubmissionQueue';
import MyWorkQueue from '../components/page-sections/admin/MyWorkQueue';
import MyMentions from '../components/page-sections/admin/MyMentions';
import TrackingReport from './TrackingReport';
import FacultyProxyAccess from '../components/page-sections/admin/proxy-access/FacultyProxyAccess';
import NeedsLinkingList from '../components/page-sections/admin/linking/NeedsLinkingList';
import { isStaffOrAdminRole } from '../util/roles';

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
  isDevelopment,
}) {
  return {
    workflowVisible: isDevelopment && canManageSubmissions,
    navigationOrder: [
      'courses', 'resources', 'workflow', 'tracking', 'workflow-templates',
      'customizations', 'users', 'proxy-access',
    ],
    tabs: [
      {
        key: 'courses',
        label: 'Course Management',
        ariaLabel: 'Course Management Tab',
        canAccess: canManageCourses,
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
        key: 'resources',
        label: 'Resource Management',
        ariaLabel: 'Resource Management Tab',
        canAccess: canManageResources,
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
        key: 'needs-linking',
        label: 'Needs Linking',
        navigationGroup: 'workflow',
        canAccess: canManageSubmissions,
        renderContent: () => <div className="fade-in"><NeedsLinkingList /></div>,
      },
      {
        key: 'submissions',
        label: 'Submissions Queue',
        navigationGroup: 'workflow',
        canAccess: canManageSubmissions,
        renderContent: () => <div className="fade-in"><SubmissionQueue /></div>,
      },
      {
        key: 'my-work',
        label: 'My Work Queue',
        navigationGroup: 'workflow',
        canAccess: canManageSubmissions,
        renderContent: () => <div className="fade-in"><MyWorkQueue /></div>,
      },
      {
        key: 'mentions',
        label: 'My Mentions',
        navigationGroup: 'workflow',
        canAccess: canManageSubmissions,
        renderContent: () => <div className="fade-in"><MyMentions /></div>,
      },
      {
        key: 'tracking',
        label: 'Reports',
        ariaLabel: 'Tracking Reports Tab',
        canAccess: canViewReports,
        renderContent: () => <div className="fade-in"><TrackingReport isEmbedded />
        </div>,
      },
      {
        key: 'workflow-templates',
        label: 'Workflow Templates',
        ariaLabel: 'Workflow Templates Tab',
        canAccess: canManageWorkflows,
        renderContent: () => <div className="fade-in"><ChecklistTemplateManager /></div>,
      },
      {
        key: 'customizations',
        label: 'Customizations',
        ariaLabel: 'Customizations Tab',
        canAccess: canCustomize,
        renderContent: ({ userInstitution }) => (
          <div className="fade-in">
            <AdminCustomizations userInstitution={userInstitution} isAdmin={isAdmin} />
          </div>
        ),
      },
      {
        key: 'users',
        label: 'User Management',
        ariaLabel: 'User Management Tab',
        canAccess: isAdmin,
        renderContent: () => <div className="fade-in"><UserManagement /></div>,
      },
      {
        key: 'proxy-access',
        label: 'Proxy access',
        ariaLabel: 'Proxy Access Tab',
        canAccess: canManageProxyAccess,
        renderContent: () => <div className="fade-in"><FacultyProxyAccess /></div>,
      },
    ],
  };
}

export function getFirstAllowedAdminTab(registry) {
  const preferredKeys = [
    'courses', 'resources', 'submissions', 'tracking', 'customizations', 'proxy-access',
  ];
  return preferredKeys.find((key) => registry.tabs.some((tab) => tab.key === key && tab.canAccess)) || null;
}

export const hasAdminTabAccess = (registry) => registry.tabs.some((tab) => tab.canAccess);

export const getAdminTab = (registry, key) => registry.tabs.find((tab) => tab.key === key);
