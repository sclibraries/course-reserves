// src/components/admin/forms/CrossLinkForm.jsx
import { useState, useEffect } from 'react';
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
import { useBuildQuery } from '../../../../hooks/useBuildQuery';
import { adminCourseService } from '../../../../services/admin/adminCourseService';
import { transformFolioCourseToLocal } from '../../../../util/adminTransformers';
import useCourseStore from '../../../../store';
import { toast } from 'react-toastify';
import { useAdminCourseStore } from '../../../../store/adminCourseStore';
import useAdminSearchStore from '../../../../store/adminSearchStore';
import useSearchStore from '../../../../store/searchStore';
import useCollegeManagement from '../../../../hooks/useCollegeManagement';

/**
 * CrossLinkForm Component
 * -----------------------
 * 
 * **Purpose**: Provides an interface for admins to search for FOLIO courses and link them 
 * to local resources, enabling cross-course resource sharing. Also displays currently linked
 * courses and provides unlinking functionality.
 * 
 * **Key Features**:
 * - Displays currently linked courses with unlink functionality
 * - Integrated with courseStore for consistent search functionality
 * - Uses searchStore for term management (same as HorizontalAdminSidebar)
 * - Uses adminSearchStore for search parameters (same as HorizontalAdminSidebar)
 * - Defaults college selection based on user permissions (like HorizontalAdminSidebar)
 * - College dropdown shows appropriate options based on user role and institution
 * - Supports filtering by college, department, search area, and term
 * - Real-time search with loading states and error handling (no search term required)
 * - Creates local course entries for FOLIO courses when needed (handles exists: false case)
 * - Links selected courses to existing resources
 * - Visual indicators for already linked courses in search results
 * 
 * **Usage**:
 * Used by ResourceFormManager when formType is ResourceFormType.CROSSLINK
 * 
 * **Data Flow**:
 * 1. Loads and displays currently linked courses on mount
 * 2. Fetches available terms from searchStore
 * 3. User configures search filters (college, search area, query, term, etc.)
 * 4. Component builds CQL query using useBuildQuery hook
 * 5. Searches FOLIO via courseStore.fetchResults with term filtering
 * 6. Displays results in searchable table with link status indicators
 * 7. On course selection, checks if course exists locally
 * 8. Creates local course entry (course + offering) if needed, then links to resource
 * 9. Refreshes linked courses list after linking/unlinking
 * 
 * **Dependencies**:
 * - courseStore: For FOLIO search functionality
 * - searchStore: For term management and filtering
 * - adminSearchStore: For search parameters (college, query, department, type)
 * - adminCourseService: For local course management and linking
 * - useBuildQuery: For CQL query construction
 * - useCollegeManagement: For centralized college selection logic
 * 
 * @component
 * @example
 * // Used within ResourceFormManager
 * <CrossLinkForm
 *   onSuccess={handleSuccessfulLink}
 *   courseInfo={existingCourseInfo}
 * />
 */
