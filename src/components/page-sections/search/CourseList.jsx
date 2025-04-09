import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, Button, ButtonGroup, Alert, Pagination, PaginationItem, PaginationLink } from 'reactstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaThLarge, FaList, FaChevronLeft, FaChevronRight, FaArrowUp } from 'react-icons/fa';

import useRecordStore from '../../../store/recordStore';
import useCustomizationStore from '../../../store/customizationStore';
import CourseCard from './CourseCard';
import CourseTable from './CourseTable';
import useSearchStore from '../../../store/searchStore';
import CourseSkeleton from './CourseSkeleton'; // This would be a new component for loading states

function CourseList({ courses, isLoading }) {
  const navigate = useNavigate();
  const location = useLocation();

  const displayMode = useSearchStore((state) => state.displayMode);
  const setDisplayMode = useSearchStore((state) => state.setDisplayMode);
  const query = useSearchStore((state) => state.query);

  const queryParams = new URLSearchParams(location.search);
  const collegeParam = queryParams.get('college');

  const { setRecord } = useRecordStore();
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [coursesPerPage, setCoursesPerPage] = useState(12);
  const [paginatedCourses, setPaginatedCourses] = useState([]);

  // Get customization from the store
  const customization = useCustomizationStore((state) =>
    state.getCustomizationForCollege(collegeParam)
  );

  // Apply pagination logic
  useEffect(() => {
    if (!courses || courses.length === 0) {
      setPaginatedCourses([]);
      return;
    }

    const indexOfLastCourse = currentPage * coursesPerPage;
    const indexOfFirstCourse = indexOfLastCourse - coursesPerPage;
    setPaginatedCourses(courses.slice(indexOfFirstCourse, indexOfLastCourse));
  }, [courses, currentPage, coursesPerPage]);

  // Handle scroll position and scroll-to-top button
  useEffect(() => {
    const storedScroll = sessionStorage.getItem('searchScrollPosition');
    if (storedScroll) {
      window.scrollTo(0, parseInt(storedScroll, 10));
      // Clear the stored position after using it
      sessionStorage.removeItem('searchScrollPosition');
    }

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Update URL when display mode changes
  useEffect(() => {
    const currentParams = new URLSearchParams(location.search);
    
    // Only update URL if the mode is different from what's already there
    if (currentParams.get('displayMode') !== displayMode) {
      currentParams.set('displayMode', displayMode);
      navigate(`${location.pathname}?${currentParams.toString()}`, { replace: true });
    }
  }, [displayMode, navigate, location]);

  const handleRecords = (courseListingId) => {
    setRecord(courseListingId);
    sessionStorage.setItem('searchScrollPosition', window.scrollY);

    const newQueryParams = new URLSearchParams();
    newQueryParams.set('courseListingId', courseListingId);
    if (collegeParam) {
      newQueryParams.set('college', collegeParam);
    }

    navigate(`/records?${newQueryParams.toString()}`);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pagination controls
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const totalPages = Math.ceil((courses?.length || 0) / coursesPerPage);

  // Calculate page numbers to display (showing 5 pages at a time with ellipsis)
  const getPageNumbers = () => {
    const pages = [];
    
    if (totalPages <= 7) {
      // Show all pages if total is 7 or less
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always include first page
      pages.push(1);
      
      // Calculate start and end of middle section
      let startPage = Math.max(2, currentPage - 2);
      let endPage = Math.min(totalPages - 1, currentPage + 2);
      
      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pages.push('...');
      }
      
      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      
      // Always include last page
      pages.push(totalPages);
    }
    
    return pages;
  };

  // Empty state
  if (!isLoading && (!courses || courses.length === 0)) {
    return (
      <Alert color="info" className="mt-4 mb-4 text-center rounded-3 py-5">
        <div className="mb-3 display-6">No courses found</div>
        <p className="mb-3 lead">
          {query ? 
            `No courses match your search for "${query}"` : 
            'No courses match the selected filters'}
        </p>
        <p className="mb-4">Try adjusting your search terms or filters to find what you&apos;re looking for.</p>
        <Button 
          color="primary"
          onClick={() => navigate('/search')}
          style={{
            backgroundColor: customization.cardButtonBgColor || '#0066cc'
          }}
        >
          Reset All Filters
        </Button>
      </Alert>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="skeleton-line" style={{ width: '120px', height: '38px' }}></div>
          <div className="skeleton-line" style={{ width: '80px', height: '20px' }}></div>
        </div>
        
        <Row className="g-4">
          {[...Array(6)].map((_, index) => (
            <Col xs="12" sm="6" md="6" lg="4" key={`skeleton-${index}`}>
              <CourseSkeleton />
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* View controls and summary */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 p-2 bg-light rounded-3">
        <div className="d-flex align-items-center">
          <ButtonGroup size="sm" className="me-3">
            <Button
              onClick={() => setDisplayMode('card')}
              active={displayMode === 'card'}
              className="d-flex align-items-center px-3"
              aria-pressed={displayMode === 'card'}
              aria-label="Switch to Card View"
              style={{
                backgroundColor: displayMode === 'card' ? customization.cardButtonBgColor : 'transparent',
                color: displayMode === 'card' ? '#fff' : '#495057',
                border: `1px solid ${displayMode === 'card' ? customization.cardButtonBgColor : '#ced4da'}`
              }}
            >
              <FaThLarge className="me-2" size={14} />
              Cards
            </Button>
            <Button
              onClick={() => setDisplayMode('table')}
              active={displayMode === 'table'}
              className="d-flex align-items-center px-3"
              aria-pressed={displayMode === 'table'}
              aria-label="Switch to Table View"
              style={{
                backgroundColor: displayMode === 'table' ? customization.cardButtonBgColor : 'transparent',
                color: displayMode === 'table' ? '#fff' : '#495057',
                border: `1px solid ${displayMode === 'table' ? customization.cardButtonBgColor : '#ced4da'}`
              }}
            >
              <FaList className="me-2" size={14} />
              Table
            </Button>
          </ButtonGroup>
          
          <div className="d-none d-md-flex align-items-center">
            <select 
              className="form-select form-select-sm me-2"
              value={coursesPerPage}
              onChange={(e) => {
                setCoursesPerPage(Number(e.target.value));
                setCurrentPage(1); // Reset to first page when changing items per page
              }}
              style={{ width: '120px' }}
              aria-label="Number of courses per page"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={150}>150 per page</option>
              <option value={200}>200 per page</option>
              <option value={500}>500 per page</option>
              <option value={1000}>1000 per page</option>
            </select>
          </div>
        </div>
        
        <div className="results-summary">
          <span className="badge bg-secondary me-2">
            {(currentPage - 1) * coursesPerPage + 1}-{Math.min(currentPage * coursesPerPage, courses.length)}
          </span>
          <span className="text-muted">
            of {courses.length} course{courses.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <section aria-labelledby="course-section-heading">
        <h2 id="course-section-heading" className="visually-hidden">Course Listing</h2>
        
        {/* Course display - either cards or table */}
        {displayMode === 'card' ? (
          <Row className="g-4">
            {paginatedCourses.map((course) => (
              <Col xs="12" sm="6" md="6" lg="4" key={course.id}>
                <CourseCard
                  course={course}
                  customization={customization}
                  onRecordsClick={handleRecords}
                />
              </Col>
            ))}
          </Row>
        ) : (
          <CourseTable
            courses={paginatedCourses}
            customization={customization}
            onRecordsClick={handleRecords}
          />
        )}
        
        {/* Pagination controls with improved accessibility */}
        {totalPages > 1 && (
          <nav aria-label="Course pagination" className="mt-4">
            <div className="d-flex justify-content-center">
              <Pagination>
                <PaginationItem disabled={currentPage === 1}>
                  <PaginationLink 
                    previous 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) paginate(currentPage - 1);
                    }}
                    style={{ color: customization.cardButtonBgColor }}
                    aria-label="Go to previous page"
                  >
                    <FaChevronLeft size={12} aria-hidden="true" />
                  </PaginationLink>
                </PaginationItem>
                
                {getPageNumbers().map((page, index) => (
                  <PaginationItem 
                    key={`${page}-${index}`} 
                    active={page === currentPage}
                  >
                    {page === '...' ? (
                      <PaginationLink 
                        disabled 
                        className="border-0 bg-transparent"
                        aria-label="More pages"
                      >
                        &hellip;
                      </PaginationLink>
                    ) : (
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          paginate(page);
                        }}
                        style={{
                          backgroundColor: page === currentPage ? customization.cardButtonBgColor : '',
                          borderColor: page === currentPage ? customization.cardButtonBgColor : '',
                          color: page === currentPage ? '#fff' : customization.cardButtonBgColor || '#495057',
                        }}
                        aria-label={`Go to page ${page}`}
                        aria-current={page === currentPage ? 'page' : undefined}
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                
                <PaginationItem disabled={currentPage === totalPages}>
                  <PaginationLink 
                    next 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) paginate(currentPage + 1);
                    }}
                    style={{ color: customization.cardButtonBgColor }}
                    aria-label="Go to next page"
                  >
                    <FaChevronRight size={12} aria-hidden="true" />
                  </PaginationLink>
                </PaginationItem>
              </Pagination>
            </div>
          </nav>
        )}
      </section>

      {/* Scroll to top button with improved accessibility */}
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
          <FaArrowUp aria-hidden="true" />
          <span className="visually-hidden">Scroll to top</span>
        </Button>
      )}
    </div>
  );
}

CourseList.propTypes = {
  courses: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  isLoading: PropTypes.bool
};

CourseList.defaultProps = {
  isLoading: false
};

export default CourseList;