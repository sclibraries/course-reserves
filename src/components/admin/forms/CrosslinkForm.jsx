// src/components/admin/forms/CrossLinkForm.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  FormGroup,
  Label,
  Input,
  Button,
  Spinner,
  Row,
  Col,
  Table,
  ButtonGroup,
  Badge
} from 'reactstrap';
import { useBuildQuery } from '../../../hooks/useBuildQuery';
import { adminCourseService } from '../../../services/admin/adminCourseService';
import { transformFolioCourseToLocal } from '../../../util/adminTransformers';
import useCourseStore from '../../../store';
import { toast } from 'react-toastify';
import { useAdminCourseStore } from '../../../store/adminCourseStore';

/**
 * CrossLinkForm Component
 * --------------------------
 * Provides an interface for admins to search for a FOLIO course and link it to a local resource.
 * This version leverages courseStore's search state and fetchResults function so that it stays
 * consistent with the sidebar search functionality.
 */
export function CrossLinkForm({ resourceId, onSuccess, onClose, courseInfo }) {
  // Local states for search parameters
  const [college, setCollege] = useState('all');
  const [searchArea, setSearchArea] = useState('all'); // corresponds to 'type' in your courseStore
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [sortOption, setSortOption] = useState('');

  const { course, folioCourseData } = useAdminCourseStore();

  // Retrieve search functions and state from courseStore
  const fetchResults = useCourseStore((state) => state.fetchResults);
  const results = useCourseStore((state) => state.results);
  const error = useCourseStore((state) => state.error);
  const loading = useCourseStore((state) => state.loading);

  // Build the CQL query using the current search parameters
  const cqlQuery = useBuildQuery(college, searchArea, query, department, sortOption);

  /**
   * handleSearch
   * -------------
   * Validates the input and then triggers the search by calling fetchResults
   * from the courseStore with the built CQL query.
   */
  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter a search term.');
      return;
    }
    try {
      await fetchResults(cqlQuery);
    } catch (err) {
      console.error('Error fetching courses:', err);
      toast.error('Error fetching courses. Please try again.');
    }
  };

  /**
   * handleLinkCourse
   * -----------------
   * Checks whether the selected FOLIO course exists in the local DB.
   * If not, creates a new local course entry and then links it to the given resource.
   */
  const handleLinkCourse = async (folioCourse) => {
    const data = course
    try {
      // Check if the local record exists using the FOLIO course listing ID
      const folioCourseId = folioCourse.courseListingId;
      const { exists, course: existingCourse, offerings } =
        await adminCourseService.checkCourseExists(folioCourseId);

      let localCourse = existingCourse;
      if (!exists) {
        // Transform FOLIO course data into the local data structure
        const uploadData = transformFolioCourseToLocal(folioCourse);
        // Create a local course record
        localCourse = await adminCourseService.createLocalCourse(uploadData);
        if (offerings) {
          localCourse.offerings = offerings;
        }
      }

      // Link the local course to the resource using provided IDs
      await adminCourseService.linkCourses(data.offering_id, localCourse.offering.offering_id);

      toast.success('Course linked successfully.');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error linking FOLIO course:', err);
      toast.error('Error linking course. Please try again.');
    }
  };

  /**
   * handleReset
   * ------------
   * Resets the search filters and clears the search results in the courseStore.
   */
  const handleReset = () => {
    setCollege('all');
    setSearchArea('all');
    setQuery('');
    setDepartment('');
    setSortOption('');
    useCourseStore.setState({ results: [] });
  };

  return (
    <div>
      <Row>
        <Col md={3}>
          <FormGroup>
            <Label htmlFor="collegeSelect">College</Label>
            <Input
              id="collegeSelect"
              type="select"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
            >
              <option value="all">All</option>
              <option value="smith">Smith</option>
              <option value="hampshire">Hampshire</option>
              <option value="mtholyoke">Mount Holyoke</option>
              <option value="amherst">Amherst</option>
              <option value="umass">UMass</option>
            </Input>
          </FormGroup>
        </Col>
        <Col md={3}>
          <FormGroup>
            <Label htmlFor="searchAreaSelect">Search Area</Label>
            <Input
              id="searchAreaSelect"
              type="select"
              value={searchArea}
              onChange={(e) => setSearchArea(e.target.value)}
            >
              <option value="all">All fields</option>
              <option value="name">Course Name</option>
              <option value="code">Course Code</option>
              <option value="section">Section</option>
              <option value="instructor">Instructor</option>
            </Input>
          </FormGroup>
        </Col>
        <Col md={3}>
          <FormGroup>
            <Label htmlFor="queryInput">Search Term</Label>
            <Input
              id="queryInput"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter search term"
            />
          </FormGroup>
        </Col>
      </Row>

      <Row>
        <Col md={9} className="d-flex align-items-end">
          <ButtonGroup className="w-100 w-md-auto">
            <Button color="primary" onClick={handleSearch} disabled={loading}>
              {loading ? <Spinner size="sm" /> : 'Search'}
            </Button>
            <Button
              color="secondary"
              onClick={handleReset}
              aria-label="Reset search filters"
            >
              <i className="fas fa-undo" role="button"></i>
              <span className="d-inline ml-1">Reset</span>
            </Button>
          </ButtonGroup>
        </Col>
      </Row>

      <hr />
      <h5>Search Results</h5>
      {loading && <p>Searching...</p>}
      {!loading && results.length === 0 && <p>No courses found.</p>}
      {error && <p className="text-danger">Error: {error.message}</p>}
      <Table responsive striped>
        <thead>
          <tr>
            <th scope="col">Course Number</th>
            <th scope="col">Course Name</th>
            <th scope="col">Section</th>
            <th scope="col">Instructor</th>
            <th scope="col">Term</th>
            <th scope="col">Location</th>
            <th scope="col">Department</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {results.map((course) => {
            // Extract instructor names if available
            const instructors = course?.courseListingObject?.instructorObjects
              ? course.courseListingObject.instructorObjects.map((i) => i.name)
              : [];
            return (
              <tr key={course.id || course.folioCourseId}>
                <td>{course.courseNumber}</td>
                <td>{course.name}</td>
                <td>{course.sectionName}</td>
                <td>{instructors.join(', ')}</td>
                <td>{course?.courseListingObject?.termObject?.name}</td>
                <td>{course?.courseListingObject?.locationObject?.name}</td>
                <td>{course?.departmentObject?.name}</td>
                <td>
                  {courseInfo && courseInfo.course_number === course.courseNumber ? (
                    <Badge color="danger" pill>
                      Selected Course
                    </Badge>
                  ) : (
                    <Button
                      color="success"
                      size="sm"
                      disabled={loading}
                      onClick={() => handleLinkCourse(course)}
                    >
                      Link
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

CrossLinkForm.propTypes = {
  resourceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onSuccess: PropTypes.func, // Callback to refresh parent component on success
  courseInfo: PropTypes.object, // Pre-selected course data (if any)
  onClose: PropTypes.func,   // Optional callback to close the modal
};

export default CrossLinkForm;