export function CrossLinkForm({ onSuccess, courseInfo }) {
  // Use adminSearchStore for search parameters (same as HorizontalAdminSidebar)
  const {
    college,
    type,
    query,
    department,
    sort,
    setCollege,
    setType,
    setQuery,
    setDepartment,
    setSort
  } = useAdminSearchStore();

  // Use the centralized college management hook
  const {
    selectedCollege,
    availableColleges,
    handleCollegeChange,
    resetCollege,
    isCollegeDisabled
  } = useCollegeManagement(college, setCollege); // Pass setCollege to sync with store
  
  // Local states for search parameters that aren't in adminSearchStore
  // Note: We use local searchArea/sortOption but sync with adminSearchStore type/sort
  const [searchArea, setSearchArea] = useState('all'); // corresponds to 'type' in adminSearchStore
  const [sortOption, setSortOption] = useState(''); // corresponds to 'sort' in adminSearchStore
  
  // State for linked courses
  const [linkedCourses, setLinkedCourses] = useState([]);
  const [loadingLinked, setLoadingLinked] = useState(false);

  const { course} = useAdminCourseStore();
  
  // Use searchStore for term management
  const { 
    termId, 
    setTermId, 
    terms, 
    fetchTerms, 
    termsLoading 
  } = useSearchStore();

  // Retrieve search functions and state from courseStore
  const fetchResults = useCourseStore((state) => state.fetchResults);
  const results = useCourseStore((state) => state.results);
  const error = useCourseStore((state) => state.error);
  const loading = useCourseStore((state) => state.loading);

  // Build the CQL query using the current search parameters and term filter
  const cqlQuery = useBuildQuery(college, searchArea, query, department, sortOption, termId);

  // Sync local search parameters with adminSearchStore
  useEffect(() => {
    setSearchArea(type || 'all');
    setSortOption(sort || '');
  }, [type, sort]);

  // Load terms when component mounts
  useEffect(() => {
    if (terms.length === 0 && !termsLoading) {
      fetchTerms(true); // Set default term to current
    }
  }, [terms.length, termsLoading, fetchTerms]);

  // Automatically load courses based on selected filters when component mounts or filters change
  useEffect(() => {
    const loadFilteredCourses = async () => {
      try {
        // Use the built CQL query which respects all filters (college, term, etc.)
        await fetchResults(cqlQuery);
      } catch (err) {
        console.error('Error loading courses:', err);
      }
    };
    
    // Only load if we have terms loaded and a college is set
    if (terms.length > 0 && college !== 'all') {
      loadFilteredCourses();
    }
  }, [fetchResults, cqlQuery, terms.length, college]); // Include all relevant dependencies

  // Load linked courses when component mounts or when course changes
  useEffect(() => {
    const loadLinkedCourses = async () => {
      if (!course?.offering_id) return;
      
      setLoadingLinked(true);
      try {
        const linked = await adminCourseService.getLinkedCourses(course.offering_id);
        setLinkedCourses(linked);
      } catch (err) {
        console.error('Error loading linked courses:', err);
        toast.error('Error loading linked courses.');
      } finally {
        setLoadingLinked(false);
      }
    };
    
    loadLinkedCourses();
  }, [course?.offering_id]);

  /**
   * handleSearch
   * -------------
   * Triggers the search by calling fetchResults from the courseStore with the built CQL query.
   * Like HorizontalAdminSidebar, allows searching without requiring a search term.
   */
  const handleSearch = async () => {
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
    const data = course;
    try {
      // Check if the local record exists using the FOLIO course listing ID
      // Try multiple possible property names for the course ID
      const folioCourseId = folioCourse.courseListingId || folioCourse.id || folioCourse.folioCourseId;
      
      // Validate folioCourseId before making API call
      if (!folioCourseId) {
        console.error('Missing folioCourseId from FOLIO course data:', folioCourse);
        toast.error('Invalid course data. Missing course listing ID.');
        return;
      }
      
      console.log('Checking course exists with folioCourseId:', folioCourseId);
      const existsResult = await adminCourseService.checkCourseExists(folioCourseId);
      
      let localCourse = null;
      
      if (existsResult.exists) {
        // Course exists, use the existing course and offerings
        localCourse = existsResult.course;
        if (existsResult.offerings) {
          localCourse.offerings = existsResult.offerings;
        }
      } else {
        // Course doesn't exist, need to create both course and offering
        console.log('Course does not exist, creating from FOLIO data');
        
        // Transform FOLIO course data into the local data structure
        const transformedData = transformFolioCourseToLocal(folioCourse);
        
        // Create a local course record with both course and offering data
        const createResult = await adminCourseService.createFromFolio(
          transformedData.course, 
          transformedData.offering
        );
        
        localCourse = {
          ...createResult.course,
          offerings: [createResult.offering]
        };
      }

      // Verify we have the necessary data for linking
      if (!data || !data.offering_id) {
        toast.error('Error linking course. Source course offering ID is missing.');
        return;
      }

      if (!localCourse || !localCourse.offerings || localCourse.offerings.length === 0) {
        toast.error('Error linking course. Target course offering is missing.');
        return;
      }

      // Link the local course to the resource using provided IDs
      await adminCourseService.linkCourses(data.offering_id, localCourse.offerings[0].offering_id);

      toast.success('Course linked successfully.');
      
      // Refresh linked courses list
      const linked = await adminCourseService.getLinkedCourses(data.offering_id);
      setLinkedCourses(linked);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error linking FOLIO course:', err);
      toast.error(`Error linking course: ${err.message}`);
    }
  };

  /**
   * handleUnlinkCourse
   * ------------------
   * Unlinks a course offering from the current course using the offering_link_id
   */
  const handleUnlinkCourse = async (offeringLinkId) => {
    if (!offeringLinkId) {
      toast.error('Error unlinking course. Link ID is missing.');
      return;
    }

    if (window.confirm('Are you sure you want to unlink this course?')) {
      try {
        await adminCourseService.unlinkCourses(offeringLinkId);
        toast.success('Course unlinked successfully.');
        
        // Refresh linked courses list
        const data = course;
        if (data?.offering_id) {
          const linked = await adminCourseService.getLinkedCourses(data.offering_id);
          setLinkedCourses(linked);
        }
        
        if (onSuccess) {
          onSuccess();
        }
      } catch (err) {
        console.error('Error unlinking course:', err);
        toast.error(`Error unlinking course: ${err.message}`);
      }
    }
  };

  /**
   * handleReset
   * ------------
   * Resets the search filters and clears the search results in the courseStore.
   */
  const handleReset = () => {
    // Reset adminSearchStore values
    setType('all');
    setQuery('');
    setDepartment('');
    setSort('');
    
    // Reset local states
    setSearchArea('all');
    setSortOption('');
    setTermId(null); // Reset to show all terms
    
    // Reset college using the hook
    resetCollege();
    
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
              value={selectedCollege}
              onChange={(e) => handleCollegeChange(e.target.value)}
              disabled={isCollegeDisabled}
            >
              {availableColleges.map((col) => (
                <option key={col} value={col}>{col}</option>
              ))}
            </Input>
          </FormGroup>
        </Col>
        <Col md={3}>
          <FormGroup>
            <Label htmlFor="termSelect">Term</Label>
            <Input
              id="termSelect"
              type="select"
              value={termId || ''}
              onChange={(e) => setTermId(e.target.value === '' ? null : e.target.value)}
              disabled={termsLoading}
            >
              <option value="">Current Term</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>{term.name}</option>
              ))}
            </Input>
            {termsLoading && <small className="text-muted">Loading terms...</small>}
          </FormGroup>
        </Col>
        <Col md={3}>
          <FormGroup>
            <Label htmlFor="searchAreaSelect">Search Area</Label>
            <Input
              id="searchAreaSelect"
              type="select"
              value={searchArea}
              onChange={(e) => {
                setSearchArea(e.target.value);
                setType(e.target.value); // Sync with adminSearchStore
              }}
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

      {/* Currently Linked Courses Section */}
      <div className="mb-4">
        <h5>Currently Linked Courses</h5>
        {loadingLinked && <p>Loading linked courses...</p>}
        {!loadingLinked && linkedCourses.length === 0 && (
          <p className="text-muted">No courses are currently linked to this course.</p>
        )}
        {!loadingLinked && linkedCourses.length > 0 && (
          <Table responsive striped size="sm">
            <thead>
              <tr>
                <th scope="col">Course Number</th>
                <th scope="col">Course Name</th>
                <th scope="col">Department</th>
                <th scope="col">Term</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {linkedCourses.map((linkedCourse) => (
                <tr key={linkedCourse.offering_link_id || linkedCourse.offering_id}>
                  <td>{linkedCourse.course_number}</td>
                  <td>{linkedCourse.course_name}</td>
                  <td>{linkedCourse.department_name}</td>
                  <td>{linkedCourse.term_name}</td>
                  <td>
                    <Button
                      color="danger"
                      size="sm"
                      onClick={() => handleUnlinkCourse(linkedCourse.offering_link_id)}
                      title="Unlink this course"
                    >
                      <i className="fas fa-unlink"></i> Unlink
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

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
            
            // Check if this course is already linked
            const folioCourseId = course.courseListingId || course.id || course.folioCourseId;
            const isAlreadyLinked = linkedCourses.some(linked => 
              linked.folio_course_id === folioCourseId
            );
            
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
                  ) : isAlreadyLinked ? (
                    <Badge color="warning" pill>
                      Already Linked
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
  onSuccess: PropTypes.func, // Callback to refresh parent component on success
  courseInfo: PropTypes.object, // Pre-selected course data (if any)
  onClose: PropTypes.func,   // Optional callback to close the modal
};

export default CrossLinkForm;
