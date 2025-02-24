// src/components/AdminCourseCard.jsx
import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, CardTitle, CardText, Button, Spinner } from 'reactstrap';
import useCourseManagementStore from '../store/courseManagementStore';
import { fetchRecords } from './CourseRecords/api';
import { adminCourseService } from '../services/admin/adminCourseService';

function AdminCourseCard({ course, onDetailsClick }) {
  const [printCount, setPrintCount] = useState(0);
  const [electronicCount, setElectronicCount] = useState(0);
  const [loadingPrintCount, setLoadingPrintCount] = useState(false);
  const [loadingElectronicCount, setLoadingElectronicCount] = useState(false);
  const [ setError] = useState(null);
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

  // Fetch the number of print items.
  const fetchPrintItems = useCallback(async () => {
    if (!courseListingId) return;
    setLoadingPrintCount(true);
    setError(null);

    try {
      const reserves = await fetchRecords(courseListingId);
      setPrintCount(reserves.length);
    } catch (err) {
      setError(`Failed to fetch print count: ${err.message || err}`);
      setPrintCount(0);
    } finally {
      setLoadingPrintCount(false);
    }
  }, [courseListingId]);

  // Fetch the number of electronic items.
  const fetchElectronicItems = useCallback(async () => {
    if (!courseListingId) return;
    setLoadingElectronicCount(true);
    setError(null);

    try {
      const reserves = await adminCourseService.getResourcesByCourse(courseListingId);
      setElectronicCount(reserves.count || 0);
    } catch (err) {
      setError(`Failed to fetch electronic count: ${err.message || err}`);
      setElectronicCount(0);
    } finally {
      setLoadingElectronicCount(false);
    }
  }, [courseListingId]);

  // Load both counts when the component mounts or when courseListingId changes.
  useEffect(() => {
    // fetchPrintItems();
    // fetchElectronicItems();
  }, [fetchPrintItems, fetchElectronicItems]);

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
        <CardText>
          <strong>Print Items:</strong>{' '}
          {loadingPrintCount ? <Spinner size="sm" color="primary" /> : printCount}
        </CardText>
        <CardText>
          <strong>Electronic Items:</strong>{' '}
          {loadingElectronicCount ? <Spinner size="sm" color="primary" /> : electronicCount}
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
