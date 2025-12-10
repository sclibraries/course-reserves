import { useState, useEffect, useCallback } from 'react';
import { Container, Spinner, Alert, Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Badge, UncontrolledDropdown } from 'reactstrap';
import { FaChevronDown } from 'react-icons/fa';
import HorizontalAdminSidebar from '../components/layout/HorizontalAdminSidebar';
import HorizontalResourceSidebar from '../components/layout/HorizontalResourceSidebar';
import AdminCourseList from '../components/page-sections/admin/AdminCourseList';
import ResourceListTable from '../components/page-sections/admin/ResourceListTable';
import AdminCustomizations from '../components/page-sections/admin/AdminCustomizations';
import UserManagement from '../components/page-sections/admin/UserManagement';
import WorkflowTemplateManager from '../components/page-sections/admin/WorkflowTemplateManager';
import TrackingReport from './TrackingReport';
import SubmissionQueue from '../components/page-sections/admin/SubmissionQueue';
import MyWorkQueue from '../components/page-sections/admin/MyWorkQueue';
import MyMentions from '../components/page-sections/admin/MyMentions';
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
import '../css/AdminComponents.css';
import '../css/Admin.css';

function Admin() {
  const navigate = useNavigate();
  const { college, type, query, department, termId, fetchTerms, initializeDefaults, defaultsSet } = useAdminSearchStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'courses';
  const [activeTab, setActiveTab] = useState(initialTab);
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

  console.log(userPermissions)
  
  const canManageCourses = isAdmin || userPermissions.includes('manage_courses');
  const canManageResources = isAdmin || userPermissions.includes('manage_resources');
  const canViewReports = isAdmin || userPermissions.includes('view_reports');
  const canCustomize = isAdmin || userPermissions.some(perm => perm.startsWith('customize_'));
  const canManageSubmissions = isAdmin || userPermissions.includes('manage_submissions');
  const canManageWorkflows = isDevelopment && isAdmin; // Only admins in development can manage workflow templates
  
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
    
    // Check if user has permission to access the selected tab
    if ((tab === 'courses' && !canManageCourses) ||
        (tab === 'resources' && !canManageResources) ||
        (tab === 'tracking' && !canViewReports) ||
        (tab === 'customizations' && !canCustomize) ||
        (tab === 'submissions' && !canManageSubmissions) ||
        (tab === 'my-work' && !canManageSubmissions) ||
        (tab === 'mentions' && !canManageSubmissions) ||
        (tab === 'workflow-templates' && !canManageWorkflows) ||
        (tab === 'users' && !isAdmin)) {
      
      // Find first tab user has access to
      let allowedTab = null;
      if (canManageCourses) allowedTab = 'courses';
      else if (canManageResources) allowedTab = 'resources';
      else if (canManageSubmissions) allowedTab = 'submissions';
      else if (canViewReports) allowedTab = 'tracking';
      else if (canCustomize) allowedTab = 'customizations';
      
      // If we found an allowed tab, redirect there
      if (allowedTab) {
        setActiveTab(allowedTab);
        setSearchParams({ tab: allowedTab });
      }
      // Otherwise, we'll show the "no permissions" message
    } else {
      setActiveTab(tab);
    }
  }, [searchParams, canManageCourses, canManageResources, canManageSubmissions, canManageWorkflows, canViewReports, canCustomize, isAdmin, setSearchParams]);

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

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const toggleDropdown = () => setDropdownOpen(prevState => !prevState);
  
  // Check if user has access to any admin features
  const hasAnyPermission = canManageCourses || canManageResources || canManageSubmissions || canViewReports || canCustomize || isAdmin;
  
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

  return (
    <Container fluid className="admin-container p-0">
      {/* Tab Navigation */}
      <div className="bg-white shadow-sm">
        <div className="d-flex align-items-center px-4 py-3">
          {/* Desktop Tabs */}
          <div className="modern-tabs d-none d-md-flex">
            {canManageCourses && (
              <button 
                className={`tab-button ${activeTab === 'courses' ? 'active' : ''}`}
                onClick={() => handleTabChange('courses')}
                aria-label="Course Management Tab">
                Course Management
              </button>
            )}
            
            {canManageResources && (
              <button 
                className={`tab-button ${activeTab === 'resources' ? 'active' : ''}`}
                onClick={() => handleTabChange('resources')}
                aria-label="Resource Management Tab">
                Resource Management
              </button>
            )}
            
            {/* Workflow Dropdown - Only in development */}
            {isDevelopment && canManageSubmissions && (
              <UncontrolledDropdown nav inNavbar className="d-inline-block">
                <DropdownToggle 
                  nav 
                  className={`tab-button workflow-dropdown ${
                    ['submissions', 'my-work', 'mentions'].includes(activeTab) ? 'active' : ''
                  }`}
                  aria-label="Workflow Management">
                  Workflow
                  {(submissionsCount > 0 || myWorkCount > 0 || mentionsCount > 0) && (
                    <Badge 
                      color="danger" 
                      pill 
                      className="ms-2"
                      style={{ fontSize: '0.7rem' }}
                    >
                      {submissionsCount + myWorkCount + mentionsCount}
                    </Badge>
                  )}
                  <FaChevronDown className="ms-2" style={{ fontSize: '0.7rem' }} />
                </DropdownToggle>
                <DropdownMenu>
                  <DropdownItem 
                    onClick={() => handleTabChange('submissions')}
                    active={activeTab === 'submissions'}
                    className="d-flex justify-content-between align-items-center">
                    <span>Submissions Queue</span>
                    {submissionsCount > 0 && (
                      <Badge color="primary" pill>
                        {submissionsCount}
                      </Badge>
                    )}
                  </DropdownItem>
                  <DropdownItem 
                    onClick={() => handleTabChange('my-work')}
                    active={activeTab === 'my-work'}
                    className="d-flex justify-content-between align-items-center">
                    <span>My Work Queue</span>
                    {myWorkCount > 0 && (
                      <Badge color="success" pill>
                        {myWorkCount}
                      </Badge>
                    )}
                  </DropdownItem>
                  <DropdownItem 
                    onClick={() => handleTabChange('mentions')}
                    active={activeTab === 'mentions'}
                    className="d-flex justify-content-between align-items-center">
                    <span>My Mentions</span>
                    {mentionsCount > 0 && (
                      <Badge color="danger" pill>
                        {mentionsCount}
                      </Badge>
                    )}
                  </DropdownItem>
                </DropdownMenu>
              </UncontrolledDropdown>
            )}
            
            {canViewReports && (
              <button 
                className={`tab-button ${activeTab === 'tracking' ? 'active' : ''}`}
                onClick={() => handleTabChange('tracking')}
                aria-label="Tracking Reports Tab">
                Reports
              </button>
            )}
            
            {canManageWorkflows && (
              <button
                className={`tab-button ${activeTab === 'workflow-templates' ? 'active' : ''}`}
                onClick={() => handleTabChange('workflow-templates')}
                aria-label="Workflow Templates Tab">
                Workflow Templates
              </button>
            )}
            
            {canCustomize && (
              <button
                className={`tab-button ${activeTab === 'customizations' ? 'active' : ''}`}
                onClick={() => handleTabChange('customizations')}
                aria-label="Customizations Tab">
                Customizations
              </button>
            )}
            
            {isAdmin && (
              <button
                className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => handleTabChange('users')}
                aria-label="User Management Tab">
                User Management
              </button>
            )}
          </div>
          
          {/* Mobile Dropdown */}
          <div className="d-md-none w-100">
            <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown} className="mobile-tabs-dropdown">
              <DropdownToggle caret className="w-100 text-start d-flex justify-content-between align-items-center">
                {activeTab === 'courses' && 'Course Management'}
                {activeTab === 'resources' && 'Resource Management'}
                {activeTab === 'submissions' && (
                  <span>
                    Submissions Queue
                    {submissionsCount > 0 && (
                      <Badge color="primary" pill className="ms-2">
                        {submissionsCount}
                      </Badge>
                    )}
                  </span>
                )}
                {activeTab === 'my-work' && (
                  <span>
                    My Work Queue
                    {myWorkCount > 0 && (
                      <Badge color="success" pill className="ms-2">
                        {myWorkCount}
                      </Badge>
                    )}
                  </span>
                )}
                {activeTab === 'mentions' && (
                  <span>
                    My Mentions
                    {mentionsCount > 0 && (
                      <Badge color="danger" pill className="ms-2">
                        {mentionsCount}
                      </Badge>
                    )}
                  </span>
                )}
                {activeTab === 'tracking' && 'Reports'}
                {activeTab === 'workflow-templates' && 'Workflow Templates'}
                {activeTab === 'customizations' && 'Customizations'}
                {activeTab === 'users' && 'User Management'}
              </DropdownToggle>
              <DropdownMenu className="w-100">
                {canManageCourses && (
                  <DropdownItem 
                    onClick={() => handleTabChange('courses')}
                    active={activeTab === 'courses'}>
                    Course Management
                  </DropdownItem>
                )}
                
                {canManageResources && (
                  <DropdownItem 
                    onClick={() => handleTabChange('resources')}
                    active={activeTab === 'resources'}>
                    Resource Management
                  </DropdownItem>
                )}
                
                {isDevelopment && canManageSubmissions && (
                  <DropdownItem 
                    onClick={() => handleTabChange('submissions')}
                    active={activeTab === 'submissions'}
                    className="d-flex justify-content-between align-items-center">
                    <span>Submissions Queue</span>
                    {submissionsCount > 0 && (
                      <Badge color="primary" pill>
                        {submissionsCount}
                      </Badge>
                    )}
                  </DropdownItem>
                )}
                
                {isDevelopment && canManageSubmissions && (
                  <DropdownItem 
                    onClick={() => handleTabChange('my-work')}
                    active={activeTab === 'my-work'}
                    className="d-flex justify-content-between align-items-center">
                    <span>My Work Queue</span>
                    {myWorkCount > 0 && (
                      <Badge color="success" pill>
                        {myWorkCount}
                      </Badge>
                    )}
                  </DropdownItem>
                )}
                
                {isDevelopment && canManageSubmissions && (
                  <DropdownItem 
                    onClick={() => handleTabChange('mentions')}
                    active={activeTab === 'mentions'}
                    className="d-flex justify-content-between align-items-center">
                    <span>My Mentions</span>
                    {mentionsCount > 0 && (
                      <Badge color="danger" pill>
                        {mentionsCount}
                      </Badge>
                    )}
                  </DropdownItem>
                )}
                
                {canViewReports && (
                  <DropdownItem 
                    onClick={() => handleTabChange('tracking')}
                    active={activeTab === 'tracking'}>
                    Reports
                  </DropdownItem>
                )}
                
                {canManageWorkflows && (
                  <DropdownItem 
                    onClick={() => handleTabChange('workflow-templates')}
                    active={activeTab === 'workflow-templates'}>
                    Workflow Templates
                  </DropdownItem>
                )}
                
                {canCustomize && (
                  <DropdownItem 
                    onClick={() => handleTabChange('customizations')}
                    active={activeTab === 'customizations'}>
                    Customizations
                  </DropdownItem>
                )}
                
                {isAdmin && (
                  <DropdownItem 
                    onClick={() => handleTabChange('users')}
                    active={activeTab === 'users'}>
                    User Management
                  </DropdownItem>
                )}
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
      </div>

      <div className="admin-content px-4 py-3">
        {/* Error Display */}
        {(courseError || resourceError) && activeTab !== 'tracking' && (
          <Alert color="danger" className="mt-3 fade-in">
            {courseError?.message || resourceError?.message}
          </Alert>
        )}

        {/* Content Display */}
        {activeTab === 'courses' && canManageCourses ? (
          <>
            <div className="d-flex justify-content-between align-items-center mb-4 fade-in">
              <h1 className="h3 mb-0">Course Management</h1>
            </div>
            
            {/* Horizontal Course Search Bar */}
            <HorizontalAdminSidebar />
            
            {/* Loading States */}
            {courseLoading ? (
              <div className="text-center mt-5 fade-in">
                <Spinner color="primary" />
                <p className="mt-2">Loading courses...</p>
              </div>
            ) : (
              <AdminCourseList 
                courses={courses} 
                onCourseDetails={handleCourseDetails} 
              />
            )}
          </>
        ) : activeTab === 'resources' && canManageResources ? (
          <>
            <div className="d-flex justify-content-between align-items-center mb-4 fade-in">
              <h1 className="h3 mb-0">Resource Management</h1>
            </div>
            
            {/* Horizontal Resource Search Bar */}
            <HorizontalResourceSidebar refreshResources={fetchResources} />
            
            {/* Resource content */}
            {resourceLoading ? (
              <div className="text-center mt-5 fade-in">
                <Spinner color="primary" />
                <p className="mt-2">Loading resources...</p>
              </div>
            ) : (
              <ResourceListTable 
                resources={resources}
                pagination={resourcePagination}
                refreshResources={fetchResources}
              />
            )}
          </>
        ) : activeTab === 'submissions' && canManageSubmissions ? (
          // Submissions Queue Tab Content
          <div className="fade-in">
            <SubmissionQueue />
          </div>
        ) : activeTab === 'my-work' && canManageSubmissions ? (
          // My Work Queue Tab Content
          <div className="fade-in">
            <MyWorkQueue />
          </div>
        ) : activeTab === 'mentions' && canManageSubmissions ? (
          // My Mentions Tab Content
          <div className="fade-in">
            <MyMentions />
          </div>
        ) : activeTab === 'tracking' && canViewReports ? (
          // Tracking Reports Tab Content
          <div className="fade-in">
            <TrackingReport isEmbedded={true} />
          </div>
        ) : activeTab === 'workflow-templates' && canManageWorkflows ? (
          // Workflow Templates Tab Content - only shown for admins
          <div className="fade-in">
            <WorkflowTemplateManager />
          </div>
        ) : activeTab === 'users' && isAdmin ? (
          // User Management Tab Content - only shown for admins
          <div className="fade-in">
            <UserManagement />
          </div> 
        ) : activeTab === 'customizations' && canCustomize ? (
          // Customizations Tab Content
          <div className="fade-in">
            <AdminCustomizations 
              userInstitution={user?.institution}
              isAdmin={isAdmin}
            />
          </div>
        ) : (
          // Access Denied for the specific tab
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