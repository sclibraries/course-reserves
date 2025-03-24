
/**
 * @file Advanced search interface component
 * @module Searchbar
 * @description Provides a comprehensive search interface for course reserves with filters,
 * sorting, and tracking capabilities. Allows filtering by institution, department, search area, 
 * and term, with configurable appearance based on campus settings.
 * @requires react
 * @requires reactstrap
 * @requires react-router-dom
 * @requires ../../store/searchStore
 * @requires ../../store/customizationStore
 * @requires ../../services/trackingService
 * @requires ../../util/termHelpers
 * @requires ../../config
 */
import { useState, useEffect } from 'react';
import {
  Collapse,
  NavbarToggler,
  FormGroup,
  Label,
  Input,
  Button,
  Row,
  Col,
  ButtonGroup,
} from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import useSearchStore from '../../store/searchStore';
import useCustomizationStore from '../../store/customizationStore';
import { trackingService } from '../../services/trackingService';
import { getTermName } from '../../util/termHelpers';
import { config } from '../../config'
import '../../css/Searchbar.css';

/**
 * Search interface component for course reserves
 * 
 * Provides an expandable interface for searching and filtering course reserves with:
 * - Institution selection
 * - Department filtering
 * - Search area specification (All fields, Course Name, Course Code, etc.)
 * - Term selection
 * - Sort options
 * - Keyword search
 * 
 * Features:
 * - Responsive design with collapse/expand functionality
 * - Campus-specific styling
 * - Integration with tracking service
 * - URL-based state management
 * - Accessibility support
 * 
 * @component
 * @example
 * return (
 *   <Layout>
 *     <Searchbar />
 *     <SearchResults />
 *   </Layout>
 * )
 */

