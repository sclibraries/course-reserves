import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Button, Alert, Spinner } from 'reactstrap';
import { fetchCourseData, fetchRecords } from '../components/page-sections/course-record/api';
import { adminCourseService } from '../services/admin/adminCourseService';
import { useAdminModal } from '../hooks/admin/useAdminModal';
import { useAdminResourceStore } from '../store/adminResourceStore';
import { transformFolioCourseToLocal } from '../util/adminTransformers';
import { AdminNewResourceModal } from '../components/admin/modals/AdminNewResourceModal';
import { AdminReuseResourceModal } from '../components/admin/modals/AdminReuseResourceModal';
import { AdminEDSResourceModal } from '../components/admin/modals/AdminEDSResourceModal';
import { AdminHitchCockResourceModal } from '../components/admin/modals/AdminHitchcockResourceModal';
import { AdminCrossLinkFolioCourseModal } from '../components/admin/modals/AdminCrossLinkFolioCourseModal';
import { useAdminCourseStore } from '../store/adminCourseStore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { toast } from 'react-toastify';
import {  buildFolioCourseUrl } from '../util/urlHelpers';

// Import new component files
import AdminCourseHeader from '../components/page-sections/admin/electronic-resources/AdminCourseHeader';
import AdminCoursePermalink from '../components/page-sections/admin/electronic-resources/AdminCoursePermalink';
import AdminResourcesTabs from '../components/page-sections/admin/electronic-resources/AdminResourcesTabs';
import '../css/AdminElectronicResources.css';

