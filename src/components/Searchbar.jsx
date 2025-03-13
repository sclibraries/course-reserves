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
import useSearchStore from '../store/searchStore';
import useCustomizationStore from '../store/customizationStore';
import { trackingService } from '../services/trackingService';
import { getTermName } from '../util/termHelpers';
import '../Searchbar.css';

function Searchbar() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

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

  const { searchButtonBgColor, resetButtonBgColor, campusLocation } =
    useCustomizationStore((state) => state.getCustomizationForCollege(college));

  const [searchArea, setSearchArea] = useState('All fields');
  const [searchInput, setSearchInput] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('All Colleges');
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
    'UMass',
  ];
  const sortingOptions = [
    { label: 'Name (A-Z)', value: 'name' },
    { label: 'Name (Z-A)', value: 'name.descending' },
    { label: 'Course Number (Asc)', value: 'courseNumber' },
    { label: 'Course Number (Desc)', value: 'courseNumber.descending' },
    { label: 'Section Name (Asc)', value: 'sectionName' },
    { label: 'Section Name (Desc)', value: 'sectionName.descending' },
  ];

  useEffect(() => {
    setSearchArea(keyToSearchArea(type));
    setSearchInput(query || '');
    setSelectedCollege(keyToCollegeName(college));
  }, [type, query, college, department, sortOption]);

  useEffect(() => {
    const collegeKey = college;
    const queryParam = getCollegeQuery(collegeKey);
    let url = 'https://libtools2.smith.edu/folio/web/search/search-departments';
    if (queryParam) {
      url += `?query=${encodeURIComponent(queryParam)}`;
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

  const toggle = () => setIsOpen(!isOpen);

  // Utility function conversions...
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
      case 'UMass':
        return 'umass';
      case 'All':
      default:
        return 'all';
    }
  };

  const keyToCollegeName = (key) => {
    switch (key) {
      case 'smith':
        return 'Smith College';
      case 'hampshire':
        return 'Hampshire College';
      case 'mtholyoke':
        return 'Mount Holyoke';
      case 'amherst':
        return 'Amherst College';
      case 'umass':
        return 'UMass';
      case 'all':
      default:
        return 'All';
    }
  };

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
                College
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
                  setDepartment('');
                  setSearchInput('');
                  setSearchArea('All fields');
                  setType('all');
                  setSortOption('');

                  navigate('/search?college=' + newCollegeKey);
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
    </div>
  );
}

export default Searchbar;
