import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Container, Row, Col, Button, Alert, Spinner } from 'reactstrap';
import { fetchCourseData } from '../components/page-sections/course-record/api';
import { adminCourseService } from '../services/admin/adminCourseService';
import { submissionWorkflowService } from '../services/admin/submissionWorkflowService';
import { useAdminResourceStore } from '../store/adminResourceStore';
import { transformFolioCourseToLocal } from '../util/adminTransformers';

// Import unified form system
import ResourceFormManager from '../components/admin/forms/ResourceFormManager';
import { useResourceFormModal } from '../hooks/admin/useResourceFormModal';

import { useAdminCourseStore } from '../store/adminCourseStore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { toast } from 'react-toastify';
import { buildFolioCourseUrl } from '../util/urlHelpers';

// Import new component files
import AdminCourseHeader from '../components/page-sections/admin/electronic-resources/AdminCourseHeader';
import AdminCoursePermalink from '../components/page-sections/admin/electronic-resources/AdminCoursePermalink';
import AdminResourcesTabs from '../components/page-sections/admin/electronic-resources/AdminResourcesTabs';
import '../css/AdminElectronicResources.css';

// Constants
const TERM_ORDER = { 'Winter': 0, 'Spring': 1, 'Summer': 2, 'Fall': 3 };

export const getProcessingContextFromLocation = (location) => (
  location?.state?.processingContext || null
);