function AdminElectronicResources() {
  // Navigation and store state
  const { folioCourseId } = useParams();
  const navigate = useNavigate();
  const { setCourse, setFolioCourseData, clearCourse, folioCourseData, course } = useAdminCourseStore();
  const { resources, setResources } = useAdminResourceStore();

  // Local state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showReusePrompt, setShowReusePrompt] = useState(false);
  const [printResources, setPrintResources] = useState([]);
  const [linkedCourses, setLinkedCourses] = useState([]);
  const [copyStatus, setCopyStatus] = useState('');

  // Modal state
  const [newResourceModalOpen, toggleNewResourceModal] = useAdminModal();
  const [reuseModalOpen, toggleReuseModal] = useAdminModal();
  const [edsResourceModalOpen, toggleEDSResourceModal] = useAdminModal();
  const [hitchcockModalOpen, toggleHitchcockModal] = useAdminModal();
  const [crossLinkModalOpen, toggleCrossLinkModal] = useAdminModal();

  // Helper functions for term comparison
  const TERM_ORDER = { 'Winter': 0, 'Spring': 1, 'Summer': 2, 'Fall': 3 };

  const isTermLater = (currentTermName, latestTermName) => {
    if (!latestTermName) return true; 
    
    const [currentYear, currentSemester] = currentTermName.split(' ');
    const [latestYear, latestSemester] = latestTermName.split(' ');

    if (parseInt(currentYear) > parseInt(latestYear)) {
      return true;
    } else if (currentYear === latestYear) {
      return TERM_ORDER[currentSemester] > TERM_ORDER[latestSemester];
    }

    return false;
  };

  // Clear state on course ID change
  useEffect(() => {
    clearCourse();
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
          return;
        }
        const courseDetails = folioCourseData[0];
        setFolioCourseData(courseDetails);
  
        // Extract term name from FOLIO course details.
        const folioTermName = courseDetails?.courseListingObject?.termObject?.name;
        if (!folioTermName) {
          toast.error('FOLIO course data is missing term information.');
          return;
        }
  
        await setupCourse(courseDetails, folioTermName);
      } catch (err) {
        console.error(err);
        setError('Error setting up course');
      } finally {
        setLoading(false);
      }
    };
  
    if (folioCourseId && !course) {
      checkAndSetupCourse();
    }
  }, [folioCourseId, course, setCourse, setFolioCourseData, setResources]);

  // Helper function to set up course based on FOLIO data
  const setupCourse = async (courseDetails, folioTermName) => {
    try {
      // Check if permanent course exists
      const checkResponse = await adminCourseService.checkPermanentCourseExists({
        course_name: courseDetails?.name,
        course_number: courseDetails?.courseNumber,
        department_id: courseDetails?.departmentId,
        folio_course_id: courseDetails?.courseListingId,
        term_id: courseDetails?.courseListingObject?.termId,
      });

      if (checkResponse.exists) {
        setCourse({ 
          ...checkResponse.course, 
          offerings: checkResponse.offerings, 
          current_offering_id: checkResponse.current_offering_id,
          offering_id: checkResponse.offeringId
        });

        if (checkResponse.offeringId !== null) {
          const { resources } = await adminCourseService.fetchCourseResources(
            checkResponse.offeringId
          );
          setResources(resources);
        }
        
        // Determine if we need to show the reuse prompt
        setShowReusePrompt(
          !checkResponse.offeringExists && 
          isTermLater(folioTermName, checkResponse.latestOfferingStartDate)
        );
      } else {
        // Create new course if doesn't exist
        const localCourseData = transformFolioCourseToLocal(courseDetails);
        const newCourse = await adminCourseService.createLocalCourse(localCourseData);
        
        setCourse({
          ...newCourse.course, 
          offerings: newCourse.offering, 
          current_offering_id: newCourse.offering.offering_id,
          offering_id: newCourse.offering.offering_id
        });
        setShowReusePrompt(false);
      }
    } catch (err) {
      console.error('Error in setupCourse:', err);
      throw err;
    }
  };

  // Fetch linked courses for current course
  useEffect(() => {
    if (course) {
      const fetchLinkedCourses = async () => {
        try {
          const results = await adminCourseService.getLinkedCourses(course.offering_id);
          if(results) {
            setLinkedCourses(results);
          }
        } catch (err) {
          console.error(err);
          toast.error('Failed to fetch linked courses.');
        }
      }
      fetchLinkedCourses();
    }
  }, [course]);

  // Course action handlers
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

  // Resource action handlers
  const fetchLinkedCourseResources = async () => {
    if (!Array.isArray(linkedCourses) || linkedCourses.length === 0) {
      return;
    }

    try {
      const resourcePromises = linkedCourses.map(course => {
        if (!course.offering_id) {
          return Promise.resolve({ offering_id: null, resources: [] });
        }
        
        return adminCourseService.fetchCourseResources(course.offering_id)
          .then(result => ({
            offering_id: course.offering_id,
            resources: result?.resources || []
          }));
      });

      const results = await Promise.all(resourcePromises);
      // We're collecting these but not using them yet
      // This could be implemented in a future feature
      const allResources = results.reduce((acc, curr) => acc.concat(curr.resources), []);
      console.log('Linked course resources:', allResources.length);
    } catch (err) {
      console.error('Error fetching course resources:', err);
      toast.error('Failed to fetch linked course resources.');
    }
  };

  const handleSearchResources = async (searchTerm) => {
    try {
      setSearchResults([]);  
      const { resources } = await adminCourseService.searchResources(searchTerm);
      setSearchResults(resources);
    } catch (err) {
      console.error(err);
      toast.error('Resource search failed.');
    }
  };

  const handleReuseResource = async (resourceId) => {
    try {
      await adminCourseService.linkExistingResources(course.offering_id, resourceId);
      const { resources: updated } = await adminCourseService.fetchCourseResources(course.offering_id);
      setResources(updated);
      toast.success('Resource linked successfully.');
      toggleReuseModal();
    } catch (err) {
      console.error(err);
      toast.error('Failed to link resource.');
    }
  };

  const unlinkResource = async (courseResourceId) => {
    try {
      await adminCourseService.deleteResourceLink(courseResourceId);
      const { resources: updated } = await adminCourseService.fetchCourseResources(course.offering_id);
      setResources(updated);
      if(linkedCourses.length > 0) {
        fetchLinkedCourseResources();
      }
      toast.success('Resource unlinked successfully.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to unlink resource.');
    }
  };

  const handleUpdateResources = async () => {
    try {
      const { resources: updated } = await adminCourseService.fetchCourseResources(course.offering_id);
      setResources(updated);
    }
    catch (err) {
      console.error(err);
      toast.error('Failed to fetch resources.');
    }
  };

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
      setTimeout(() => setCopyStatus(''), 2000);
    } catch (error) {
      console.error(error)
      setCopyStatus('Failed to copy');
    }
  };

  if (loading) {
    return (
      <Container fluid className="admin-resources py-5">
        <div className="text-center">
          <Spinner color="primary" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-muted">Loading course information...</p>
        </div>
      </Container>
    );
  }

  const coursePermalink = course?.permanent_course_uuid 
    ? `${window.location.origin}/course-reserves/records/${course.permanent_course_uuid}`
    : '';

  return (
    <Container fluid className="admin-resources-container py-4">
      {showReusePrompt && (
        <Alert color="info" className="mb-4 custom-alert">
          <strong>Note:</strong> A previous version of this course exists.<br />
          Do you want to reuse existing electronic resources or start fresh?

          <div className="mt-3">
            <Button color="primary" className="me-2 custom-btn" onClick={handleReuseExistingCourse}>
              Reuse Existing Resources
            </Button>
            <Button color="secondary" className="custom-btn" onClick={handleCreateNewCourse}>
              Create New Course
            </Button>
          </div>
        </Alert>
      )}
      
      {error && <Alert color="danger" className="mb-3 custom-alert">{error}</Alert>}

      {/* Back Button */}
      <Row className="mb-3">
        <Col>
          <Button color="light" className="back-btn" onClick={() => navigate('/admin')}>
            <FontAwesomeIcon icon="fa-solid fa-arrow-left-long" className="me-2" />
            Back to Courses
          </Button>
        </Col>
      </Row>

      {/* Course Header */}
      <AdminCourseHeader 
        folioCourseData={folioCourseData} 
        linkedCourses={linkedCourses}
        navigate={navigate}
        copyToClipboard={copyToClipboard}
        copyStatus={copyStatus}
        course={course}
        coursePermalink={coursePermalink}
      />

      {/* Course Permalink */}
      <AdminCoursePermalink 
        course={course} 
        copyToClipboard={copyToClipboard} 
        coursePermalink={coursePermalink}
      />

      {/* Main Content Tabs */}
      <AdminResourcesTabs
        course={course}
        resources={resources}
        printResources={printResources}
        linkedCourses={linkedCourses}
        toggleNewResourceModal={toggleNewResourceModal}
        toggleEDSResourceModal={toggleEDSResourceModal}
        toggleHitchcockModal={toggleHitchcockModal}
        toggleReuseModal={toggleReuseModal}
        toggleCrossLinkModal={toggleCrossLinkModal}
        unlinkResource={unlinkResource}
        handleUpdateResources={handleUpdateResources}
        handleReorder={handleReorder}
        buildFolioCourseUrl={() => buildFolioCourseUrl(folioCourseData?.id)}
        navigate={navigate}
      />

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
        onLinkSuccess={handleUpdateResources} 
        course={course}
      />
    </Container>
  );
}

export default AdminElectronicResources;
