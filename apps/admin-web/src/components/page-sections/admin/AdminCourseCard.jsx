/**
 * @file AdminCourseCard component
 * @module AdminCourseCard
 * @description Displays a single course card within the admin interface with modern styling.
 */

import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, Badge, Button } from 'reactstrap';
import { FaEye, FaBook, FaCalendarAlt, FaUser, FaBuilding } from 'react-icons/fa';
import useCourseManagementStore from '../../../store/courseManagementStore';

function AdminCourseCard({ course, onDetailsClick }) {
  const { setCourse } = useCourseManagementStore();
  const navigate = useNavigate();

  const {
    name: courseName = 'No Title',
    courseNumber = 'Unknown Course #',
    sectionName,
    departmentObject,
    courseListingObject,
    id: courseId,
  } = course;

  const courseListingId = courseListingObject?.id;

  // Derive display strings
  const departmentName = departmentObject?.name || 'Unknown Department';
  const instructors = courseListingObject?.instructorObjects || [];
  const instructorNames = instructors.map((i) => i.name).join(', ') || 'N/A';
  const termName = courseListingObject?.termObject?.name || 'Unknown Term';
  const locationName = courseListingObject?.locationObject?.name || 'Unknown Location';

  // Check if course is active
  const isActive = (() => {
    const termStart = courseListingObject?.termObject?.startDate;
    const termEnd = courseListingObject?.termObject?.endDate;
    if (!termStart || !termEnd) return false;
    const now = new Date();
    return now >= new Date(termStart) && now <= new Date(termEnd);
  })();

  // Navigate to manage electronic resources
  const handleManageElectronic = () => {
    setCourse(course);
    navigate(`/admin/electronic/${courseListingId}`);
  };

  return (
    <Card className="h-100 shadow-sm hover-card">
      <CardBody className="d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <Badge 
            color={isActive ? 'success' : 'secondary'} 
            pill 
            className="px-3 py-1"
          >
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <h5 className="course-title mb-1">{courseName}</h5>
        <div className="d-flex align-items-center gap-2 mb-3">
          <div className="course-number text-muted">{courseNumber}</div>
          {sectionName && (
            <Badge color="secondary" pill className="section-badge">
              Section {sectionName}
            </Badge>
          )}
        </div>

        <div className="d-flex align-items-center mb-2">
          <FaBuilding className="text-muted me-2" />
          <div className="text-truncate">{departmentName}</div>
        </div>

        <div className="d-flex align-items-center mb-2">
          <FaCalendarAlt className="text-muted me-2" />
          <div className="text-truncate">{termName}</div>
        </div>

        <div className="d-flex align-items-center mb-2">
          <FaUser className="text-muted me-2" />
          <div className="text-truncate">{instructorNames}</div>
        </div>

        <div className="d-flex align-items-center mb-4">
          <FaBuilding className="text-muted me-2" />
          <div className="text-truncate">{locationName}</div>
        </div>
        
        <div className="mt-auto d-flex flex-column gap-2">
          <Button
            color="primary"
            outline
            className="custom-btn d-flex align-items-center justify-content-center"
            onClick={() => onDetailsClick(courseListingId || courseId)}
          >
            <FaEye className="me-2" /> View Details
          </Button>
          
          <Button
            color="secondary"
            className="custom-btn d-flex align-items-center justify-content-center"
            onClick={handleManageElectronic}
            disabled={!courseListingId}
          >
            <FaBook className="me-2" /> Manage Resources
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

AdminCourseCard.propTypes = {
  course: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    courseNumber: PropTypes.string,
    sectionName: PropTypes.string,
    departmentObject: PropTypes.shape({
      name: PropTypes.string,
    }),
    courseListingObject: PropTypes.shape({
      id: PropTypes.string,
      instructorObjects: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
        })
      ),
      termObject: PropTypes.shape({
        name: PropTypes.string,
        startDate: PropTypes.string,
        endDate: PropTypes.string,
      }),
      locationObject: PropTypes.shape({
        name: PropTypes.string,
      }),
    }),
  }).isRequired,
  onDetailsClick: PropTypes.func.isRequired,
};

export default AdminCourseCard;