// src/components/AdminElectronicResources.js
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  Container,
  Row,
  Col,
  Button,
  Alert,
  Spinner,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
  Table
} from 'reactstrap';
import classnames from 'classnames';
import { fetchCourseData } from './CourseRecords/api';
import { adminCourseService } from '../services/admin/adminCourseService';
import { useAdminModal } from '../hooks/admin/useAdminModal';
import { useAdminResourceStore } from '../store/adminResourceStore';
import { transformFolioCourseToLocal } from '../util/adminTransformers';
import { AdminResourceTable } from '../components/admin/AdminResourceTable';
import { AdminNewResourceModal } from '../components/admin/modals/AdminNewResourceModal';
import { AdminReuseResourceModal } from '../components/admin/modals/AdminReuseResourceModal';
import { ADMIN_ERROR_MESSAGES } from '../constants/admin';
import { AdminEDSResourceModal } from '../components/admin/modals/AdminEDSResourceModal';
import { AdminHitchCockResourceModal } from '../components/admin/modals/AdminHitchcockResourceModal';
import { fetchRecords } from './CourseRecords/api';

function AdminElectronicResources() {
  const { folioCourseId } = useParams();
  const navigate = useNavigate();
  
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  const { resources, setResources, addResource } = useAdminResourceStore();
  const [newResourceModalOpen, toggleNewResourceModal] = useAdminModal();
  const [reuseModalOpen, toggleReuseModal] = useAdminModal();
  const [edsResourceModalOpen, toggleEDSResourceModal] = useAdminModal();
  const [hitchcockModalOpen, toggleHitchcockModal] = useAdminModal();

  // State for print resources (FOLIO)
  const [printResources, setPrintResources] = useState([]);

  // State for active tab: "electronic" (default) or "print"
  const [activeTab, setActiveTab] = useState('electronic');

  // Fetch print resources from FOLIO API
  useEffect(() => {
    if (!folioCourseId) return;
    const fetchPrintItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const reserves = await fetchRecords(folioCourseId);
        setPrintResources(reserves);
      } catch (err) {
        setError(err.message || 'Error fetching print resources');
      } finally {
        setLoading(false);
      }
    };
    fetchPrintItems();
  }, [folioCourseId]);

  // Fetch course data (electronic resources)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const courseData = await fetchCourseData(folioCourseId);
        // Check if a course exists in your local DB.
        const { exists, course: existingCourse, offerings } = await adminCourseService.checkCourseExists(folioCourseId);
        
        if (exists) {
          // Merge offerings into the course data if needed.
          setCourse({ ...existingCourse, offerings });
          const { resources } = await adminCourseService.fetchCourseResources(existingCourse.course_id);
          setResources(resources);
        } else if (courseData && courseData.length > 0) {
          // Transform FOLIO data to the local format (includes both course and offering data)
          const uploadData = transformFolioCourseToLocal(courseData[0]);
          const localCourse = await adminCourseService.createLocalCourse(uploadData);
          setCourse(localCourse);
          setResources([]);
        }
      } catch (err) {
        console.error(err);
        setError(ADMIN_ERROR_MESSAGES.COURSE_CREATE_FAILED);
      } finally {
        setLoading(false);
      }
    };

    if (folioCourseId) {
      fetchInitialData();
    }
  }, [folioCourseId, setResources]);

  const handleCreateResource = async (formData) => {
    try {
      const result = await adminCourseService.createResource(course.course_id, formData);
      addResource(result.resource);
      toggleNewResourceModal();
    } catch (err) {
      console.log(err);
      setError(ADMIN_ERROR_MESSAGES.RESOURCE_CREATE_FAILED);
    }
  };

  const handleSearchResources = async (searchTerm) => {
    try {
      setSearchResults([]);  
      const { resources } = await adminCourseService.searchResources(searchTerm);
      console.log(resources);
      setSearchResults(resources);
    } catch (err) {
      console.log(err);
      setError(ADMIN_ERROR_MESSAGES.RESOURCE_SEARCH_FAILED);
    }
  };

  const handleReuseResource = async (resourceId) => {
    try {
      await adminCourseService.linkResource(course.course_id, resourceId);
      const { resources: updated } = await adminCourseService.fetchCourseResources(course.course_id);
      setResources(updated);
      toggleReuseModal();
    } catch (err) {
      console.log(err);
      setError(ADMIN_ERROR_MESSAGES.RESOURCE_LINK_FAILED);
    }
  };

  const unlinkResource = async (courseResourceId) => {
    try {
      await adminCourseService.deleteResourceLink(courseResourceId);
      const { resources: updated } = await adminCourseService.fetchCourseResources(course.course_id);
      setResources(updated);
    } catch (err) {
      console.log(err);
      setError(ADMIN_ERROR_MESSAGES.RESOURCE_LINK_FAILED);
    }
  };

  const handleUpdateResources = async () => {
    try {
      const { resources: updated } = await adminCourseService.fetchCourseResources(course.course_id);
      setResources(updated);
    }
    catch (err) {
      console.log(err);
      setError(ADMIN_ERROR_MESSAGES.RESOURCE_FETCH_FAILED);
    }
  };

  const buildFolioCourseUrl = () => {
    return `https://fivecolleges.folio.ebsco.com/cr/courses/view/${course.folio_course_id}`;
  };

  const handleReorder = async (updatedResources) => {
    // Update local state
    setResources(updatedResources);
  
    try {
      // Call your API service to persist the new order.
      // This assumes you have an endpoint like adminCourseService.updateResourceOrder.
      await adminCourseService.updateResourceOrder(course.course_id, updatedResources);
    } catch (err) {
      console.error('Error updating resource order:', err);
      setError('Failed to update resource order.');
    }
  };

  if (loading) {
    return (
      <Container className="my-4 text-center">
        <Spinner color="primary" />
        <p>Loading...</p>
      </Container>
    );
  }

  return (
    <Container className="my-4">
      {error && <Alert color="danger">{error}</Alert>}

      <Row>
        <Col>
          <Button color="secondary" onClick={() => navigate('/admin')}>
            &larr; Back
          </Button>
        </Col>
      </Row>

      {course && (
        <Row className="mt-3">
          <Col>
            <h3>{course.course_name}</h3>
            <p>
              <strong>Number:</strong> {course.course_number}<br />
              <strong>Term:</strong> {course.offerings && course.offerings.length > 0 ? course.offerings[0].term_name : 'N/A'}<br />
              <strong>Department:</strong> {course.department_name}<br />
              <strong>Location:</strong> {course.location_name}<br />
              <strong>FOLIO Course Link:{' '}
                <a
                        href={buildFolioCourseUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {buildFolioCourseUrl()}
                      </a>

              </strong>
            </p>
          </Col>
        </Row>
      )}

      <Row className="my-3">
        <Col>
          <Button color="primary" onClick={toggleHitchcockModal}>
            + Add from Hitchcock
          </Button>{' '}
          <Button color="primary" onClick={toggleEDSResourceModal}>
            + Add from EDS
          </Button>{' '}
          <Button color="success" onClick={toggleNewResourceModal}>
            + Create New Resource
          </Button>{' '}
          <Button color="warning" onClick={toggleReuseModal}>
            Reuse Existing Resource
          </Button>
        </Col>
      </Row>

      {/* Tabs for Electronic vs. Print resources */}
      <Nav tabs>
        <NavItem>
          <NavLink
            className={classnames({ active: activeTab === 'electronic' })}
            onClick={() => setActiveTab('electronic')}
            style={{ cursor: 'pointer' }}
          >
            Electronic Resources
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={classnames({ active: activeTab === 'print' })}
            onClick={() => setActiveTab('print')}
            style={{ cursor: 'pointer' }}
          >
            Print Resources
          </NavLink>
        </NavItem>
      </Nav>
      <TabContent activeTab={activeTab} className="mt-4">
        <TabPane tabId="electronic">
          <Row>
            <Col>
              <h4>Current Electronic Resources</h4>
              <AdminResourceTable 
                resources={resources} 
                unlink={unlinkResource} 
                onReorder={handleReorder}
              />
            </Col>
          </Row>
        </TabPane>
        <TabPane tabId="print">
          <Row>
            <Col>
              <h4>Current Print Resources</h4>
              <p><strong>*Resources found here are managed in FOLIO</strong></p>
              <AdminPrintResourceTable printResources={printResources} />
            </Col>
          </Row>
        </TabPane>
      </TabContent>

      <AdminNewResourceModal
        isOpen={newResourceModalOpen}
        toggle={toggleNewResourceModal}
        onSubmit={handleCreateResource}
      />

      <AdminReuseResourceModal
        isOpen={reuseModalOpen}
        toggle={toggleReuseModal}
        searchTerm={searchTerm}
        searchResults={searchResults}
        onSearchTermChange={setSearchTerm}
        onSearch={handleSearchResources}
        onReuse={handleReuseResource}
        isLoading={loading}
      />

      <AdminEDSResourceModal
        isOpen={edsResourceModalOpen}
        toggle={toggleEDSResourceModal}
        onSubmit={handleUpdateResources}
        course={course}
      />

      <AdminHitchCockResourceModal
        isOpen={hitchcockModalOpen}
        toggle={toggleHitchcockModal}
        onSubmit={handleUpdateResources}
        course={course}
      />
    </Container>
  );
}

