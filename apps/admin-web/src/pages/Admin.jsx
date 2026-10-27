import { useCallback, useEffect } from 'react';
import { Alert, Container } from 'reactstrap';
import { useNavigate, useOutletContext } from 'react-router-dom';
import useAdminSearchStore from '../store/adminSearchStore';
import useCourseStore from '../store';
import useResourceSearchStore from '../store/resourceSearchStore';
import { useBuildQuery } from '../hooks/useBuildQuery';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentTermId } from '../hooks/useCurrentTermId';
import { adminResourceService } from '../services/admin/adminResourceService';
import { getAdminTab } from './adminTabRegistry';
import '../css/AdminComponents.css';
import '../css/Admin.css';

function Admin() {
  const navigate = useNavigate();
  const { activeTab, hasAccess, tabRegistry } = useOutletContext();
  const {
    college, type, query, department, termId, fetchTerms, initializeDefaults, defaultsSet,
  } = useAdminSearchStore();
  const { fetchResults, results: courses, error: courseError, loading: courseLoading } = useCourseStore();
  const { user } = useAuth();
  const { termId: currentTermId, loading: termLoading } = useCurrentTermId();
  const {
    results: resources,
    pagination: resourcePagination,
    error: resourceError,
    loading: resourceLoading,
    setSearchResults,
  } = useResourceSearchStore();
  const cqlQuery = useBuildQuery(college, type, query, department, null, termId);

  const fetchResources = useCallback(async () => {
    try {
      setSearchResults(await adminResourceService.getAllResources());
    } catch (error) {
      console.error('Fetch resources failed:', error);
    }
  }, [setSearchResults]);

  useEffect(() => { fetchTerms(); }, [fetchTerms]);

  useEffect(() => {
    if (user?.institution && currentTermId && !termLoading && !defaultsSet) {
      initializeDefaults(user.institution, currentTermId);
    }
  }, [user?.institution, currentTermId, termLoading, defaultsSet, initializeDefaults]);

  useEffect(() => {
    if (cqlQuery && tabRegistry.tabs.find((tab) => tab.key === 'courses')?.canAccess) {
      fetchResults(cqlQuery);
    }
  }, [cqlQuery, fetchResults, termId, tabRegistry]);

  useEffect(() => {
    if (activeTab === 'resources' && tabRegistry.tabs.find((tab) => tab.key === 'resources')?.canAccess) {
      fetchResources();
    }
  }, [activeTab, fetchResources, tabRegistry]);

  if (!hasAccess) {
    return (
      <Container className="mt-5">
        <Alert color="warning">
          <h1 className="alert-heading h4">Access Restricted</h1>
          <p>You don&apos;t have permission to access any administrative features. If you believe this is a mistake, please contact your system administrator.</p>
        </Alert>
      </Container>
    );
  }

  const activeDefinition = getAdminTab(tabRegistry, activeTab);
  const contentContext = {
    courses,
    courseLoading,
    onCourseDetails: (courseId) => navigate(`/admin/electronic/${courseId}`),
    resources,
    resourceLoading,
    resourcePagination,
    refreshResources: fetchResources,
    tabRegistry,
    userInstitution: user?.institution,
  };

  return (
    <div className="admin-container tw-min-w-0 tw-w-full">
      {(courseError || resourceError) && activeTab !== 'tracking' && (
        <Alert color="danger" className="mt-3 fade-in" role="alert">
          {courseError?.message || resourceError?.message}
        </Alert>
      )}
      {activeDefinition?.canAccess ? activeDefinition.renderContent(contentContext) : (
        <div className="text-center mt-5 fade-in">
          <Alert color="warning">
            <h1 className="alert-heading h4">Access Restricted</h1>
            <p>You don&apos;t have permission to access this feature.</p>
          </Alert>
        </div>
      )}
    </div>
  );
}

export default Admin;
