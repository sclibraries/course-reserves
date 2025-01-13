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
import { useNavigate, useLocation } from 'react-router-dom';
import useCustomizationStore from '../store/customizationStore';

function CourseList({ courses }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Grabbing the "college" from URL query params (e.g. ?college=hampshire)
  const queryParams = new URLSearchParams(location.search);
  const collegeParam = queryParams.get('college');

  // Pull the card styling for the current college from Zustand
  const {
    cardBgColor,
    cardBorderColor,
    cardTitleTextColor,
    cardTitleFontSize,
    cardTextColor,
    cardButtonBgColor
  } = useCustomizationStore((state) =>
    state.getCustomizationForCollege(collegeParam)
  );

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
  
    // Construct the new query params
    const newQueryParams = new URLSearchParams();
    newQueryParams.set('courseListingId', courseListingId);
  
    // If we have a college param, append it
    if (collegeParam) {
      newQueryParams.set('college', collegeParam);
    }
  
    navigate(`/records?${newQueryParams.toString()}`);
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
              <Card
                className="h-100 w-100 shadow-sm p-3 mb-5 bg-body-tertiary rounded"
                style={{
                  backgroundColor: cardBgColor,
                  border: `1px solid ${cardBorderColor}`,
                }}
              >
                <CardBody className="d-flex flex-column">
                  <CardTitle
                    tag="h5"
                    style={{
                      color: cardTitleTextColor,
                      fontSize: cardTitleFontSize,
                    }}
                  >
                    {name}
                  </CardTitle>
                  <CardText style={{ color: cardTextColor }}>
                    <strong>Course Number:</strong> {courseNumber}
                  </CardText>
                  <CardText style={{ color: cardTextColor }}>
                    <strong>Department:</strong> {departmentName}
                  </CardText>
                  <CardText style={{ color: cardTextColor }}>
                    <strong>Instructor(s):</strong> {instructorNames}
                  </CardText>
                  <CardText style={{ color: cardTextColor }}>
                    <strong>Term:</strong> {termName}
                  </CardText>
                  <CardText style={{ color: cardTextColor }}>
                    <strong>Location:</strong> {locationName}
                  </CardText>
                  <Button
                    className="mt-auto"
                    style={{ backgroundColor: cardButtonBgColor }}
                    onClick={() => handleRecords(courseListingId)}
                  >
                    See Records
                  </Button>
                </CardBody>
              </Card>
            </Col>
          );
        })}
      </Row>

      {showScrollTop && (
        <Button
          color="secondary"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '1000',
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