/**
 * AdminPrintResourceTable
 * -------------------------
 * A simple table component to display print resources from FOLIO.
 */
function AdminPrintResourceTable({ printResources }) {
  if (!printResources || printResources.length === 0) {
    return <p>No print resources found.</p>;
  }

  const buildVerificationUrl = (instanceId, holdingsId) => {
    return `https://fivecolleges.folio.ebsco.com/inventory/view/${instanceId}/${holdingsId}`;
  }

  console.log(printResources)

  return (
    <Table bordered hover responsive>
      <thead>
        <tr>
          <th>Id</th>
          <th>Title</th>
          <th>Barcode</th>
          <th>Call Number</th>
          <th>Permanent Location</th>
          <th>Instance HRID</th>
          <th>FOLIO Record</th>
        </tr>
      </thead>
      <tbody>
        {printResources.map((item) => (
          <tr key={item.id}>
            <td>{item.id}</td>
            <td>{item?.copiedItem?.title}</td>
            <td>{item?.copiedItem?.barcode}</td>
            <td>{item?.copiedItem?.callNumber}</td>
            <td>{item?.copiedItem?.permanentLocationObject ? item?.copiedItem?.permanentLocationObject.name : 'N/A'}</td>
            <td>{item?.copiedItem?.instanceHrid}</td>
            <td>
                      <a
                        href={buildVerificationUrl(item?.copiedItem?.instanceId, item?.copiedItem?.holdingsId)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        FOLIO Record
                      </a>
                    </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

AdminPrintResourceTable.propTypes = {
  printResources: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default AdminElectronicResources;
