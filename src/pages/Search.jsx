import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useCourseStore from '../store';
import useSearchStore from '../store/searchStore';
import CourseList from '../components/page-sections/search/CourseList';
import { useBuildQuery } from '../hooks/useBuildQuery';
import { Container,Alert } from 'reactstrap';
import { trackingService } from '../services/trackingService';
import useCustomizationStore from '../store/customizationStore';
import '../css/CourseList.css'; // Import the new CSS

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
    displayMode,
    setDisplayMode
  } = useSearchStore();

  const fetchResults = useCourseStore((state) => state.fetchResults);
  const results = useCourseStore((state) => state.results);
  const error = useCourseStore((state) => state.error);
  const loading = useCourseStore((state) => state.loading);
  const currentCollege = useCustomizationStore((state) => state.currentCollege);
  const collegeParam = new URLSearchParams(location.search).get('college') || currentCollege || 'all';
  
  // Get college name for heading
  const getCollegeName = () => {
    switch (collegeParam) {
      case 'smith': return 'Smith College';
      case 'hampshire': return 'Hampshire College';
      case 'mtholyoke': return 'Mount Holyoke College';
      case 'amherst': return 'Amherst College';
      case 'umass': return 'UMass Amherst';
      default: return 'Five College Consortium';
    }
  };

  const [isInitialized, setIsInitialized] = useState(false);

  // Parse URL parameters on mount and whenever the URL changes
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);

    const collegeParam = queryParams.get('college') || currentCollege ||  'all';
    const typeParam = queryParams.get('type') || 'all';
    const queryParam = queryParams.get('query') || '';
    const departmentParam = queryParams.get('department') || '';
    const sortParam = queryParams.get('sort') || '';
    const displayModeParam = queryParams.get('displayMode') || 'card';

    // Update store if parameters have changed
    if (collegeParam !== college) setCollege(collegeParam);
    if (typeParam !== type) setType(typeParam);
    if (queryParam !== query) setQuery(queryParam);
    if (departmentParam !== department) setDepartment(departmentParam);
    if (sortParam !== sortOption) setSortOption(sortParam);
    if (displayModeParam !== displayMode) setDisplayMode(displayModeParam); // Update store


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

    if(displayMode && displayMode.trim() !== '') {
      queryParams.set('displayMode', displayMode.trim());
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
  }, [college, type, query, department, sortOption, displayMode]);

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
      {/* Add a proper h1 heading for the page */}
      <h1 className={query ? "display-6" : "visually-hidden"}>
        {query 
          ? `Search Results for "${query}" - ${getCollegeName()} Course Reserves` 
          : `${getCollegeName()} Course Reserves`
        }
      </h1>
      
      {error && (
        <Alert color="danger" className="mt-3">
          Error loading courses: {error.message}
        </Alert>
      )}
      
      <CourseList 
        courses={results} 
        isLoading={loading}
      />
    </Container>
  );
}

export default Search;
