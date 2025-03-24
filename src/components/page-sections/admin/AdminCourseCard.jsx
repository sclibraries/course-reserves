/**
 * @file AdminCourseCard component
 * @module AdminCourseCard
 * @description Displays a single course card within the admin interface. Shows course details,
 * instructor info, term info, and provides buttons for managing details and e-resources.
 *
 * @requires prop-types
 * @requires react-router-dom
 * @requires reactstrap
 * @requires ../../../store/courseManagementStore
 */

import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, CardTitle, CardText, Button } from 'reactstrap';
import useCourseManagementStore from '../../../store/courseManagementStore';

/**
 * Admin course card component
 *
 * Displays course metadata, term information, location, and offers navigation
 * for managing additional details or electronic resources.
 * 
 * Features:
 * - Shows department, instructors, and term info.
 * - Checks if course term is active based on the current date.
 * - Provides button to view/edit course details.
 * - Provides button to manage electronic resources (if set).
 *
 * @component
 * @example
 * const onDetailsClick = (courseListingId) => {
 *   // navigate to course details
 * };
 *
 * return (
 *   <AdminCourseCard
 *     course={someCourseObject}
 *     onDetailsClick={onDetailsClick}
 *   />
 * );
 *
 * @param {Object} props - Component properties
 * @param {Object} props.course - Course data object
 * @param {string} [props.course.id] - Primary course ID
 * @param {string} [props.course.courseListingId] - Course listing ID
 * @param {string} [props.course.name] - Display name of the course
 * @param {string} [props.course.courseNumber] - Course number (e.g. ENG-101)
 * @param {Object} [props.course.departmentObject] - Department info
 * @param {string} [props.course.departmentObject.name] - Department name
 * @param {Object} [props.course.courseListingObject] - Detailed listing object
 * @param {string} [props.course.courseListingObject.id] - ListingId used for sub-routes
 * @param {Object[]} [props.course.courseListingObject.instructorObjects] - Instructors list
 * @param {string} props.course.courseListingObject.instructorObjects[].id - Instructor ID
 * @param {string} props.course.courseListingObject.instructorObjects[].name - Instructor name
 * @param {string} props.course.courseListingObject.instructorObjects[].userId - Auth user ID
 * @param {Object} [props.course.courseListingObject.courseTypeObject] - Course type metadata
 * @param {string} [props.course.courseListingObject.courseTypeObject.name] - Type name
 * @param {string} [props.course.courseListingObject.courseTypeObject.description] - Type description
 * @param {Object} [props.course.courseListingObject.termObject] - Term info
 * @param {string} [props.course.courseListingObject.termObject.name] - Term name
 * @param {string} [props.course.courseListingObject.termObject.startDate] - Term start date
 * @param {string} [props.course.courseListingObject.termObject.endDate] - Term end date
 * @param {Object} [props.course.courseListingObject.locationObject] - Location info
 * @param {string} [props.course.courseListingObject.locationObject.name] - Location name
 * @param {string} [props.course.courseListingObject.locationObject.code] - Location code
 * @param {Function} props.onDetailsClick - Handler for "Manage Details" button click
 *
 * @return {JSX.Element} A card displaying course information with action buttons.
 */
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

  // Derive display strings
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

  /**
   * Determine if the course term is currently active based on start/end dates
   * @private
   * @function
   * @returns {boolean} True if current date is within the term's range
   */
  const isActive = (() => {
    if (!termStart || !termEnd) return false;
    const now = new Date();
    return now >= new Date(termStart) && now <= new Date(termEnd);
  })();

  /**
   * Navigate to manage electronic resources for this course
   * @private
   * @function
   * @returns {void}
   */
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

        {/* Button to manage course details */}
        <Button
          color="primary"
          className="mt-auto"
          onClick={() => onDetailsClick(courseListingId || courseId)}
        >
          Manage Details
        </Button>

        {/* Button to manage electronic resources */}
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