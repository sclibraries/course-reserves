// src/pages/Admin.jsx
import { useState, useEffect } from 'react';
import { Container, Row, Col, Spinner, Alert, Nav, NavItem, NavLink } from 'reactstrap';
import AdminSidebar from '../components/AdminSidebar';
import ResourceSearchSidebar from '../components/ResourceSearchSidebar';
import AdminCourseList from '../components/AdminCourseList';
import ResourceListTable from '../components/ResourceListTable';
import useAdminSearchStore from '../store/adminSearchStore';
import useCourseStore from '../store';
import useResourceSearchStore from '../store/resourceSearchStore';
import { useBuildQuery } from '../hooks/useBuildQuery';
import { adminResourceService } from '../services/admin/adminResourceService';
import { useSearchParams } from 'react-router-dom';

function Admin() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { college, type, query, department } = useAdminSearchStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'courses';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { fetchResults, results: courses, error: courseError, loading: courseLoading } = useCourseStore();


  const { 
    filters: resourceFilters,
    results: resources,
    pagination: resourcePagination,
    error: resourceError,
    loading: resourceLoading,
    setSearchResults,
    setPagination
  } = useResourceSearchStore();


  // Build the query for fetching courses.
  const cqlQuery = useBuildQuery(college, type, query, department);
  

  // Fetch course results whenever the query changes.
  useEffect(() => {
    if (cqlQuery) {
      fetchResults(cqlQuery);
    }
  }, [cqlQuery, fetchResults]);

  useEffect(() => {
    if(activeTab === 'resources') {
      fetchResources();
    }
  }
  , [activeTab]);

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


  return (
    <Container fluid className="admin-page">
      <Row className="g-0">
        {/* Sidebar Column */}
        <Col md={3} className={`sidebar-wrapper ${isSidebarOpen ? 'open' : 'collapsed'}`}>
          {activeTab === 'courses' ? (
            <AdminSidebar isOpen={isSidebarOpen} toggle={() => setIsSidebarOpen(!isSidebarOpen)} />
          ) : (
            <ResourceSearchSidebar isOpen={isSidebarOpen} toggle={() => setIsSidebarOpen(!isSidebarOpen)} />
          )}
        </Col>

        {/* Main Content Column */}
        <Col className="admin-main-content">
          {/* Tab Navigation */}
          <Nav tabs className="mb-4">
            <NavItem>
              <NavLink
                active={activeTab === 'courses'}
                onClick={() => handleTabChange('courses')}
              >
                Course Management
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink
                active={activeTab === 'resources'}
                onClick={() => handleTabChange('resources')}
              >
                Resource Management
              </NavLink>
            </NavItem>
          </Nav>

          <div className="admin-content">
            {/* Error Display */}
            {(courseError || resourceError) && (
              <Alert color="danger" className="mt-3">
                {courseError?.message || resourceError?.message}
              </Alert>
            )}

            {/* Loading States */}
            {(courseLoading || resourceLoading) ? (
              <div className="text-center mt-5">
                <Spinner color="primary" />
                <p className="mt-2">
                  Loading {activeTab === 'courses' ? 'courses' : 'resources'}...
                </p>
              </div>
            ) : (
              /* Content Display */
              activeTab === 'courses' ? (
                <>
                  <h1>Course Management</h1>
                  <AdminCourseList courses={courses} />
                </>
              ) : (
                <>
                  <h1>Resource Management</h1>
                  <ResourceListTable 
                    resources={resources}
                    pagination={resourcePagination}
                    refreshResources={fetchResources}
                  />
                </>
              )
            )}
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default Admin;
