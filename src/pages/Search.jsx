import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useCourseStore from '../store';
import useSearchStore from '../store/searchStore';
import CourseList from '../components/page-sections/search/CourseList';
import ItemSearchResults from '../components/page-sections/search/ItemSearchResults';
import { useBuildQuery } from '../hooks/useBuildQuery';
import { Container,Alert } from 'reactstrap';
import { trackingService } from '../services/trackingService';
import useCustomizationStore from '../store/customizationStore';
import { termNameToUrlParam, urlParamToTermName, findTermIdByName, findTermNameById } from '../utils/termUrlHelpers';
import { config } from '../config';
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
    termId,
    terms,
    setCollege,
    setType,
    setQuery,
    setDepartment,
    setSortOption,
    setTermId,
    displayMode,
    setDisplayMode
  } = useSearchStore();

  const fetchResults = useCourseStore((state) => state.fetchResults);
  const results = useCourseStore((state) => state.results);
  const error = useCourseStore((state) => state.error);
  const loading = useCourseStore((state) => state.loading);
  const currentCollege = useCustomizationStore((state) => state.currentCollege);
  const collegeParam = new URLSearchParams(location.search).get('college') || currentCollege || 'all';
  
  // State for item search results
  const [itemResults, setItemResults] = useState([]);
  const [itemLoading, setItemLoading] = useState(false);
  const [itemError, setItemError] = useState(null);
  
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
    const termUrlParam = queryParams.get('term') || '';

    // Convert URL term parameter back to term name, then find the term ID
    const termName = urlParamToTermName(termUrlParam);
    const resolvedTermId = termName ? findTermIdByName(terms, termName) : null;

    // Update store if parameters have changed
    if (collegeParam !== college) setCollege(collegeParam);
    if (typeParam !== type) setType(typeParam);
    if (queryParam !== query) setQuery(queryParam);
    if (departmentParam !== department) setDepartment(departmentParam);
    if (sortParam !== sortOption) setSortOption(sortParam);
    if (displayModeParam !== displayMode) setDisplayMode(displayModeParam); // Update store
    
    // Only update termId if we have a valid term from URL or if clearing it
    if (termUrlParam && resolvedTermId && resolvedTermId !== termId) {
      setTermId(resolvedTermId);
    } else if (!termUrlParam && termId) {
      // Clear termId if no term in URL but one is set in store
      setTermId(null);
    }


    setIsInitialized(true);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, terms]); // Added terms to dependencies for term resolution

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

    // Convert term ID to term name for URL
    if (termId && termId.trim() !== '') {
      const termName = findTermNameById(terms, termId);
      if (termName) {
        const urlParam = termNameToUrlParam(termName);
        queryParams.set('term', urlParam);
      }
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
  }, [college, type, query, department, sortOption, displayMode, termId]);

  // Build the query using the updated buildQuery function that can handle department and sort
  const cqlQuery = useBuildQuery(college, type, query, department, sortOption, termId);

  // Fetch item search results when type is 'item'
  useEffect(() => {
    if (!isInitialized || type !== 'item') return;
    
    // Don't search if query is empty - prevent searching all items
    if (!query || query.trim() === '') {
      setItemResults([]);
      setItemLoading(false);
      setItemError(null);
      return;
    }
    
    const fetchItemResults = async () => {
      setItemLoading(true);
      setItemError(null);
      
      try {
        const ITEM_SEARCH_URL = `${config.api.urls.folio}${config.api.endpoints.folioSearch.reservesWithCourses}`;
        
        // Get college prefix for URL parameter
        const getCollegePrefix = (collegeKey) => {
          switch (collegeKey && collegeKey.toLowerCase()) {
            case 'smith': return 'SC';
            case 'hampshire': return 'HC';
            case 'mtholyoke':
            case 'mt.holyoke': return 'MH';
            case 'amherst': return 'AC';
            case 'umass': return 'UM';
            default: return null;
          }
        };
        
        const collegePrefix = getCollegePrefix(college);
        
        // Build URL with college parameter and query parameter for print resources
        let url = `${ITEM_SEARCH_URL}?`;
        if (collegePrefix) {
          url += `college=${collegePrefix}&`;
        }
        url += `query=${encodeURIComponent(cqlQuery)}`;
        
        // Fetch print resources
        const printResponse = await fetch(url);
        
        if (!printResponse.ok) {
          throw new Error(`HTTP error! status: ${printResponse.status}`);
        }
        
        const printResult = await printResponse.json();
        const printReserves = printResult?.data?.reserves || [];
        
        // Normalize to array (should already be an array in the new structure)
        const normalizedPrintReserves = Array.isArray(printReserves) ? printReserves : [printReserves];
        
        // For Smith College, also fetch electronic resources
        let electronicReserves = [];
        if (college === 'smith' && termId) {
          try {
            const ELECTRONIC_SEARCH_URL = `${config.api.urls.courseReserves}/resource/search`;
            const electronicUrl = `${ELECTRONIC_SEARCH_URL}?name=${encodeURIComponent(query)}&term_id=${termId}`;
            
            const electronicResponse = await fetch(electronicUrl);
            
            if (electronicResponse.ok) {
              const electronicResult = await electronicResponse.json();
              // The API returns reserves array, not resources
              const reserves = electronicResult?.data?.reserves || [];
              
              // Mark electronic resources for identification
              electronicReserves = reserves.map(reserve => ({
                ...reserve,
                isElectronic: true
              }));
              
              console.log('Electronic reserves found:', electronicReserves.length);
            }
          } catch (electronicError) {
            console.warn('Error fetching electronic resources:', electronicError);
            // Continue with just print resources if electronic search fails
          }
        }
        
        // Merge print and electronic results
        const mergedResults = [...normalizedPrintReserves, ...electronicReserves];
        
        console.log('Total merged results:', mergedResults.length, '(Print:', normalizedPrintReserves.length, ', Electronic:', electronicReserves.length, ')');
        
        setItemResults(mergedResults);
        setItemLoading(false);
      } catch (error) {
        console.error('Error fetching item results:', error);
        setItemError(error.message);
        setItemLoading(false);
      }
    };
    
    fetchItemResults();
  }, [cqlQuery, isInitialized, type, college, query, termId]);

  useEffect(() => {
    if (!isInitialized || type === 'item') return; // Skip course fetch if searching for items
    
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

  // Build descriptive heading with search parameters
  const buildHeading = () => {
    const parts = [];
    
    // Add college name
    parts.push(getCollegeName());
    
    // Add type (Reserve Items or Course Reserves)
    if (type === 'item') {
      parts.push('Reserve Items');
    } else {
      parts.push('Course Reserves');
    }
    
    // Add term if specified
    if (termId) {
      const termName = findTermNameById(terms, termId);
      if (termName) {
        parts.push(`- ${termName}`);
      }
    }
    
    // Add department if specified
    if (department && department.trim() !== '') {
      parts.push(`- ${department}`);
    }
    
    // Add search query if specified
    if (query && query.trim() !== '') {
      const searchType = type === 'item' ? 'Item' : 
                        type === 'name' ? 'Course Name' : 
                        type === 'code' ? 'Course Code' : 
                        type === 'section' ? 'Section' : 
                        type === 'instructor' ? 'Instructor' : 'All Fields';
      parts.push(`- ${searchType}: "${query}"`);
    }
    
    return parts.join(' ');
  };

  return (
    <Container fluid>
      {/* Page heading with search context */}
      <h1 className="h4 mb-3 mt-2">
        {buildHeading()}
      </h1>
      
      {/* Show error for course searches */}
      {error && type !== 'item' && (
        <Alert color="danger" className="mt-3">
          Error loading courses: {error.message}
        </Alert>
      )}
      
      {/* Show error for item searches */}
      {itemError && type === 'item' && (
        <Alert color="danger" className="mt-3">
          Error loading items: {itemError}
        </Alert>
      )}
      
      {/* Conditionally render based on search type */}
      {type === 'item' ? (
        <>
          {!query || query.trim() === '' ? (
            <Alert color="info" className="mt-3">
              <h5>Search for Reserve Items</h5>
              <p className="mb-0">Please enter a search term to find items on reserve for courses.</p>
            </Alert>
          ) : (
            <ItemSearchResults 
              reserves={itemResults} 
              loading={itemLoading}
              error={itemError}
            />
          )}
        </>
      ) : (
        <CourseList 
          courses={results} 
          isLoading={loading}
        />
      )}
    </Container>
  );
}

export default Search;
