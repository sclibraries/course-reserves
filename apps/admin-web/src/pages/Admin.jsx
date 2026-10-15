import { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Alert } from 'reactstrap';
import useAdminSearchStore from '../store/adminSearchStore';
import useCourseStore from '../store';
import useResourceSearchStore from '../store/resourceSearchStore';
import useSubmissionWorkflowStore from '../store/submissionWorkflowStore';
import useUnreadMessages from '../hooks/useUnreadMessages';
import { useBuildQuery } from '../hooks/useBuildQuery';
import { adminResourceService } from '../services/admin/adminResourceService';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentTermId } from '../hooks/useCurrentTermId';
import { apiConfig } from '../config/api.config';
import AdminTabNavigation from './AdminTabNavigation';
import {
  canAccessProxyTab,
  createAdminTabRegistry,
  getAdminTab,
  getFirstAllowedAdminTab,
  hasAdminTabAccess,
} from './adminTabRegistry';
import '../css/AdminComponents.css';
import '../css/Admin.css';

function Admin() {
  const navigate = useNavigate();
  const { college, type, query, department, termId, fetchTerms, initializeDefaults, defaultsSet } = useAdminSearchStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'courses';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { fetchResults, results: courses, error: courseError, loading: courseLoading } = useCourseStore();
  const { user, isAdmin } = useAuth();
  
  // Check if we're in development mode
  const isDevelopment = apiConfig.environment !== 'production';
  
  // Get unread mentions count (only in development)
  const { unreadCount: mentionsCount } = useUnreadMessages(30000, isDevelopment);
  
  // Get submission workflow counts
  const { 
    pagination: submissionPagination,
    claimedItems,
    fetchPendingSubmissions,
    fetchClaimedItems
  } = useSubmissionWorkflowStore();
  
  // Get counts for badges
  const submissionsCount = submissionPagination?.totalCount || 0;
  const myWorkCount = claimedItems?.length || 0;
  
  // Get current term information
  const { termId: currentTermId, loading: termLoading } = useCurrentTermId();

  const { 
    results: resources,
    pagination: resourcePagination,
    error: resourceError,
    loading: resourceLoading,
    setSearchResults,
  } = useResourceSearchStore();

  // Determine permission-based access to tabs
  const userPermissions = user?.permissions || [];

  console.log(userPermissions);
  
  const canManageCourses = isAdmin || userPermissions.includes('manage_courses');
  const canManageResources = isAdmin || userPermissions.includes('manage_resources');
  const canViewReports = isAdmin || userPermissions.includes('view_reports');
  const canCustomize = isAdmin || userPermissions.some(perm => perm.startsWith('customize_'));
  const canManageSubmissions = isAdmin || userPermissions.includes('manage_submissions');
  const canManageWorkflows = isDevelopment && isAdmin; // Only admins in development can manage workflow templates
  const canManageProxyAccess = canAccessProxyTab(user?.role);
  const tabRegistry = useMemo(() => createAdminTabRegistry({
    canManageCourses,
    canManageResources,
    canManageSubmissions,
    canViewReports,
    canManageWorkflows,
    canCustomize,
    isAdmin,
    canManageProxyAccess,
    isDevelopment,
  }), [
    canManageCourses,
    canManageResources,
    canManageSubmissions,
    canViewReports,
    canManageWorkflows,
    canCustomize,
    isAdmin,
    canManageProxyAccess,
    isDevelopment,
  ]);
  
  // Build the query for fetching courses.
  const cqlQuery = useBuildQuery(college, type, query, department, null, termId);

  const fetchResources = useCallback(async () => {
    try {
      const data = await adminResourceService.getAllResources();
      setSearchResults(data);
    }
    catch (error) {
      console.error('Fetch resources failed:', error);
    }
  }, [setSearchResults]);

  // Fetch terms for admin store on mount
  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  // Set defaults when component first loads and user data is available
  useEffect(() => {
    // Only set defaults if we have user data and current term, and haven't set them yet
    if (user?.institution && currentTermId && !termLoading && !defaultsSet) {
      // Initialize defaults based on user institution and current term
      initializeDefaults(user.institution, currentTermId);
    }
  }, [user?.institution, currentTermId, termLoading, defaultsSet, initializeDefaults]);

  // Fetch course results whenever the query changes.
  useEffect(() => {
    if (cqlQuery && canManageCourses) {
      fetchResults(cqlQuery);
    }
  }, [cqlQuery, fetchResults, termId, canManageCourses]);

  useEffect(() => {
    if(activeTab === 'resources' && canManageResources) {
      fetchResources();
    }
  }, [activeTab, canManageResources, fetchResources]);

  // Fetch submission counts when user has permission
  useEffect(() => {
    if (canManageSubmissions) {
      // Fetch pending submissions count (first page to get total count)
      fetchPendingSubmissions(1, 20);
      // Fetch claimed items count
      fetchClaimedItems();
    }
  }, [canManageSubmissions, fetchPendingSubmissions, fetchClaimedItems]);

  // Redirect to appropriate tab based on permissions
  useEffect(() => {
    const tab = searchParams.get('tab') || 'courses';
    const selectedDefinition = getAdminTab(tabRegistry, tab);

    if (selectedDefinition && !selectedDefinition.canAccess) {
      const allowedTab = getFirstAllowedAdminTab(tabRegistry);
      if (allowedTab) {
        setActiveTab(allowedTab);
        setSearchParams({ tab: allowedTab });
      }
    } else {
      setActiveTab(tab);
    }
  }, [searchParams, tabRegistry, setSearchParams]);

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    // Preserve any existing query params like item ID
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tabName);
    setSearchParams(newParams);
  };

  const handleCourseDetails = (courseId) => {
    navigate(`/admin/electronic/${courseId}`);
  };

  const toggleDropdown = () => setDropdownOpen(previous => !previous);

  // Check if user has access to any admin features
  const hasAnyPermission = hasAdminTabAccess(tabRegistry);
  
  if (!hasAnyPermission) {
    return (
      <Container className="mt-5">
        <Alert color="warning">
          <h4 className="alert-heading">Access Restricted</h4>
          <p>You don&apos;t have permission to access any administrative features. If you believe this is a mistake, please contact your system administrator.</p>
        </Alert>
      </Container>
    );
  }

  const activeDefinition = getAdminTab(tabRegistry, activeTab);
  const contentContext = {
    courses,
    courseLoading,
    onCourseDetails: handleCourseDetails,
    resources,
    resourceLoading,
    resourcePagination,
    refreshResources: fetchResources,
    userInstitution: user?.institution,
  };

  return (
    <Container fluid className="admin-container p-0">
      <AdminTabNavigation
        tabs={tabRegistry.tabs}
        navigationOrder={tabRegistry.navigationOrder}
        activeTab={activeTab}
        workflowVisible={tabRegistry.workflowVisible}
        counts={{ submissions: submissionsCount, myWork: myWorkCount, mentions: mentionsCount }}
        onTabChange={handleTabChange}
        dropdownOpen={dropdownOpen}
        toggleDropdown={toggleDropdown}
      />

      <div className="admin-content px-4 py-3">
        {(courseError || resourceError) && activeTab !== 'tracking' && (
          <Alert color="danger" className="mt-3 fade-in">
            {courseError?.message || resourceError?.message}
          </Alert>
        )}
        {activeDefinition?.canAccess ? activeDefinition.renderContent(contentContext) : (
          <div className="text-center mt-5 fade-in">
            <Alert color="warning">
              <h4 className="alert-heading">Access Restricted</h4>
              <p>You don&apos;t have permission to access this feature.</p>
            </Alert>
          </div>
        )}
      </div>
    </Container>
  );
}

export default Admin;