function Searchbar() {
  const navigate = useNavigate();

    /**
   * Collapse/expand state for responsive design
   * @type {boolean}
   */
  const [isOpen, setIsOpen] = useState(false);

    /**
   * Search state and actions from global store
   * @type {Object}
   */

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
    termId,
    setTermId,
    terms,
  } = useSearchStore();

   /**
   * Campus-specific customization settings
   * @type {Object}
   */
  const { searchButtonBgColor, resetButtonBgColor, campusLocation, additionalHeaderText } =
    useCustomizationStore((state) => state.getCustomizationForCollege(college));

  /**
   * Current search area selection
   * @type {string}
   */
  const [searchArea, setSearchArea] = useState('All fields');
    /**
   * Current search input value
   * @type {string}
   */
  const [searchInput, setSearchInput] = useState('');
    /**
   * Selected college display name
   * @type {string}
   */
  const [selectedCollege, setSelectedCollege] = useState('All Colleges');
    /**
   * Available departments for the current college
   * @type {Array<Object>}
   */
  const [departments, setDepartments] = useState([]);

  const searchAreas = [
    'All fields',
    'Course Name',
    'Course Code',
    'Section',
    'Instructor',
  ];
  const colleges = [
    'All',
    'Amherst College',
    'Hampshire College',
    'Mount Holyoke College',
    'Smith College',
    'UMass Amherst',
  ];
  const sortingOptions = [
    { label: 'Name (A-Z)', value: 'name' },
    { label: 'Name (Z-A)', value: 'name.descending' },
    { label: 'Course Number (Asc)', value: 'courseNumber' },
    { label: 'Course Number (Desc)', value: 'courseNumber.descending' },
    { label: 'Section Name (Asc)', value: 'sectionName' },
    { label: 'Section Name (Desc)', value: 'sectionName.descending' },
  ];

    /**
   * Synchronize component state with search store
   */
  useEffect(() => {
    setSearchArea(keyToSearchArea(type));
    setSearchInput(query || '');
    setSelectedCollege(keyToCollegeName(college));
  }, [type, query, college, department, sortOption]);

    /**
   * Fetch departments when college changes
   */

  useEffect(() => {
    setDepartments([]);
    if (!college || college === 'all') {
      console.log("Skipping department fetch for 'all' colleges");
      return;
    }
    const collegeKey = college;
    const queryParam = getCollegeQuery(collegeKey);
    if (!queryParam) {
      console.log("No valid query parameter for college:", college);
      return;
    }
    
    let url = `${config.api.urls.folio}${config.api.endpoints.folioSearch.departments}`;
    if (queryParam) {
      url += `?query=${encodeURIComponent(queryParam)}%20sortBy%20name/sort.ascending`;
    }

    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.data && Array.isArray(data.data.departments)) {
          setDepartments(data.data.departments);
        } else {
          setDepartments([]);
        }
      })
      .catch((error) => {
        console.error('Error fetching departments:', error);
        setDepartments([]);
      });
  }, [college]);

    /**
   * Execute search with current filters
   * @function
   * @returns {void}
   */
  const handleSearch = () => {
    const areaKey = searchAreaToKey(searchArea);
    const collegeKey = collegeNameToKey(selectedCollege);
    const sanitizedInput = searchInput.trim();
    const currentTermName = getTermName(terms, termId);

    // Track the search
    trackingService.trackEvent({
      event_type: "search",
      college: collegeKey,
      course_id: "N/A",
      term: currentTermName || "N/A",
      course_name: "",
      course_code: "",
      instructor: null,
      metadata: {
        searchArea,
        query: sanitizedInput,
        department,
        sortOption,
      }
    }).catch(err => console.error("Error tracking search event:", err));

    setType(areaKey);
    setCollege(collegeKey);
    setQuery(sanitizedInput);

    const queryParams = new URLSearchParams();
    if (collegeKey && collegeKey !== 'all') queryParams.set('college', collegeKey);
    if (areaKey && areaKey !== 'all') queryParams.set('type', areaKey);
    if (sanitizedInput) queryParams.set('query', sanitizedInput);
    if (department && department.trim() !== '') queryParams.set('department', department);
    if (sortOption && sortOption.trim() !== '') queryParams.set('sort', sortOption);

    navigate(`/search?${queryParams.toString()}`);
  };

  /**
   * Reset all search filters
   * @function
   * @returns {void}
   */
  const handleReset = () => {
    // Track the reset
    const currentTermName = getTermName(terms, termId);
    trackingService.trackEvent({
      event_type: "search_reset",
      college,
      course_id: "N/A",
      term: currentTermName || "N/A",
      course_name: "",
      course_code: "",
      instructor: null,
      metadata: {
        old_searchArea: searchArea,
        old_query: searchInput,
        old_department: department,
        old_sortOption: sortOption,
      }
    }).catch(err => console.error("Error tracking reset event:", err));

    setType('all');
    setQuery('');
    setDepartment('');
    setSortOption('');

    setSearchArea('All fields');
    setSearchInput('');
    if (college) {
      navigate('/search?college=' + college);
    } else {
      navigate('/search');
    }
  };

    /**
   * Handle term selection change
   * @function
   * @param {Event} e - Change event from select input
   * @returns {void}
   */
  const handleTermChange = (e) => {
    const newTermId = e.target.value;
    if (newTermId !== termId) {

      const newTermName = getTermName(terms, newTermId);
      const oldTermName = getTermName(terms, termId);
      // Track the term change
      trackingService.trackEvent({
        event_type: "term_change",
        college,
        course_id: "N/A",
        term: newTermName,
        course_name: "",
        course_code: "",
        instructor: null,
        metadata: {
          old_term: oldTermName || "N/A",
          new_term: newTermName || "N/A",
        }
      }).catch(err => console.error("Error tracking term change:", err));

      setTermId(newTermId);
    }
  };

    /**
   * Toggle searchbar expanded/collapsed state
   * @function
   * @returns {void}
   */
  const toggle = () => setIsOpen(!isOpen);

    /**
   * Convert search area display name to internal key
   * @function
   * @param {string} area - Display name of search area
   * @returns {string} Internal key value
   */
  const searchAreaToKey = (area) => {
    switch (area) {
      case 'All fields':
        return 'all';
      case 'Course Name':
        return 'name';
      case 'Course Code':
        return 'code';
      case 'Section':
        return 'section';
      case 'Instructor':
        return 'instructor';
      default:
        return 'all';
    }
  };

    /**
   * Convert internal key to search area display name
   * @function
   * @param {string} key - Internal key for search area
   * @returns {string} Display name
   */
  const keyToSearchArea = (key) => {
    switch (key) {
      case 'all':
        return 'All fields';
      case 'name':
        return 'Course Name';
      case 'code':
        return 'Course Code';
      case 'section':
        return 'Section';
      case 'instructor':
        return 'Instructor';
      default:
        return 'All fields';
    }
  };

    /**
   * Convert college display name to internal key
   * @function
   * @param {string} col - Display name of college
   * @returns {string} Internal key value
   */
  const collegeNameToKey = (col) => {
    switch (col) {
      case 'Smith College':
        return 'smith';
      case 'Hampshire College':
        return 'hampshire';
      case 'Mount Holyoke College':
        return 'mtholyoke';
      case 'Amherst College':
        return 'amherst';
      case 'UMass Amherst':
        return 'umass';
      case 'All':
      default:
        return 'all';
    }
  };

    /**
   * Convert internal key to college display name
   * @function
   * @param {string} key - Internal key for college
   * @returns {string} Display name
   */
  const keyToCollegeName = (key) => {
    switch (key) {
      case 'smith':
        return 'Smith College';
      case 'hampshire':
        return 'Hampshire College';
      case 'mtholyoke':
        return 'Mount Holyoke College';
      case 'amherst':
        return 'Amherst College';
      case 'umass':
        return 'UMass Amherst';
      case 'all':
      default:
        return 'All';
    }
  };

    /**
   * Get FOLIO API query parameter for college
   * @function
   * @param {string} collegeKey - Internal key for college
   * @returns {string} FOLIO API query string
   */

  const getCollegeQuery = (collegeKey) => {
    switch (collegeKey) {
      case 'smith':
        return 'name==sc*';
      case 'hampshire':
        return 'name==hc*';
      case 'mtholyoke':
        return 'name==mh*';
      case 'amherst':
        return 'name==ac*';
      case 'umass':
        return 'name==um*';
      default:
        return '';
    }
  };


  return (
    <div className="searchbar-container" role="search">
      <NavbarToggler
        onClick={toggle}
        className="searchbar-toggle"
        aria-label="Toggle search options"
        aria-expanded={isOpen}
        aria-controls="search-collapse"
      />

      <Collapse
        id="search-collapse"
        isOpen={isOpen}
        className={isOpen ? 'searchbar-expanded' : 'searchbar-collapsed'}
      >
        <Row>
          {/* College Select */}
          <Col xs="12" md className="mb-2">
            <FormGroup>
              <Label for="collegeSelect" className="mr-2" style={{ color: '#212529' }}>
                Institution
              </Label>
              <Input
                type="select"
                name="college"
                id="collegeSelect"
                role="combobox"
                value={selectedCollege}
                aria-expanded="false"
                aria-controls="college-options"
                onChange={(e) => {
                  const newCollege = e.target.value;
                  const newCollegeKey = collegeNameToKey(newCollege);
                  const currentTermName = getTermName(terms, termId);
                  // If you want to track college changes:
                  trackingService.trackEvent({
                    event_type: "college_change",
                    college: newCollegeKey,
                    course_id: "N/A",
                    term: currentTermName || "N/A",
                    course_name: "",
                    course_code: "",
                    instructor: null,
                    metadata: {
                      old_college_key: college,
                      new_college_key: newCollegeKey,
                    }
                  }).catch(err => console.error("Error tracking college change:", err));

                  // Reset all search parameters when college changes
                  setSelectedCollege(newCollege);
                  setCollege(newCollegeKey);
                  useCustomizationStore.getState().setCurrentCollege(newCollegeKey);
                  setDepartment('');
                  setSearchInput('');
                  setSearchArea('All fields');
                  setType('all');
                  setSortOption('');

                  const queryParams = new URLSearchParams(location.search);
                  queryParams.set('college', newCollegeKey);

                  navigate(`/search?${queryParams.toString()}`);
                }}
                aria-live="polite"
                aria-describedby="college-reset-warning"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.target.blur();
                  }
                }}
              >
                {colleges.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </Input>
              <small id="college-reset-warning" className="visually-hidden">
                Changing the college resets all search filters.
              </small>
            </FormGroup>
          </Col>

          {/* Department Select */}
          <Col xs="12" md className="mb-2">
            <FormGroup>
              <Label for="departmentSelect" className="mr-2" style={{ color: '#212529' }}>
                Department
              </Label>
              <Input
                type="select"
                name="department"
                id="departmentSelect"
                aria-live="polite"
                aria-expanded="false"
                aria-controls="department-options"
                aria-activedescendant={department ? `dept-${department}` : undefined}
                value={department}
                onChange={(e) => {
                  const newDept = e.target.value;
                  const currentTermName = getTermName(terms, termId);
                  // Track the department change
                  trackingService.trackEvent({
                    event_type: "department_change",
                    college,
                    course_id: "N/A",
                    term: currentTermName || "N/A",
                    course_name: "",
                    course_code: "",
                    instructor: null,
                    metadata: {
                      old_department: department || "none",
                      new_department: newDept,
                    },
                  }).catch(err => console.error("Error tracking department change:", err));

                  setDepartment(newDept);
                }}
                disabled={departments.length === 0}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.target.blur();
                  }
                }}
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </Input>
            </FormGroup>
          </Col>


          {/* Search Area Select */}
          <Col xs="12" md className="mb-2">
            <FormGroup>
              <Label for="searchAreaSelect" className="mr-2" style={{ color: '#212529' }}>
                Search Area
              </Label>
              <Input
                type="select"
                name="searchArea"
                id="searchAreaSelect"
                aria-expanded="false"
                aria-controls="searchArea-options"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.target.blur();
                  }
                }}
                value={searchArea}
                onChange={(e) => {
                  setSearchArea(e.target.value);
                  setType(searchAreaToKey(e.target.value));
                }}
              >
                {searchAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </Input>
            </FormGroup>
          </Col>

          {/* Term Select */}
          <Col xs="12" md className="mb-2">
            <FormGroup>
              <Label for="termSelect" className="mr-2" style={{ color: '#212529' }}>
                Term
              </Label>
              <Input
                type="select"
                name="term"
                id="termSelect"
                aria-expanded="false"
                aria-controls="term-options"
                value={termId || ''}
                onChange={handleTermChange}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.target.blur();
                  }
                }}
              >
                <option value="" disabled>
                  Select a term
                </option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </Input>
            </FormGroup>
          </Col>

          {/* Sort By Select */}
          <Col xs="12" md className="mb-2">
            <FormGroup>
              <Label for="sortSelect" className="mr-2" style={{ color: '#212529' }}>
                Sort By
              </Label>
              <Input
                type="select"
                name="sortOption"
                id="sortSelect"
                aria-expanded="false"
                aria-controls="sort-options"
                value={sortOption}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.target.blur();
                  }
                }}
                onChange={(e) => {
                  setSortOption(e.target.value);
                  // Optionally track the sorting action
                  trackingService.trackEvent({
                    event_type: "sort_change",
                    college: college,
                    course_id: "N/A",
                    term: termId || "N/A",
                    course_name: "",
                    course_code: "",
                    instructor: null,
                    metadata: {
                      new_sort: e.target.value,
                    }
                  }).catch(err => console.error("Error tracking sort change:", err));

                  handleSearch();
                }}
              >
                <option value="">Default</option>
                {sortingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Input>
            </FormGroup>
          </Col>

          {/* Search Input */}
          <Col className="mb-2">
            <FormGroup>
              <Label for="searchInput" id="searchInput-label" className="mr-2">
                Search
              </Label>
              <Input
                type="text"
                name="query"
                id="searchInput"
                placeholder="Enter keyword"
                aria-labelledby="searchInput-label"
                aria-placeholder="Enter keyword"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                style={{
                  color: '#000',
                  backgroundColor: '#ffffff',
                  borderColor: '#6c757d',
                }}
              />
            </FormGroup>
          </Col>

          {/* Button Group for Search and Reset */}
          <Col xs="12" md="auto" className="mb-2">
            <div className="d-flex justify-content-end">
              <ButtonGroup className="w-100 w-md-auto">
                <Button
                  color="primary"
                  onClick={handleSearch}
                  style={{
                    backgroundColor: searchButtonBgColor || '#007bff',
                    color: campusLocation === 'hampshire' ? 'black' : 'white',
                  }}
                  aria-label="Search"
                  tabIndex="0"
                >
                  <i className="fas fa-search" role="button"></i>
                  <span className="d-inline ml-1">Search</span>
                </Button>

                <Button
                  color="secondary"
                  onClick={handleReset}
                  style={{
                    backgroundColor: resetButtonBgColor || '#6c757d',
                    color: '#ffffff',
                  }}
                  aria-label="Reset search filters"
                  tabIndex="0"
                >
                  <i className="fas fa-undo" role="button"></i>
                  <span className="d-inline ml-1">Reset</span>
                </Button>
              </ButtonGroup>
            </div>
          </Col>
        </Row>
      </Collapse>
       <p dangerouslySetInnerHTML={{__html: additionalHeaderText}} />
    </div>
  );
}

export default Searchbar;
