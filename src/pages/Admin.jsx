import { useState, useEffect } from 'react';
import { Container, Spinner, Alert } from 'reactstrap';
import HorizontalAdminSidebar from '../components/layout/HorizontalAdminSidebar';
import HorizontalResourceSidebar from '../components/layout/HorizontalResourceSidebar';
import AdminCourseList from '../components/page-sections/admin/AdminCourseList';
import ResourceListTable from '../components/page-sections/admin/ResourceListTable';
import AdminCustomizations from '../components/page-sections/admin/AdminCustomizations';
import TrackingReport from './TrackingReport'; 
import useAdminSearchStore from '../store/adminSearchStore';
import useCourseStore from '../store';
import useResourceSearchStore from '../store/resourceSearchStore';
import { useBuildQuery } from '../hooks/useBuildQuery';
import { adminResourceService } from '../services/admin/adminResourceService';
import { useSearchParams, useNavigate } from 'react-router-dom';
import useSearchStore from '../store/searchStore';
import '../css/AdminComponents.css';
import '../css/Admin.css';

function Admin() {
  const navigate = useNavigate();
  const { college, type, query, department } = useAdminSearchStore();
  const { termId } = useSearchStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'courses';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { fetchResults, results: courses, error: courseError, loading: courseLoading } = useCourseStore();

  const { 
    results: resources,
    pagination: resourcePagination,
    error: resourceError,
    loading: resourceLoading,
    setSearchResults,
  } = useResourceSearchStore();

  // Build the query for fetching courses.
  const cqlQuery = useBuildQuery(college, type, query, department);

  // Fetch course results whenever the query changes.
  useEffect(() => {
    if (termId && cqlQuery) {
      fetchResults(cqlQuery);
    }
  }, [cqlQuery, fetchResults, termId]);

  useEffect(() => {
    if(activeTab === 'resources') {
      fetchResources();
    }
  }, [activeTab]);

  useEffect(() => {
    const tab = searchParams.get('tab') || 'courses';
    setActiveTab(tab);
  }, [searchParams]);

  const fetchResources = async () => {
    try {
      const data = await adminResourceService.getAllResources();
      setSearchResults(data);
    }
    catch (error) {
      console.error('Fetch resources failed:', error);
    }
  }

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setSearchParams({ tab: tabName });
  };

  const handleCourseDetails = (courseId) => {
    navigate(`/admin/electronic/${courseId}`);
  };

  return (
    <Container fluid className="admin-container p-0">
      {/* Tab Navigation */}
      <div className="bg-white shadow-sm">
        <div className="d-flex align-items-center px-4 py-3">
          <div className="modern-tabs">
            <button 
              className={`tab-button ${activeTab === 'courses' ? 'active' : ''}`}
              onClick={() => handleTabChange('courses')}
              aria-label="Course Management Tab">
              Course Management
            </button>
            <button 
              className={`tab-button ${activeTab === 'resources' ? 'active' : ''}`}
              onClick={() => handleTabChange('resources')}
              aria-label="Resource Management Tab">
              Resource Management
            </button>
            <button 
              className={`tab-button ${activeTab === 'tracking' ? 'active' : ''}`}
              onClick={() => handleTabChange('tracking')}
              aria-label="Tracking Reports Tab">
              Reports
            </button>
            <button
              className={`tab-button ${activeTab === 'customizations' ? 'active' : ''}`}
              onClick={() => handleTabChange('customizations')}
              aria-label="Customizations Tab">
              Customizations
            </button>
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
        {activeTab === 'courses' ? (
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
        ) : activeTab === 'resources' ? (
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
        ) : activeTab == 'tracking' ? (
          // Tracking Reports Tab Content
          <div className="fade-in">
            <TrackingReport isEmbedded={true} />
          </div>
        ) : (
          // Customizations Tab Content
          <div className="fade-in">
            <AdminCustomizations />
          </div>
        )}
      </div>
    </Container>
  );
}

export default Admin;
