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
  Table,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  ButtonGroup,
  Card,
  CardBody
} from 'reactstrap';
import classnames from 'classnames';
import { fetchCourseData, fetchRecords } from '../components/page-sections/course-record/api';
import { adminCourseService } from '../services/admin/adminCourseService';
import { useAdminModal } from '../hooks/admin/useAdminModal';
import { useAdminResourceStore } from '../store/adminResourceStore';
import { transformFolioCourseToLocal } from '../util/adminTransformers';
import { AdminResourceTable } from '../components/page-sections/admin/AdminResourceTable';
import { AdminNewResourceModal } from '../components/admin/modals/AdminNewResourceModal';
import { AdminReuseResourceModal } from '../components/admin/modals/AdminReuseResourceModal';
import { ADMIN_ERROR_MESSAGES } from '../constants/admin';
import { AdminEDSResourceModal } from '../components/admin/modals/AdminEDSResourceModal';
import { AdminHitchCockResourceModal } from '../components/admin/modals/AdminHitchcockResourceModal';
import { AdminCrossLinkFolioCourseModal } from '../components/admin/modals/AdminCrossLinkFolioCourseModal';
import { useAdminCourseStore } from '../store/adminCourseStore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { toast } from 'react-toastify';

function AdminElectronicResources() {
  //Navigation
  const { folioCourseId } = useParams();
  const navigate = useNavigate();
  
  //Store
  const { setCourse, setFolioCourseData, clearCourse, folioCourseData, course} = useAdminCourseStore();
  const { resources, setResources, addResource } = useAdminResourceStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  

  const [newResourceModalOpen, toggleNewResourceModal] = useAdminModal();
  const [reuseModalOpen, toggleReuseModal] = useAdminModal();
  const [edsResourceModalOpen, toggleEDSResourceModal] = useAdminModal();
  const [hitchcockModalOpen, toggleHitchcockModal] = useAdminModal();
  const [crossLinkModalOpen, toggleCrossLinkModal] = useAdminModal();
  const [selectedResourceId, setSelectedResourceId] = useState(null);
  const [linkedCourses, setLinkedCourses] = useState([]);
  const [linkedCourseResources, setLinkedCourseResources] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showReusePrompt, setShowReusePrompt] = useState(false);
  const [printResources, setPrintResources] = useState([]);
  const [activeTab, setActiveTab] = useState('electronic');

  const [copyStatus, setCopyStatus] = useState('');

  // Toggle dropdown for adding resources
  const toggleDropdown = () => setDropdownOpen(!dropdownOpen);


  //* Helper function to compare term names
  const TERM_ORDER = { 'Winter': 0, 'Spring': 1, 'Summer': 2, 'Fall': 3 };

  const isTermLater = (currentTermName, latestTermName) => {
    if (!latestTermName) return true; // No previous offering; default to true
    
    const [currentYear, currentSemester] = currentTermName.split(' ');
    const [latestYear, latestSemester] = latestTermName.split(' ');

    if (parseInt(currentYear) > parseInt(latestYear)) {
      return true;
    } else if (currentYear === latestYear) {
      return TERM_ORDER[currentSemester] > TERM_ORDER[latestSemester];
    }

    return false;
  };

  useEffect(() => {
    // Clear the course data when folioCourseId changes
    clearCourse();
    // Optionally, also clear resources or any other shared state if needed
    setResources([]);
  }, [folioCourseId, clearCourse, setResources]);

  

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


  // Fetch course data from FOLIO and set up the course
  useEffect(() => {
    const checkAndSetupCourse = async () => {
      setLoading(true);
      setError(null);
      setResources([]);
      try {
        // Fetch course data from FOLIO
        const folioCourseData = await fetchCourseData(folioCourseId);
        if (!folioCourseData || !folioCourseData.length) {
         toast.error('Course not found in FOLIO.');
        }
        const courseDetails = folioCourseData[0];
        setFolioCourseData(courseDetails);
  
        // Extract term name from FOLIO course details.
        const folioTermName = courseDetails?.courseListingObject?.termObject?.name;
        if (!folioTermName) {
          toast.error('FOLIO course data is missing term information.');
        }
  
        // Call backend to check if the permanent course already exists
        const checkResponse = await adminCourseService.checkPermanentCourseExists({
          course_name: courseDetails?.name,
          course_number: courseDetails?.courseNumber,
          department_id: courseDetails?.departmentId,
          folio_course_id: courseDetails?.courseListingId,
          term_id: courseDetails?.courseListingObject?.termId,
        });
  
        // If the course exists locally...
        if (checkResponse.exists) {
          // Merge course and offerings into one state update
          setCourse({ 
            ...checkResponse.course, 
            offerings: checkResponse.offerings, 
            current_offering_id: checkResponse.current_offering_id,
            offering_id: checkResponse.offeringId
          });

  
          // Debug logging to compare term names
          console.log(
            'FOLIO term name:',
            folioTermName,
            'DB latest term name:',
            checkResponse.latest_term_name
          );
  
            // Only fetch and set resources if the terms match
            if(checkResponse.offeringId !== null) {
              const { resources } = await adminCourseService.fetchCourseResources(
                checkResponse.offeringId
              );
              setResources(resources);
            }
          
          // Determine if we need to show the reuse prompt based on whether an offering exists
          // and if the term is later than the latest offering's start date.
          if (checkResponse.offeringExists) {
            console.log('dont show the reuse prompt');
            setShowReusePrompt(false); // Exact term offering exists; no prompt.
          } else if (
            isTermLater(
              folioTermName,
              checkResponse.latestOfferingStartDate
            )
          ) {
            console.log('show the reuse prompt');
            setShowReusePrompt(true);  // Newer term detected; prompt reuse.
          } else {
            setShowReusePrompt(false); // Older term; no prompt.
          }
        } else {
          // If the course does not exist locally, create it.
          const localCourseData = transformFolioCourseToLocal(courseDetails);
          const newCourse = await adminCourseService.createLocalCourse(localCourseData);
          console.log('new course', newCourse);
          setCourse({
            ...newCourse.course, 
            offerings: newCourse.offering, 
            current_offering_id: newCourse.offering.offering_id,
            offering_id: newCourse.offering.offering_id
          });
          setShowReusePrompt(false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
  
    if (folioCourseId && !course) {
      checkAndSetupCourse();
    }
  }, [folioCourseId, course, setCourse, setResources]);


  // Fetch linked resources for the current course
    useEffect(() => {
      if(linkedCourses.length > 0) {
        fetchLinkedCourseResources(linkedCourses[0].course_id);
      }
    }, [linkedCourses]);

    // Fetch linked courses for the current course
    useEffect(() => {
      console.log(course)
      if (course) {
        const fetchLinkedCourses = async () => {
          try {
            const results = await adminCourseService.getLinkedCourses(course.offering_id);
            if(results) {
              setLinkedCourses(results);
            }
          } catch (err) {
            console.log(err);
            toast.error(ADMIN_ERROR_MESSAGES.COURSE_FETCH_FAILED);
          }
        }
        fetchLinkedCourses();
      }
    }, [course]);
  
  // Reactivate the course with existing resources
  const handleReuseExistingCourse = async () => {
    setLoading(true);
    try {
      const localCourseData = transformFolioCourseToLocal(folioCourseData);
      const reactivatedCourse = await adminCourseService.reactivateCourse({
        folioCourseId,
        permanentCourseUUID: course.permanent_course_uuid,
        courseOfferings: localCourseData
      });
      setCourse(reactivatedCourse.course);
      const resourceData = await adminCourseService.fetchCourseResources(reactivatedCourse.offering.offering_id);
      setResources(resourceData.resources);
      setShowReusePrompt(false);
      toast.success('Course reactivated successfully with existing resources.');
    } catch (err) {
      console.error(err);
      toast.error('Error reactivating the course.');
    } finally {
      setLoading(false);
    }
  };

  // Create a new course with no resources. Used only if staff do not want to reuse existing course.
  const handleCreateNewCourse = async () => {
    setLoading(true);
    try {
      const folioCourseData = await fetchCourseData(folioCourseId);  
      const courseDetails = folioCourseData[0];    
      const localCourseData = transformFolioCourseToLocal(courseDetails);
      const newCourse = await adminCourseService.createLocalCourse(localCourseData);
      setCourse(newCourse);
      setResources([]);
      setShowReusePrompt(false);
      toast.success('New course created successfully.');
    } catch (err) {
      console.error(err);
      toast.error('Error creating new course.');
    } finally {
      setLoading(false);
    }
  };
  
  
/**
 * Fetch linked course resources for all linked courses.
 * This function loops over each course and fetches its resources concurrently.
 */
    const fetchLinkedCourseResources = async () => {
      // Check if linkedCourses is a valid non-empty array
      if (!Array.isArray(linkedCourses) || linkedCourses.length === 0) {
        console.warn('No linked courses available to fetch resources for.');
        return;
      }

      try {
        // Map each course to a promise that fetches its resources
        const resourcePromises = linkedCourses.map(course => {
          // Check that the course has an offering_id
          if (!course.offering_id) {
            console.warn(`Course ${course.course_id} is missing an offering_id. Skipping.`);
            // Return an empty resources result for courses missing the offering_id
            return Promise.resolve({ offering_id: null, resources: [] });
          }
          
          // Fetch the course resources and return a structured result
          return adminCourseService.fetchCourseResources(course.offering_id)
            .then(result => ({
              offering_id: course.offering_id,
              resources: result?.resources || []
            }));
        });

        // Wait for all the fetch requests to complete concurrently
        const results = await Promise.all(resourcePromises);

        // Combine the resources from all courses into a single array.
        // Alternatively, you can structure them by course if needed.
        const allResources = results.reduce((acc, curr) => acc.concat(curr.resources), []);

        // Update the state with the combined resources
        setLinkedCourseResources(allResources);

        // Option: If you want to keep the resources mapped by offering_id, you could do:
        // const resourcesByCourse = results.reduce((acc, curr) => {
        //   if (curr.offering_id) {
        //     acc[curr.offering_id] = curr.resources;
        //   }
        //   return acc;
        // }, {});
        // setLinkedCourseResources(resourcesByCourse);

      } catch (err) {
        // Log the error and display a user-friendly message
        console.error('Error fetching course resources:', err);
        toast.error(ADMIN_ERROR_MESSAGES.RESOURCE_FETCH_FAILED);
      }
    };



  // Search for resources
  const handleSearchResources = async (searchTerm) => {
    try {
      setSearchResults([]);  
      const { resources } = await adminCourseService.searchResources(searchTerm);
      setSearchResults(resources);
    } catch (err) {
      console.log(err);
      toast.error(ADMIN_ERROR_MESSAGES.RESOURCE_SEARCH_FAILED);
    }
  };

  // Reuse an existing resource by linking it
  const handleReuseResource = async (resourceId) => {
    try {
      await adminCourseService.linkExistingResources(course.offering_id, resourceId);
      const { resources: updated } = await adminCourseService.fetchCourseResources(course.offering_id);
      setResources(updated);
      toast.success('Resource linked successfully.');
      toggleReuseModal();
    } catch (err) {
      console.log(err);
      toast.error(ADMIN_ERROR_MESSAGES.RESOURCE_LINK_FAILED);
    }
  };

  // Unlink a resource from the course
  const unlinkResource = async (courseResourceId) => {
    try {
      await adminCourseService.deleteResourceLink(courseResourceId);
      const { resources: updated } = await adminCourseService.fetchCourseResources(course.offering_id);
      setResources(updated);
      if(linkedCourses.length > 0) {
        fetchLinkedCourseResources(linkedCourses[0].course_id)
      }
      toast.success('Resource unlinked successfully.');
    } catch (err) {
      console.log(err);
      toast.error(ADMIN_ERROR_MESSAGES.RESOURCE_UNLINK_FAILED);
    }
  };

  // Refresh the resources list
  const handleUpdateResources = async () => {
    console.log(course)
    try {
      const { resources: updated } = await adminCourseService.fetchCourseResources(course.offering_id);
      setResources(updated);
    }
    catch (err) {
      console.log(err);
      toast.error(ADMIN_ERROR_MESSAGES.RESOURCE_FETCH_FAILED);
    }
  };

  // Build URL for FOLIO course view
  const buildFolioCourseUrl = () => {
    return `https://fivecolleges.folio.ebsco.com/cr/courses/${folioCourseData?.id || ''}`;
  };

  // Handle reordering of resources
  const handleReorder = async (updatedResources) => {
    setResources(updatedResources);
    try {
      await adminCourseService.updateResourceOrder(course.offering_id, updatedResources);
    } catch (err) {
      console.error('Error updating resource order:', err);
      toast.error('Failed to update resource order.');
    }
  };


  const copyToClipboard = async (permanentLink) => {
    try {
      await navigator.clipboard.writeText(permanentLink);
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(''), 2000); // Clear the message after 2 seconds
    } catch (error) {
      setCopyStatus('Failed to copy');
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

  // Check if the course is active
  const termStart = folioCourseData?.courseListingObject?.termObject?.startDate;
  const termEnd = folioCourseData?.courseListingObject?.termObject?.endDate;
  const now = new Date();
  const isActive = now >= new Date(termStart) && now <= new Date(termEnd);

  return (
    <Container fluid className="admin-resources-container">
      {showReusePrompt && (
        <Alert color="info" className="mt-4">
          <strong>Note:</strong> A previous version of this course exists.<br />
          Do you want to reuse existing electronic resources or start fresh?

          <div className="mt-3">
            <Button color="primary" className="me-2" onClick={handleReuseExistingCourse}>
              Reuse Existing Resources
            </Button>
            <Button color="secondary" onClick={handleCreateNewCourse}>
              Create New Course
            </Button>
          </div>
      </Alert>
      )}
      {error && <Alert color="danger" className="mt-3">{error}</Alert>}

      {/* Header with Back Button and Course Info */}
      <Row className="mb-4">
        <Col>
          <Button color="light" onClick={() => navigate('/admin')} className="mb-3">
          <FontAwesomeIcon icon="fa-solid fa-arrow-left-long" className="me-2" />
            Back to Courses
          </Button>
          <Alert color="info" className="mb-2">
            <div className="d-flex flex-column gap-2">
              <div className="d-flex align-items-center">
                <span className="fw-medium me-2">Permanent Link:</span>
                <a
                  href={`${window.location.origin}/course-reserves/records/${course?.permanent_course_uuid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-decoration-none d-flex align-items-center"
                >
                  <i className="fas fa-link me-2" />
                  <span className="text-truncate" style={{ maxWidth: '200px' }}>
                    {course?.permanent_course_uuid}
                  </span>
                </a>
              </div>

              <div className="d-flex align-items-center gap-2">
                <code className="text-muted small p-2 bg-light rounded">
                  {`${window.location.origin}/course-reserves/records/${course?.permanent_course_uuid}`}
                </code>
              </div>

              <div className="d-flex align-items-center mt-2">
                <Button 
                  color="info"
                  size="sm"
                  className="d-flex align-items-center gap-2"
                  onClick={() => copyToClipboard(`${window.location.origin}/course-reserves/records/${course?.permanent_course_uuid}`)}
                >
                  <i className="fas fa-copy" />
                  Copy Link
                </Button>
                
                {copyStatus && (
                  <div className="ms-2 small d-flex align-items-center gap-1 text-success fw-medium">
                    <i className="fas fa-check" />
                    {copyStatus}
                  </div>
                )}
              </div>
            </div>
          </Alert>
          <br />
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div className="d-flex align-items-center">
              <h2 className="m-0 d-flex align-items-center">
              <FontAwesomeIcon icon="fa-solid fa-book-open-cover" className="me-3 text-primary" />
                {folioCourseData?.name}
              </h2>
            </div>
            
            {/* External Links with Icons */}
            <div className="d-flex gap-2">
              <a
                href={buildFolioCourseUrl()}
                target="_blank"
                rel="noopener"
                className="btn btn-sm btn-outline-primary"
              >
                <FontAwesomeIcon icon="fa-solid fa-arrow-up-right-from-square" className="me-2" />
                FOLIO Course
              </a>
              <a
                href={`/course-reserves/records?courseListingId=${folioCourseData?.courseListingId}`}
                target="_blank"
                rel="noopener"
                className="btn btn-sm btn-outline-primary"
              >
               <FontAwesomeIcon icon="fa-solid fa-eye" className="me-2" />
                Public View
              </a>
            </div>
          </div>

          {/* Course Details Card */}
          {folioCourseData && (
            <Card className="mb-4">
              <CardBody className="p-4">
                <Row className="g-4">
                  {/* Course Number */}
                  <Col md={6} lg={3}>
                    <div className="mb-3">
                      <label className="text-muted small text-uppercase mb-2 d-block">
                      <FontAwesomeIcon icon="fa-solid fa-hashtag" className="me-2 text-muted" />
                        Course Number
                      </label>
                      <h5 className="mb-0">{folioCourseData?.courseNumber}</h5>
                    </div>
                  </Col>
                  {/* Location */}
                  <Col md={6} lg={3}>
                    <div className="mb-3">
                      <label className="text-muted small text-uppercase mb-2 d-block">
                      <FontAwesomeIcon icon="fa-solid fa-location-dot" className="me-2 text-muted" />
                        Location
                      </label>
                      <h5 className="mb-0">{folioCourseData?.courseListingObject?.locationObject?.name}</h5>
                    </div>
                  </Col>
                  {/* Department */}
                  <Col md={6} lg={3}>
                    <div className="mb-3">
                      <label className="text-muted small text-uppercase mb-2 d-block">
                        <FontAwesomeIcon icon="fa-solid fa-building" className="me-2 text-muted" />
                        Department
                      </label>
                      <h5 className="mb-0">{folioCourseData?.departmentObject?.name}</h5>
                    </div>
                  </Col>
                  {/* Current Term */}
                  <Col md={6} lg={3}>
                    <div className="mb-3">
                      <label className="text-muted small text-uppercase mb-2 d-block">
                      <FontAwesomeIcon icon="fa-solid fa-calendar"  className="me-2 text-muted" />
                        Current Term
                      </label>
                      <h5 className="mb-0">{folioCourseData?.courseListingObject?.termObject?.name}</h5>
                    </div>
                  </Col>
                  {/* Linked Courses Section */}
                  {linkedCourses.length > 0 && (
                    <Col xs={12}>
                      <hr className="my-3" />
                      <div>
                        <label className="text-muted small text-uppercase mb-2 d-block">
                        <FontAwesomeIcon icon="fa-solid fa-link" className="me-2 text-muted" />
                          Linked Courses
                        </label>
                        <div className="d-flex flex-wrap gap-2">
                          {linkedCourses.map((linkedCourse) => (
                            <Button
                              key={linkedCourse.course_id}
                              color="outline-primary"
                              size="sm"
                              className="d-flex align-items-center"
                              onClick={() =>
                                navigate(`/admin/electronic/${linkedCourse.folio_course_id}`)
                              }
                            >
                              {linkedCourse.course_name} - {linkedCourse.course_number} - {linkedCourse.term_name}
                              <FontAwesomeIcon icon="fa-solid fa-arrow-left" className="ms-2" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    </Col>
                  )}
                </Row>
              </CardBody>
            </Card>
          )}
        </Col>
      </Row>

      {/* Action Bar for Adding/Linking Resources */}
      <Row className="action-bar mb-4">
        <Col>
          <div className="d-flex flex-wrap gap-2">
            <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown}>
              <DropdownToggle color="primary" caret>
              <FontAwesomeIcon icon="fa-solid fa-circle-plus" className="me-2" />
                Add Resource
              </DropdownToggle>
              <DropdownMenu>
                <DropdownItem onClick={toggleHitchcockModal}>
                <FontAwesomeIcon icon="fa-solid fa-circle-book-open" className="me-2" />
                  From Hitchcock
                </DropdownItem>
                <DropdownItem onClick={toggleEDSResourceModal}>
                <FontAwesomeIcon icon="fa-solid fa-database" className="me-2" />
                  From EDS
                </DropdownItem>
                <DropdownItem onClick={toggleNewResourceModal}>
                <FontAwesomeIcon icon="fa-solid fa-file-lines" className="me-2" />
                  Create New
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <ButtonGroup>
              <Button color="secondary" onClick={toggleReuseModal}>
              <FontAwesomeIcon icon="fa-solid fa-recycle" className="me-2" />
                Reuse Existing
              </Button>
              <Button color="secondary" onClick={toggleCrossLinkModal}>
              <FontAwesomeIcon icon="fa-solid fa-link" className="me-2" />
                Cross-Link
              </Button>
            </ButtonGroup>
          </div>
        </Col>
      </Row>

      {/* Resource Tabs */}
      <div className="resource-tabs">
        <Nav tabs className="custom-tab-header">
          <NavItem>
            <NavLink
              className={classnames('tab-item', { active: activeTab === 'electronic' })}
              onClick={() => setActiveTab('electronic')}
            >
              <FontAwesomeIcon icon="fa-solid fa-laptop" className="me-2" />
              Electronic Resources
              <span className="badge bg-primary ms-2">{resources?.length || 0}</span>
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink
              className={classnames('tab-item', { active: activeTab === 'print' })}
              onClick={() => setActiveTab('print')}
            >
              <FontAwesomeIcon icon="fa-solid fa-bookmark" className="me-2" />
              Print Resources
              <span className="badge bg-primary ms-2">{printResources?.length || 0}</span>
            </NavLink>
          </NavItem>
          {linkedCourseResources.length > 0 && (
          <NavItem>
            <NavLink
              className={classnames('tab-item', { active: activeTab === 'linked' })}
              onClick={() => setActiveTab('linked')}
            >
              <FontAwesomeIcon icon="fa-solid fa-link" className="me-2" />
              Linked Resources
              <span className="badge bg-primary ms-2">{linkedCourseResources?.length || 0}</span>
            </NavLink>
          </NavItem>
          )
          }
        </Nav>

        <TabContent activeTab={activeTab} className="p-4 border border-top-0 shadow-sm">
          <TabPane tabId="electronic">
            <AdminResourceTable 
              resources={resources} 
              unlink={unlinkResource} 
              onReorder={handleReorder}
              handleUpdateResources={handleUpdateResources}
            />
          </TabPane>
          <TabPane tabId="print">
            <div className="print-resources-notice alert alert-info mb-4">
            <FontAwesomeIcon icon="fa-solid fa-circle-info" className="me-2" />
              Print resources are managed directly in FOLIO. Changes made here will not affect the official record.
            </div>
            <AdminPrintResourceTable printResources={printResources} />
          </TabPane>
          <TabPane tabId="linked">
            <div className="linked-resources-notice alert alert-info mb-4">
            <FontAwesomeIcon icon="fa-solid fa-circle-info" className="me-2" />
              Linked resources are shared across multiple courses. Changes made here will affect all linked courses.
            </div>
            <AdminResourceTable
              resources={linkedCourseResources}
              unlink={unlinkResource}
              handleRefresh={handleUpdateResources}
            />
          </TabPane>
            
        </TabContent>
      </div>

      {/* Modals for Resource Actions */}
      <AdminNewResourceModal
        isOpen={newResourceModalOpen}
        toggle={toggleNewResourceModal}
        onSubmit={handleUpdateResources}
        course={course}

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
      <AdminCrossLinkFolioCourseModal
        isOpen={crossLinkModalOpen}
        toggle={toggleCrossLinkModal}
        resourceId={selectedResourceId}
        onLinkSuccess={handleUpdateResources} 
        course={course}
      />
    </Container>
  );
}

/**
 * AdminPrintResourceTable
 * -------------------------
 * Displays print resources from FOLIO in a responsive table.
 */
function AdminPrintResourceTable({ printResources }) {
  if (!printResources || printResources.length === 0) {
    return <p>No print resources found.</p>;
  }

  // Build URL for verifying FOLIO records
  const buildVerificationUrl = (instanceId, holdingsId) => {
    return `https://fivecolleges.folio.ebsco.com/inventory/view/${instanceId}/${holdingsId}`;
  };

  return (
    <Table bordered hover responsive className="print-resource-table">
      <thead className="table-light">
        <tr>
          <th>Title</th>
          <th className="d-none d-md-table-cell">Call Number</th>
          <th>Barcode</th>
          <th className="d-none d-lg-table-cell">Location</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {printResources.map((item) => (
          <tr key={item.id}>
            <td>
              <div className="fw-bold">{item?.copiedItem?.title}</div>
              <div className="text-muted small">{item?.copiedItem?.instanceHrid}</div>
            </td>
            <td className="d-none d-md-table-cell">{item?.copiedItem?.callNumber}</td>
            <td>{item?.copiedItem?.barcode}</td>
            <td className="d-none d-lg-table-cell">
              {item?.copiedItem?.permanentLocationObject?.name || 'N/A'}
            </td>
            <td>
              <a
                href={buildVerificationUrl(item?.copiedItem?.instanceId, item?.copiedItem?.holdingsId)}
                target="_blank"
                rel="noopener"
                className="btn btn-sm btn-outline-primary"
              >
                <FontAwesomeIcon icon="fa-solid fa-eye"  className="me-1" />
                View
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
