// CourseList.jsx
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, Button } from 'reactstrap';
import { useNavigate, useLocation } from 'react-router-dom';

import useRecordStore from '../store/recordStore';
import useCustomizationStore from '../store/customizationStore';
import CourseCard from './CourseCard';

function CourseList({ courses }) {
  const navigate = useNavigate();
  const location = useLocation();

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

  if (!courses || courses.length === 0) {
    return <p role="alert" className="text-danger">No courses found.</p>;
  }

  return (
    <div className="mt-4">
      <section aria-labelledby="course-list">
        <h1 id="course-list" className="visually-hidden">List of Available Courses</h1>
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