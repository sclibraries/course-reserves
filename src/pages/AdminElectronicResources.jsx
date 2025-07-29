import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Button, Alert, Spinner } from 'reactstrap';
import { fetchCourseData, fetchRecords } from '../components/page-sections/course-record/api';
import { adminCourseService } from '../services/admin/adminCourseService';
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
    setResources([]);
  }, [folioCourseId, clearCourse, setResources]);

  // Fetch print resources from FOLIO API
  // Only run when course offering changes, not on every render
useEffect(() => {
  if (!folioCourseId || !course?.offering_id) return;

  const loadPrintsWithOrder = async () => {
    console.log('Loading print resources with order for offering:', course.offering_id);
    setLoading(true);
    setError(null);

    try {
      // 1) get the raw FOLIO items
      const reserves = await fetchRecords(folioCourseId);

      // 2) get your local order refs
      const refs = await adminCourseService.getPhysicalResourceReferences(
        course.offering_id
      );

      // 3) merge .order from refs into each FOLIO item
      const merged = reserves.map((item, idx) => {
        const match = refs.find(r => r.external_resource_id === item.copiedItem?.instanceId);
        return {
          ...item,
          order: match ? match.order : (idx + 1)
        };
      });

      // 4) sort by that order
      merged.sort((a, b) => (a.order || 999) - (b.order || 999));

      console.log('Print resources loaded and sorted:', merged.map(m => ({ 
        title: m.copiedItem?.title, 
        order: m.order,
        instanceId: m.copiedItem?.instanceId
      })));

      // 5) store in state
      setPrintResources(merged);
    } catch (err) {
      console.error('Error loading print resources:', err);
      setError(err.message || 'Error fetching print resources');
    } finally {
      setLoading(false);
    }
  };

  loadPrintsWithOrder();
}, [folioCourseId, course?.offering_id]); // Remove the dependency on course object to prevent unnecessary re-runs

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

  // Function to refresh linked courses (can be called from modals)
  const refreshLinkedCourses = useCallback(async () => {
    if (course?.offering_id) {
      try {
        const results = await adminCourseService.getLinkedCourses(course.offering_id);
        if (results) {
          setLinkedCourses(results);
        }
      } catch (err) {
        console.error('Error refreshing linked courses:', err);
        toast.error('Failed to refresh linked courses.');
      }
    }
  }, [course?.offering_id]);

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
    // Don't attempt to fetch resources if course isn't loaded yet
    if (!course?.offering_id) {
      console.log('handleUpdateResources: Course not ready, skipping fetch');
      return;
    }

    try {
      const { resources: updated } = await adminCourseService.fetchCourseResources(course.offering_id);
      setResources(updated);
    }
    catch (err) {
      console.error(err);
      toast.error('Failed to fetch resources.');
    }
  };

  // New handler for unified resource reordering
  const handleUnifiedReorder = async ({ electronic, print }) => {
    try {
      console.log('Starting unified reorder with:', { electronic, print });
      
      // Prepare API payloads - IMPORTANT: backend needs course_resource_id, not resource_id
      const electronicPayload = electronic.map(e => ({ 
        course_resource_id: e.course_resource_id, // This is the key field the backend expects
        order: e.order 
      }));
      
      const printPayload = print.map(p => ({
        external_resource_id: p.copiedItem?.instanceId || p.id?.replace('p-', ''), 
        order: p.order,
        display_name: p.copiedItem?.title || ''
      }));

      console.log('Sending updates:', { electronicPayload, printPayload });

      // 1) Update both batches sequentially to avoid race conditions
      console.log(electronicPayload)
      if (electronicPayload.length > 0) {
        await adminCourseService.updateResourceOrder(course.offering_id, electronicPayload);
      }
      
      if (printPayload.length > 0) {
        await adminCourseService.updatePhysicalResourceOrder(course.offering_id, printPayload);
      }

      // 2) Wait a brief moment for backend processing
      await new Promise(resolve => setTimeout(resolve, 100));
  
      // 3) Re-fetch all data in the correct sequence
      const [
        { resources: freshElectronic },
        freshPrint,
        refs
      ] = await Promise.all([
        adminCourseService.fetchCourseResources(course.offering_id),
        fetchRecords(folioCourseId),
        adminCourseService.getPhysicalResourceReferences(course.offering_id)
      ]);
  
      // 4) Merge the order back into FOLIO items and sort by order
      const mergedPrint = freshPrint.map(item => {
        const ref = refs.find(r => r.external_resource_id === item.copiedItem?.instanceId);
        return {
          ...item,
          order: ref ? ref.order : (item.order || 999)
        };
      }).sort((a, b) => (a.order || 999) - (b.order || 999));
  
      // 5) Sort electronic resources by order
      const sortedElectronic = freshElectronic.sort((a, b) => (a.order || 999) - (b.order || 999));
  
      console.log('Final sorted data:', { 
        electronic: sortedElectronic.map(e => ({ id: e.resource_id, order: e.order })),
        print: mergedPrint.map(p => ({ id: p.copiedItem?.instanceId, order: p.order }))
      });

      // 6) Update state
      setResources(sortedElectronic);
      setPrintResources(mergedPrint);
  
      toast.success('Resource order updated successfully');
    } catch (err) {
      console.error('Error updating unified resource order:', err);
      toast.error('Failed to update resource order.');
      
      // On error, try to refresh the data to get back to a consistent state
      try {
        const { resources: fallbackElectronic } = await adminCourseService.fetchCourseResources(course.offering_id);
        setResources(fallbackElectronic);
        
        const fallbackPrint = await fetchRecords(folioCourseId);
        const fallbackRefs = await adminCourseService.getPhysicalResourceReferences(course.offering_id);
        const fallbackMerged = fallbackPrint.map(item => {
          const ref = fallbackRefs.find(r => r.external_resource_id === item.copiedItem?.instanceId);
          return { ...item, order: ref ? ref.order : (item.order || 999) };
        });
        setPrintResources(fallbackMerged);
      } catch (fallbackErr) {
        console.error('Error during fallback refresh:', fallbackErr);
      }
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
        unlinkResource={unlinkResource}
        handleUpdateResources={handleUpdateResources}
        handleUnifiedReorder={handleUnifiedReorder}
        buildFolioCourseUrl={() => buildFolioCourseUrl(folioCourseData?.id)}
        navigate={navigate}
        editResourceModal={resourceFormModal}
      />

      {/* Unified Resource Form Modal */}
      <ResourceFormManager
        isOpen={resourceFormModal.isOpen}
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
