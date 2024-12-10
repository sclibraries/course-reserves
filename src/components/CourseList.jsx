import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Card,
  CardBody,
  Button,
  CardTitle,
  CardText,
  Row,
  Col,
} from 'reactstrap';
import useRecordStore from "../store/recordStore";
import { useNavigate } from 'react-router-dom';

function CourseList({ courses }) {
  const navigate = useNavigate();
  const { setRecord } = useRecordStore();
  
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    // On mount, try to restore scroll position from sessionStorage
    const storedScroll = sessionStorage.getItem('searchScrollPosition');
    if (storedScroll) {
      window.scrollTo(0, parseInt(storedScroll, 10));
    }

    const handleScroll = () => {
      // Show the "Return to Top" button if scrolled down by 200px or more
      if (window.scrollY > 200) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!courses || courses.length === 0) {
    return <p>No courses found.</p>;
  }

  const handleRecords = (courseListingId) => {
    setRecord(courseListingId);
    sessionStorage.setItem('searchScrollPosition', window.scrollY);
    navigate('/records?courseListingId=' + courseListingId);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mt-4">
      <Row className="g-4">
        {courses.map((course) => {
          const {
            id,
            name,
            courseNumber,
            departmentObject,
            courseListingObject,
            courseListingId,
          } = course;

          const departmentName = departmentObject?.name || 'Unknown Department';
          const instructors = courseListingObject?.instructorObjects?.map(i => i.name) || [];
          const instructorNames = instructors.join(', ') || 'No Instructors';
          const termName = courseListingObject?.termObject?.name || 'Unknown Term';
          const locationName = courseListingObject?.locationObject?.name || 'Unknown Location';

          return (
            <Col xs="12" md={courses.length === 1 ? "12" : "6"} key={id}>
              <Card className="h-100 w-100 shadow-sm p-3 mb-5 bg-body-tertiary rounded">
                <CardBody className="d-flex flex-column">
                  <CardTitle tag="h5" className="display-7">{name}</CardTitle>
                  <CardText><strong>Course Number:</strong> {courseNumber}</CardText>
                  <CardText><strong>Department:</strong> {departmentName}</CardText>
                  <CardText><strong>Instructor(s):</strong> {instructorNames}</CardText>
                  <CardText><strong>Term:</strong> {termName}</CardText>
                  <CardText><strong>Location:</strong> {locationName}</CardText>
                  <Button
                    color="primary"
                    onClick={() => handleRecords(courseListingId)}
                    className="mt-auto"
                  >
                    See Records
                  </Button>
                </CardBody>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Return to Top Button */}
      {showScrollTop && (
        <Button 
          color="secondary" 
          style={{ 
            position: 'fixed', 
            bottom: '20px', 
            right: '20px', 
            zIndex: '1000' 
          }} 
          onClick={scrollToTop}
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
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      courseNumber: PropTypes.string.isRequired,
      departmentObject: PropTypes.shape({
        name: PropTypes.string,
      }),
      courseListingObject: PropTypes.shape({
        instructorObjects: PropTypes.arrayOf(
          PropTypes.shape({
            name: PropTypes.string,
          })
        ),
        termObject: PropTypes.shape({
          name: PropTypes.string,
        }),
        locationObject: PropTypes.shape({
          name: PropTypes.string,
        }),
      }),
      courseListingId: PropTypes.string.isRequired,
    })
  ).isRequired,
};

export default CourseList;
