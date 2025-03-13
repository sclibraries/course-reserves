import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useCourseStore from '../store';
import useSearchStore from '../store/searchStore';
import CourseList from '../components/CourseList';
import { useBuildQuery } from '../hooks/useBuildQuery';
import { Container, Spinner, Alert } from 'reactstrap';
import { trackingService } from '../services/trackingService';
import useCustomizationStore from '../store/customizationStore';


function Search() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    college,
    type,
    query,
    department,
    sortOption,
    setCollege,
    setType,
    setQuery,
    setDepartment,
    setSortOption,
  } = useSearchStore();

  const fetchResults = useCourseStore((state) => state.fetchResults);
  const results = useCourseStore((state) => state.results);
  const error = useCourseStore((state) => state.error);
  const loading = useCourseStore((state) => state.loading);
  const currentCollege = useCustomizationStore((state) => state.currentCollege);

  const [isInitialized, setIsInitialized] = useState(false);

  // Parse URL parameters on mount and whenever the URL changes
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);

    const collegeParam = queryParams.get('college') || currentCollege ||  'all';
    const typeParam = queryParams.get('type') || 'all';
    const queryParam = queryParams.get('query') || '';
    const departmentParam = queryParams.get('department') || '';
    const sortParam = queryParams.get('sort') || '';

    // Update store if parameters have changed
    if (collegeParam !== college) setCollege(collegeParam);
    if (typeParam !== type) setType(typeParam);
    if (queryParam !== query) setQuery(queryParam);
    if (departmentParam !== department) setDepartment(departmentParam);
    if (sortParam !== sortOption) setSortOption(sortParam);

    setIsInitialized(true);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Update URL parameters when store changes
  useEffect(() => {
    if (!isInitialized) return; // Prevent URL update before initialization

    const queryParams = new URLSearchParams();

    if (college && college !== 'all') {
      queryParams.set('college', college);
    }
    if (type && type !== 'all') {
      queryParams.set('type', type);
    }
    if (query && query.trim() !== '') {
      queryParams.set('query', query.trim());
    }
    if (department && department.trim() !== '') {
      queryParams.set('department', department.trim());
    }
    if (sortOption && sortOption.trim() !== '') {
      queryParams.set('sort', sortOption.trim());
    }

    const newSearch = queryParams.toString();
    const currentSearch = location.search.startsWith('?') ? location.search.substring(1) : location.search;

    if (newSearch !== currentSearch) {
      navigate({
        pathname: location.pathname,
        search: `?${newSearch}`,
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [college, type, query, department, sortOption]);

  // Build the query using the updated buildQuery function that can handle department and sort
  const cqlQuery = useBuildQuery(college, type, query, department, sortOption);

  useEffect(() => {
    if (!isInitialized) return;
    
    fetchResults(cqlQuery);

    // Track the search event.
    // Since this is a search, we send placeholder values for course-specific fields.
    const trackingData = {
      college: college,
      event_type: "search",
      course_id: "N/A",
      term: "N/A",
      course_name: "",
      course_code: "",
      instructor: null,
      metadata: {
        query: query,
        type: type,
        department: department,
        sortOption: sortOption,
        cqlQuery: cqlQuery,
      },
    };

    trackingService.trackEvent(trackingData)
      .then(() => console.log("Search event tracked."))
      .catch((error) => console.error("Error tracking search event:", error));
  }, [cqlQuery, fetchResults, isInitialized, college, type, query, department, sortOption]);  

  if (!isInitialized) {
    return null;
  }

  return (
    <Container fluid>
      {error && (
        <Alert color="danger" className="mt-3">
          Error loading courses: {error.message}
        </Alert>
      )}
      {loading ? (
        <div className="text-center mt-5">
          <Spinner color="primary" />
          <p className="mt-2">Loading courses...</p>
        </div>
      ) : (
        <>
          <CourseList courses={results} />
        </>
      )}
    </Container>
  );
}

export default Search;
