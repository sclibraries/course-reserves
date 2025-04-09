import { useEffect, useState } from 'react';
import { Container, Row, Col, Alert, Button, ButtonGroup } from 'reactstrap';
import {  useNavigate, useLocation } from 'react-router-dom';
import { FaArrowLeft, FaThLarge, FaList, FaArrowUp } from 'react-icons/fa';
import useRecordStore from '../../../store/recordStore';
import useCourseStore from '../../../store';
import useCustomizationStore from '../../../store/customizationStore';
import RecordCard from './RecordCard';
import RecordTable from './RecordTable';
import RecordSkeleton from './RecordSkeleton';
import '../../../css/RecordsList.css';

function RecordsList() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const courseListingId = queryParams.get('courseListingId');
  const collegeParam = queryParams.get('college') || 'all';

  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Record store data
  const {
    fetchRecords,
    records,
    isLoading,
    error,
    currentCourse,
    availability,
    setCurrentCourse
  } = useRecordStore((state) => ({
    fetchRecords: state.fetchRecords,
    records: state.records[courseListingId] || [],
    isLoading: state.isLoading,
    error: state.error,
    currentCourse: state.currentCourse,
    availability: state.availability,
    setCurrentCourse: state.setCurrentCourse
  }));

  // Get course details if not already loaded
  const { fetchCourse } = useCourseStore();

  // Get customization settings
  const customization = useCustomizationStore((state) =>
    state.getCustomizationForCollege(collegeParam)
  );

  // Keep track of open accordions in record cards
  const [openAccordions, setOpenAccordions] = useState({});

  // Fetch records on component mount or when courseListingId changes
  useEffect(() => {
    if (!courseListingId) {
      navigate('/search');
      return;
    }

    // Reset scroll position when viewing a new course
    window.scrollTo(0, 0);

    // Fetch records
    fetchRecords(courseListingId);

    // If we don't have the course details, fetch them
    if (!currentCourse || currentCourse.courseListingId !== courseListingId) {
      fetchCourse(courseListingId).then(course => {
        if (course) setCurrentCourse(course);
      });
    }

    // Show/hide scroll to top button based on scroll position
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [courseListingId, fetchRecords, fetchCourse, currentCourse, navigate, setCurrentCourse]);

  // Toggle accordions in record cards
  const toggleAccordion = (instanceId, accordionId) => {
    setOpenAccordions(prev => ({
      ...prev,
      [instanceId]: prev[instanceId] === accordionId ? undefined : accordionId
    }));
  };

  // Handle return to search
  const handleBackToSearch = () => {
    // Go back to search with previous filters if available
    const returnUrl = '/search' + (collegeParam ? `?college=${collegeParam}` : '');
    navigate(returnUrl);
  };

  // Handle view mode change (card/table)
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Group electronic records by folder if available
  const groupedRecords = (() => {
    if (!records || records.length === 0) return [];

    // Check if we should group by folders (only for electronic resources)
    const hasElectronicRecords = records.some(r => r.isElectronic);
    const hasFolders = hasElectronicRecords && records.some(r => r.folder_name);

    if (!hasFolders) return records;

    // Group by folder
    const folderGroups = {};
    const ungrouped = [];

    records.forEach(record => {
      if (record.isElectronic && record.folder_name) {
        if (!folderGroups[record.folder_name]) {
          folderGroups[record.folder_name] = [];
        }
        folderGroups[record.folder_name].push(record);
      } else {
        ungrouped.push(record);
      }
    });

    // Convert to array format
    const groupedArray = Object.entries(folderGroups).map(([folder, items]) => ({
      folder,
      items
    }));

    return [...ungrouped, ...groupedArray];
  })();

  return (
    <Container fluid>
      {/* Page header with h1 and course info */}
      <Row className="mb-4 mt-3">
        <Col>
          <Button
            color="light"
            className="mb-3 d-flex align-items-center"
            onClick={handleBackToSearch}
            aria-label="Back to search results"
          >
            <FaArrowLeft className="me-2" aria-hidden="true" /> Back to Search Results
          </Button>

          <h1 className="h2 mb-3">
            {isLoading ? (
              "Loading course materials..."
            ) : currentCourse?.name ? (
              `${currentCourse.name} - Course Materials`
            ) : (
              "Course Materials"
            )}
          </h1>

          {currentCourse && (
            <div className="course-meta mb-3">
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <span className="badge bg-secondary me-2">{currentCourse.courseNumber}</span>

                {currentCourse.departmentObject?.name && (
                  <span className="me-3">{currentCourse.departmentObject.name}</span>
                )}

                {currentCourse.courseListingObject?.termObject?.name && (
                  <span className="me-3">
                    <strong>Term:</strong> {currentCourse.courseListingObject.termObject.name}
                  </span>
                )}

                {currentCourse.courseListingObject?.instructorObjects?.length > 0 && (
                  <span>
                    <strong>Instructor{currentCourse.courseListingObject.instructorObjects.length !== 1 ? 's' : ''}:</strong> {currentCourse.courseListingObject.instructorObjects.map(i => i.name).join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}

          {!isLoading && records.length > 0 && (
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="results-count">
                <span className="text-muted">{records.length} course material{records.length !== 1 ? 's' : ''}</span>
              </div>

              <ButtonGroup size="sm">
                <Button
                  onClick={() => handleViewModeChange('card')}
                  active={viewMode === 'card'}
                  className="d-flex align-items-center px-3"
                  aria-pressed={viewMode === 'card'}
                  aria-label="Switch to Card View"
                  style={{
                    backgroundColor: viewMode === 'card' ? customization.cardButtonBgColor : 'transparent',
                    color: viewMode === 'card' ? '#fff' : '#495057',
                    border: `1px solid ${viewMode === 'card' ? customization.cardButtonBgColor : '#ced4da'}`
                  }}
                >
                  <FaThLarge className="me-2" size={14} aria-hidden="true" />
                  Cards
                </Button>
                <Button
                  onClick={() => handleViewModeChange('table')}
                  active={viewMode === 'table'}
                  className="d-flex align-items-center px-3"
                  aria-pressed={viewMode === 'table'}
                  aria-label="Switch to Table View"
                  style={{
                    backgroundColor: viewMode === 'table' ? customization.cardButtonBgColor : 'transparent',
                    color: viewMode === 'table' ? '#fff' : '#495057',
                    border: `1px solid ${viewMode === 'table' ? customization.cardButtonBgColor : '#ced4da'}`
                  }}
                >
                  <FaList className="me-2" size={14} aria-hidden="true" />
                  Table
                </Button>
              </ButtonGroup>
            </div>
          )}
        </Col>
      </Row>

      {/* Error message if any */}
      {error && (
        <Alert color="danger" className="mb-4">
          Error loading records: {error.message}
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="records-loading">
          <Row className="g-4">
            {[...Array(3)].map((_, index) => (
              <Col xs="12" md="6" lg="4" key={`skeleton-${index}`}>
                <RecordSkeleton />
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* No records state */}
      {!isLoading && records.length === 0 && !error && (
        <Alert color="info" className="text-center p-5">
          <h2 className="h4 mb-3">No Course Materials Found</h2>
          <p className="mb-0">
            There are no materials currently available for this course. Please check back later or contact your instructor.
          </p>
        </Alert>
      )}

      {/* Records display - Card View */}
      {!isLoading && records.length > 0 && viewMode === 'card' && (
        <div className="records-container mb-5">
          <Row className="g-4">
            {groupedRecords.map((recordItem, index) => {
              // Check if this is a folder group
              if (recordItem.folder && recordItem.items) {
                return (
                  <div key={`folder-${index}`} className="mb-4 w-100">
                    <h2 className="h5 mb-3 p-2 bg-light rounded">
                      {recordItem.folder}
                    </h2>
                    <Row className="g-4">
                      {recordItem.items.map((item) => (
                        <Col xs="12" md="6" lg="4" key={item.id}>
                          <RecordCard
                            recordItem={item}
                            availability={availability}
                            openAccordions={openAccordions}
                            toggleAccordion={toggleAccordion}
                            customization={customization}
                            isGrouped={true}
                            courseInfo={currentCourse}
                            collegeParam={collegeParam}
                          />
                        </Col>
                      ))}
                    </Row>
                  </div>
                );
              }

              // Regular record item
              return (
                <Col xs="12" md="6" lg="4" key={recordItem.id}>
                  <RecordCard
                    recordItem={recordItem}
                    availability={availability}
                    openAccordions={openAccordions}
                    toggleAccordion={toggleAccordion}
                    customization={customization}
                    courseInfo={currentCourse}
                    collegeParam={collegeParam}
                  />
                </Col>
              );
            })}
          </Row>
        </div>
      )}

      {/* Records display - Table View */}
      {!isLoading && records.length > 0 && viewMode === 'table' && (
        <div className="records-container mb-5">
          <RecordTable
            combinedResults={groupedRecords}
            availability={availability}
            customization={customization}
            hasElectronicReserves={records.some(r => r.isElectronic)}
            courseInfo={currentCourse}
            collegeParam={collegeParam}
          />
        </div>
      )}

      {/* Scroll to top button */}
      {showScrollTop && (
        <Button
          color="secondary"
          className="scroll-to-top-btn"
          onClick={scrollToTop}
          aria-label="Scroll to top of the page"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '1000',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 6px rgba(0,0,0,0.16)',
            backgroundColor: customization.cardButtonBgColor || '#333'
          }}
        >
          <span className="visually-hidden">Scroll to top</span>
          <FaArrowUp aria-hidden="true" />
        </Button>
      )}
    </Container>
  );
}

export default RecordsList;