function AdminElectronicResources() {
  // Navigation and store state
  const { folioCourseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const processingContext = getProcessingContextFromLocation(location);
  const { setCourse, setFolioCourseData, clearCourse, folioCourseData, course } = useAdminCourseStore();
  
  // Use store for all resource-related state
  const { 
    linkedCourses,
    setResources,
    clearCourseData,
    fetchResources,
    fetchPrintResources,
    fetchLinkedCourses
  } = useAdminResourceStore();

  // Local state (only for UI-specific concerns)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showReusePrompt, setShowReusePrompt] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [processingComplete, setProcessingComplete] = useState(false);
  const [completingProcessing, setCompletingProcessing] = useState(false);

  // Unified modal state
  const resourceFormModal = useResourceFormModal();

  const isTermLater = useCallback((currentTermName, latestTermName) => {
    if (!latestTermName) return true; 
    
    const [currentYear, currentSemester] = currentTermName.split(' ');
    const [latestYear, latestSemester] = latestTermName.split(' ');

    if (parseInt(currentYear) > parseInt(latestYear)) {
      return true;
    } else if (currentYear === latestYear) {
      return TERM_ORDER[currentSemester] > TERM_ORDER[latestSemester];
    }

    return false;
  }, []);

  // Clear state on course ID change
  useEffect(() => {
    clearCourse();
    clearCourseData();
  }, [folioCourseId, clearCourse, clearCourseData]);

  // Fetch print resources from FOLIO API
  // Only run when course offering changes, not on every render
  useEffect(() => {
    if (!folioCourseId || !course?.offering_id) return;

    fetchPrintResources(folioCourseId, course.offering_id);
  }, [folioCourseId, course?.offering_id, fetchPrintResources]); // Remove the dependency on course object to prevent unnecessary re-runs

  // Helper function to set up course based on FOLIO data
  const setupCourse = useCallback(async (courseDetails, folioTermName) => {
    try {
      // Check if permanent course exists
      const checkResponse = await adminCourseService.checkPermanentCourseExists({
        course_name: courseDetails?.name,
        course_number: courseDetails?.courseNumber,
        department_id: courseDetails?.departmentId,
        folio_course_id: courseDetails?.courseListingId,
        term_id: courseDetails?.courseListingObject?.termId,
        section_name: courseDetails?.sectionName 
             || courseDetails?.courseListingObject?.sectionName 
             || ''
      });

      if (checkResponse.exists) {
        // Course exists - check if we need to create a new offering for this section
        if (!checkResponse.offeringExists) {
          // Offering doesn't exist for this term+section combo
          const shouldReuse = isTermLater(folioTermName, checkResponse.latest_term_name);
          
          if (shouldReuse) {
            // Later term - show reuse prompt
            setCourse({ 
              ...checkResponse.course, 
              folio_course_id: courseDetails?.courseListingId,
              offerings: checkResponse.offerings, 
              current_offering_id: checkResponse.current_offering_id,
              offering_id: checkResponse.offeringId
            });
            setShowReusePrompt(true);
          } else {
            // Same term, different section OR first offering - create new offering automatically
            const localCourseData = transformFolioCourseToLocal(courseDetails);
            const reactivatedCourse = await adminCourseService.reactivateCourse({
              folioCourseId: courseDetails?.courseListingId,
              permanentCourseUUID: checkResponse.course.permanent_course_uuid,
              courseOfferings: localCourseData
            });
            
            setCourse({
              ...reactivatedCourse.course,
              folio_course_id: courseDetails?.courseListingId,
              offering_id: reactivatedCourse.offering.offering_id,
              current_offering_id: reactivatedCourse.offering.offering_id,
              offerings: [reactivatedCourse.offering]
            });
            setResources([]);
            setShowReusePrompt(false);
            toast.success('New section created successfully.');
          }
        } else {
          // Offering exists for this exact term+section
          setCourse({ 
            ...checkResponse.course, 
            folio_course_id: courseDetails?.courseListingId,
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
          setShowReusePrompt(false);
        }
      } else {
        // Create new course if doesn't exist
        const localCourseData = transformFolioCourseToLocal(courseDetails);
        const newCourse = await adminCourseService.createLocalCourse(localCourseData);
        
        setCourse({
          ...newCourse.course, 
          folio_course_id: courseDetails?.courseListingId,
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
  }, [setCourse, setResources, setShowReusePrompt, isTermLater]);

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
  }, [folioCourseId, course, setCourse, setFolioCourseData, setResources, setupCourse]);

  // Fetch linked courses for current course
  useEffect(() => {
    if (course?.offering_id) {
      fetchLinkedCourses(course.offering_id);
    }
  }, [course?.offering_id, fetchLinkedCourses]);

  const buildCoursePermalink = (course, currentOffering) => {
  const origin = window.location.origin;
  if (!course?.permanent_course_uuid) return '';

  const base = `${origin}/course-reserves/records/${course.permanent_course_uuid}`;

  const sect = currentOffering && currentOffering.section_name
    ? String(currentOffering.section_name).trim()
    : '';

  // Add ?section=... only when we actually have one
  return sect ? `${base}?section=${encodeURIComponent(sect)}` : base;
};

  // Function to refresh linked courses (can be called from modals)
  const refreshLinkedCourses = useCallback(async () => {
    if (course?.offering_id) {
      await fetchLinkedCourses(course.offering_id);
    }
  }, [course?.offering_id, fetchLinkedCourses]);

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
      
      // Properly merge course and offering data to ensure offering_id is available
      setCourse({
        ...reactivatedCourse.course,
        folio_course_id: folioCourseId,
        offering_id: reactivatedCourse.offering.offering_id,
        current_offering_id: reactivatedCourse.offering.offering_id,
        offerings: reactivatedCourse.offering
      });
      
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
      
      // Properly merge course and offering data to ensure offering_id is available
      setCourse({
        ...newCourse.course,
        folio_course_id: folioCourseId,
        offering_id: newCourse.offering.offering_id,
        current_offering_id: newCourse.offering.offering_id,
        offerings: newCourse.offering
      });
      
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
      await fetchResources(course.offering_id);
      toast.success('Resource linked successfully.');
      resourceFormModal.openReuseForm({
        searchTerm,
        searchResults,
        onSearchTermChange: setSearchTerm,
        onSearch: handleSearchResources,
        onReuse: handleReuseResource
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to link resource.');
    }
  };

  const handleUpdateResources = async () => {
    // Don't attempt to fetch resources if course isn't loaded yet
    if (!course?.offering_id) {
      console.log('handleUpdateResources: Course not ready, skipping fetch');
      return;
    }

    await fetchResources(course.offering_id);
  };

  const handleCompleteProcessing = async () => {
    if (!processingContext?.itemId) return;

    setCompletingProcessing(true);
    try {
      await submissionWorkflowService.completeProcessing(processingContext.itemId);
      setProcessingComplete(true);
      await handleUpdateResources();
      toast.success('Submission item published to the course.');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to publish submission item.');
    } finally {
      setCompletingProcessing(false);
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

  let currentOffering = null;
  if (Array.isArray(course?.offerings)) {
    currentOffering = course.offerings.find(
      (o) => String(o.offering_id) === String(course.offering_id)
    ) || course.offerings[0];
  } else if (course?.offerings && course?.offerings.offering_id) {
    currentOffering = course.offerings; // legacy shape
  }

  const coursePermalink = buildCoursePermalink(course, currentOffering);

  return (
    <Container fluid className="admin-resources-container py-4">
      {showReusePrompt && (
        <Alert color="info" className="mb-4 custom-alert">
          <div className="mb-2">
            <strong>Note:</strong> A previous version of this course exists.
          </div>
          <div className="mb-3">
            Do you want to reuse existing electronic resources or start fresh?
          </div>
          <div>
            <Button color="primary" size="sm" className="me-2" onClick={handleReuseExistingCourse}>
              Reuse Existing Resources
            </Button>
            <Button color="secondary" size="sm" onClick={handleCreateNewCourse}>
              Create New Course
            </Button>
          </div>
        </Alert>
      )}
      
      {error && <Alert color="danger" className="mb-3 custom-alert">{error}</Alert>}

      {processingContext && (
        <Alert color="primary" className="mb-3 custom-alert">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <span>
              Processing submission item #{processingContext.itemId}
              {processingComplete ? ' published to this course.' : ''}
            </span>
            <Button
              color={processingComplete ? 'success' : 'primary'}
              size="sm"
              disabled={processingComplete || completingProcessing}
              onClick={handleCompleteProcessing}
            >
              {completingProcessing ? 'Publishing...' : processingComplete ? 'Published' : 'Publish Processed Item'}
            </Button>
          </div>
        </Alert>
      )}

      {/* Back Button */}
      <Row className="mb-3">
        <Col>
          <Button color="light" className="back-btn" onClick={() => navigate('/admin')}>
            <FontAwesomeIcon icon="fa-solid fa-arrow-left-long" className="me-2" />
            Back to Courses
          </Button>
        </Col>
      </Row>

      {/* Main content - show but disable when reuse prompt is active */}
      <div style={{ position: 'relative' }}>
        {/* Overlay when reuse prompt is shown */}
        {showReusePrompt && (
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px'
            }}
          >
            <div className="text-center p-4">
              <FontAwesomeIcon 
                icon="fa-solid fa-lock" 
                size="3x" 
                className="text-muted mb-3" 
              />
              <h5 className="text-muted">Course Management Locked</h5>
              <p className="text-muted mb-0">
                Please make a selection above to access course management features.
              </p>
            </div>
          </div>
        )}

        {/* Content that gets disabled */}
        <div style={{ opacity: showReusePrompt ? 0.3 : 1, pointerEvents: showReusePrompt ? 'none' : 'auto' }}>
          {/* Course Header */}
          <AdminCourseHeader 
            folioCourseData={folioCourseData} 
            linkedCourses={linkedCourses}
            copyToClipboard={copyToClipboard}
            copyStatus={copyStatus}
            course={course}
            coursePermalink={coursePermalink}
            sectionLabel={currentOffering?.section_name ? `Section ${currentOffering.section_name}` : ''}
          />

          {/* Course Permalink */}
          <AdminCoursePermalink
            copyToClipboard={copyToClipboard}
            coursePermalink={coursePermalink}
            sectionLabel={currentOffering?.section_name ? `Section ${currentOffering.section_name}` : ''}
          />

          {/* Main Content Tabs */}
          <AdminResourcesTabs
            course={course}
            toggleNewResourceModal={resourceFormModal.openNewResourceForm}
            toggleEDSResourceModal={resourceFormModal.openEDSForm}
            toggleHitchcockModal={resourceFormModal.openHitchcockForm}
            toggleReuseModal={() => resourceFormModal.openReuseForm({
              searchTerm,
              searchResults,
              onSearchTermChange: setSearchTerm,
              onSearch: handleSearchResources,
              onReuse: handleReuseResource
            })}
            toggleCrossLinkModal={resourceFormModal.openCrosslinkForm}
            buildFolioCourseUrl={() => buildFolioCourseUrl(folioCourseData?.id)}
            navigate={navigate}
            editResourceModal={resourceFormModal}
            processingContext={processingContext}
          />
        </div>
      </div>

      {/* Unified Resource Form Modal - only functional when not showing reuse prompt */}
      <ResourceFormManager
        isOpen={resourceFormModal.isOpen && !showReusePrompt}
        onClose={resourceFormModal.closeModal}
        onSubmit={handleUpdateResources}
        formType={resourceFormModal.formType}
        initialData={resourceFormModal.initialData}
        course={course}
        refreshLinkedCourses={refreshLinkedCourses}
        {...resourceFormModal.additionalProps}
      />
    </Container>
  );
}

export default AdminElectronicResources;
