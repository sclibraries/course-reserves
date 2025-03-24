// CourseList.jsx
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, Button } from 'reactstrap';
import { useNavigate, useLocation } from 'react-router-dom';

import useRecordStore from '../../../store/recordStore';
import useCustomizationStore from '../../../store/customizationStore';
import CourseCard from './CourseCard';
import CourseTable from './CourseTable';
import useSearchStore from '../../../store/searchStore';

function CourseList({ courses }) {
  const navigate = useNavigate();
  const location = useLocation();

  const displayMode = useSearchStore((state) => state.displayMode);
  const setDisplayMode = useSearchStore((state) => state.setDisplayMode);

  const queryParams = new URLSearchParams(location.search);
  const collegeParam = queryParams.get('college');

  const { setRecord } = useRecordStore();
  const [showScrollTop, setShowScrollTop] = useState(false);


  // Get customization from the store
  const customization = useCustomizationStore((state) =>
    state.getCustomizationForCollege(collegeParam)
  );

  useEffect(() => {
    const storedScroll = sessionStorage.getItem('searchScrollPosition');
    if (storedScroll) {
      window.scrollTo(0, parseInt(storedScroll, 10));
    }

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const handleToggleDisplay = () => {
    setDisplayMode(displayMode === 'card' ? 'table' : 'card');
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!courses || courses.length === 0) {
    return <p role="alert" className="text-danger">No courses found.</p>;
  }

  return (
    <div className="mt-4">
         <div className="mb-3 d-flex justify-content-end">
        <Button color="link" className="p-0 icon-button" onClick={handleToggleDisplay}>
          {displayMode === 'card' ? (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                fill="currentColor"
                className="bi bi-list"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"
                />
              </svg>
              <span className="ms-1 visually-hidden">Switch to Compact (Table) View</span>
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                fill="currentColor"
                className="bi bi-grid"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path
                  d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z"
                />
              </svg>
              <span className="ms-1 visually-hidden">Switch to Detailed (Card) View</span>
            </>
          )}
        </Button>
      </div>
      <section aria-labelledby="course-list">
        <h1 id="course-list" className="visually-hidden">List of Available Courses</h1>
        
        {displayMode === 'card' ? (
          <Row className="g-4">
            {courses.map((course) => (
              <Col xs="12" sm="6" md="4" lg="3" key={course.id}>
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
            courses={courses}
            customization={customization}
            onRecordsClick={handleRecords}
          />
        )}
      </section>

      {showScrollTop && (
        <Button
          color="secondary"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '1000',
            backgroundColor: '#333',
            color: '#ffffff',
          }}
          onClick={scrollToTop}
          tabIndex="0"
          aria-label="Scroll to top of the page"
        >
          ↑ Top
        </Button>
      )}
    </div>
  );
}

CourseList.propTypes = {
  courses: PropTypes.arrayOf(
    PropTypes.shape({
    })
  ).isRequired,
};

export default CourseList;