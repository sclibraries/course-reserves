import { useState, useEffect } from 'react';
import {
  Collapse,
  NavbarToggler,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  Row,
  Col,
  ButtonGroup,
} from 'reactstrap';
import useSearchStore from '../store/searchStore';
import { useNavigate } from 'react-router-dom';
import useCustomizationStore from '../store/customizationStore';
import '../Searchbar.css';

// IMPORTANT: Ensure Font Awesome is loaded in your project,
// for example by including: import 'font-awesome/css/font-awesome.min.css';

function Searchbar() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false); // State for collapse

  // Destructure search store values and setter functions
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

  // Get custom button colors from the customization store
  const { searchButtonBgColor, resetButtonBgColor, location } = useCustomizationStore(
    (state) => state.getCustomizationForCollege(college)
  );

  // Local states for dropdowns and input field
  const [searchArea, setSearchArea] = useState('All fields');
  const [searchInput, setSearchInput] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('All Colleges');
  const [departments, setDepartments] = useState([]);

  // Arrays for select options
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

  // Sync local state with store whenever these values change
  useEffect(() => {
    setSearchArea(keyToSearchArea(type));
    setSearchInput(query || '');
    setSelectedCollege(keyToCollegeName(college));
  }, [type, query, college, department, sortOption]);

  // Fetch departments when the selected college changes
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
          // Check for network errors
          throw new Error('Network response was not ok');
        }
        return res.json();
      })
      .then((data) => {
        // Ensure the API response structure is as expected
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

  // Handle search button click or "Enter" key press
  const handleSearch = () => {
    const areaKey = searchAreaToKey(searchArea);
    const collegeKey = collegeNameToKey(selectedCollege);
    const sanitizedInput = searchInput.trim();

    // Update the store
    setType(areaKey);
    setCollege(collegeKey);
    setQuery(sanitizedInput);

    // Build URL parameters
    const queryParams = new URLSearchParams();
    if (collegeKey && collegeKey !== 'all') queryParams.set('college', collegeKey);
    if (areaKey && areaKey !== 'all') queryParams.set('type', areaKey);
    if (sanitizedInput) queryParams.set('query', sanitizedInput);
    if (department && department.trim() !== '') queryParams.set('department', department);
    if (sortOption && sortOption.trim() !== '') queryParams.set('sort', sortOption);

    navigate(`/search?${queryParams.toString()}`);
  };

  // Reset the search inputs and store values
  const handleReset = () => {
    // Reset store values
    setType('all');
    setQuery('');
    setDepartment('');
    setSortOption('');

    // Reset local state values
    setSearchArea('All fields');
    setSearchInput('');
    if (college) {
      navigate('/search?college=' + college);
    } else {
      navigate('/search');
    }
  };

  // Map display search area to key used in store and URL params
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

  // Map key to display value for search area
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

  // Convert college name from dropdown to key used in store and API calls
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

  // Map key to college display name
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

  // Get query string prefix for department fetch based on college key
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
        return ''; // No query for all colleges (fetch all)
    }
  };

  // Handle term change
  const handleTermChange = (e) => {
    if (e.target.value !== termId) {
      setTermId(e.target.value);
    }
  };

  // Toggle the navbar collapse state
  const toggle = () => setIsOpen(!isOpen);

  return (
    <div className="searchbar-container" role="search">
      {/* NavbarToggler for the hamburger icon */}
      <NavbarToggler
        onClick={toggle}
        className="searchbar-toggle"
        aria-label="Toggle search options"
        aria-expanded={isOpen}
        aria-controls="search-collapse"
      />

      {/* Collapsible content */}
      <Collapse 
          id="search-collapse"
          isOpen={isOpen} 
          className={isOpen ? 'searchbar-expanded' : 'searchbar-collapsed'}
        >

        <Form>
          <Row>
            {/* College Select */}
            <Col className="mb-2">
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
            <Col className="mb-1">
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
                  onChange={(e) => setDepartment(e.target.value)}
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
            <Col className="mb-2">
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
            <Col className="mb-2">
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
            <Col className="mb-2">
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
                  aria-placeholder='Enter keyword'
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
            <Col className="mb-2">
              {/* Flex container with no wrap to keep buttons in one line */}
              <div className="d-flex justify-content-end flex-nowrap">
                <ButtonGroup>
                <Button
                  color="primary"
                  onClick={handleSearch}
                  style={{
                    backgroundColor: searchButtonBgColor || '#007bff', 
                    color: location === 'hampshire' ? 'black' : 'white',
                  }}
                  aria-label="Search"
                  tabIndex="0"
                >
                  <i className="fas fa-search" role="button"></i>
                  <span className="d-none d-sm-inline ml-1">Search</span>
                </Button>

                <Button
                  color="secondary"
                  onClick={handleReset}
                  style={{
                    backgroundColor: resetButtonBgColor || '#6c757d', // Ensure contrast
                    color: '#ffffff',
                  }}
                  aria-label="Reset search filters"
                  tabIndex="0"
                >
                  <i className="fas fa-undo" role='button'></i>
                  <span className="d-none d-sm-inline ml-1">Reset</span>
                </Button>


                </ButtonGroup>
              </div>
            </Col>
          </Row>
        </Form>
      </Collapse>
    </div>
  );
}

export default Searchbar;
