// src/components/AdminCourseCard.jsx
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, CardTitle, CardText, Button} from 'reactstrap';
import useCourseManagementStore from '../store/courseManagementStore';

function AdminCourseCard({ course, onDetailsClick }) {
  const { setCourse } = useCourseManagementStore();
  const navigate = useNavigate();

  const {
    name: courseName = 'No Title',
    courseNumber = 'Unknown Course #',
    departmentObject,
    courseListingObject,
    id: courseId,
  } = course;

  const courseListingId = courseListingObject?.id;

  // Derive display strings.
  const departmentName = departmentObject?.name || 'Unknown Department';
  const courseTypeName =
    courseListingObject?.courseTypeObject?.name ||
    courseListingObject?.courseTypeObject?.description ||
    'Unknown Type';
  const instructors = courseListingObject?.instructorObjects || [];
  const instructorNames = instructors.map((i) => i.name).join(', ') || 'N/A';
  const termName = courseListingObject?.termObject?.name || 'Unknown Term';
  const termStart = courseListingObject?.termObject?.startDate;
  const termEnd = courseListingObject?.termObject?.endDate;
  const locationName =
    courseListingObject?.locationObject?.name ||
    courseListingObject?.locationObject?.code ||
    'Unknown Location';

  // Simple "active" check based on term start and end dates.
  const isActive = (() => {
    if (!termStart || !termEnd) return false;
    const now = new Date();
    return now >= new Date(termStart) && now <= new Date(termEnd);
  })();

  // Handlers for navigation.
  const handleManageElectronic = () => {
    setCourse(course);
    navigate(`/admin/electronic/${courseListingId}`);
  };

  return (
    <Card className="h-100 shadow-sm p-3 mb-4 bg-body-tertiary rounded">
      <CardBody className="d-flex flex-column">
        <CardTitle tag="h5">{courseName}</CardTitle>
        <CardText>
          <strong>Course Number:</strong> {courseNumber}
        </CardText>
        <CardText>
          <strong>Department:</strong> {departmentName}
        </CardText>
        <CardText>
          <strong>Course Type:</strong> {courseTypeName}
        </CardText>
        <CardText>
          <strong>Instructor(s):</strong> {instructorNames}
        </CardText>
        <CardText>
          <strong>Term:</strong> {termName}
        </CardText>
        <CardText>
          <strong>Term Start:</strong> {termStart ? termStart.substring(0, 10) : 'N/A'}
        </CardText>
        <CardText>
          <strong>Term End:</strong> {termEnd ? termEnd.substring(0, 10) : 'N/A'}
        </CardText>
        <CardText>
          <strong>Location:</strong> {locationName}
        </CardText>
        <CardText>
          <strong>Status:</strong> {isActive ? 'Active' : 'Inactive'}
        </CardText>

        {/* Button for managing course details */}
        <Button
          color="primary"
          className="mt-auto"
          onClick={() => onDetailsClick(courseListingId || courseId)}
        >
          Manage Details
        </Button>

        {/* Button for managing electronic resources */}
        <Button
          color="warning"
          className="mt-2"
          onClick={handleManageElectronic}
          disabled={!courseListingId}
        >
          Manage E-Resources
        </Button>
      </CardBody>
    </Card>
  );
}

AdminCourseCard.propTypes = {
  course: PropTypes.shape({
    id: PropTypes.string,
    courseListingId: PropTypes.string,
    name: PropTypes.string,
    courseNumber: PropTypes.string,
    departmentObject: PropTypes.shape({
      name: PropTypes.string,
    }),
    courseListingObject: PropTypes.shape({
      id: PropTypes.string,
      instructorObjects: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          name: PropTypes.string,
          userId: PropTypes.string,
        })
      ),
      courseTypeObject: PropTypes.shape({
        name: PropTypes.string,
        description: PropTypes.string,
      }),
      termObject: PropTypes.shape({
        name: PropTypes.string,
        startDate: PropTypes.string,
        endDate: PropTypes.string,
      }),
      locationObject: PropTypes.shape({
        name: PropTypes.string,
        code: PropTypes.string,
      }),
    }),
  }).isRequired,
  onDetailsClick: PropTypes.func.isRequired,
};

export default AdminCourseCard;
