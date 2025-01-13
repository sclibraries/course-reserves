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
} from 'reactstrap';
import useSearchStore from '../store/searchStore';
import { useNavigate } from 'react-router-dom';
import useCustomizationStore from '../store/customizationStore';
import '../Searchbar.css';

function Searchbar() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false); // State for collapse

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

  const {
    searchButtonBgColor,
    resetButtonBgColor,
  } = useCustomizationStore((state) =>
    state.getCustomizationForCollege(college)
  );

  // Local states for dropdowns
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
    'All Colleges',
    'Smith',
    'Hampshire',
    'MtHolyoke',
    'Amherst',
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
    // Sync local state with store
    setSearchArea(keyToSearchArea(type));
    setSearchInput(query || '');
    setSelectedCollege(keyToCollegeName(college));
  }, [type, query, college, department, sortOption]);

  // Fetch departments whenever the selected college changes
  useEffect(() => {
    const collegeKey = college;
    const queryParam = getCollegeQuery(collegeKey);
    let url =
      'https://libtools2.smith.edu/folio/web/search/search-departments';

    if (queryParam) {
      url += `?query=${encodeURIComponent(queryParam)}`;
    }
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        // Adjust parsing based on your actual API response structure.
        if (data && data.data && Array.isArray(data.data.departments)) {
          setDepartments(data.data.departments);
        } else {
          setDepartments([]);
        }
      })
      .catch(() => setDepartments([]));
  }, [college]);

  const handleSearch = () => {
    const areaKey = searchAreaToKey(searchArea);
    const collegeKey = collegeNameToKey(selectedCollege);
    const sanitizedInput = searchInput.trim();

    setType(areaKey);
    setCollege(collegeKey);
    setQuery(sanitizedInput);

    // Build URL params
    const queryParams = new URLSearchParams();
    if (collegeKey && collegeKey !== 'all')
      queryParams.set('college', collegeKey);
    if (areaKey && areaKey !== 'all') queryParams.set('type', areaKey);
    if (sanitizedInput) queryParams.set('query', sanitizedInput);
    if (department && department.trim() !== '')
      queryParams.set('department', department);
    if (sortOption && sortOption.trim() !== '')
      queryParams.set('sort', sortOption);

    navigate(`/search?${queryParams.toString()}`);
  };

  const handleReset = () => {
    // Reset the store
    setType('all');
    setQuery('');
    setDepartment('');
    setSortOption('');

    // Reset local states
    setSearchArea('All fields');
    setSearchInput('');
    setDepartments([]);

    // Navigate back to the base search page
    navigate('/search');
  };

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
      case 'Smith':
        return 'smith';
      case 'Hampshire':
        return 'hampshire';
      case 'MtHolyoke':
        return 'mtholyoke';
      case 'Amherst':
        return 'amherst';
      case 'UMass':
        return 'umass';
      case 'All Colleges':
      default:
        return 'all';
    }
  };

  const keyToCollegeName = (key) => {
    switch (key) {
      case 'smith':
        return 'Smith';
      case 'hampshire':
        return 'Hampshire';
      case 'mtholyoke':
        return 'MtHolyoke';
      case 'amherst':
        return 'Amherst';
      case 'umass':
        return 'UMass';
      case 'all':
      default:
        return 'All Colleges';
    }
  };

  const getCollegeQuery = (collegeKey) => {
    // Returns the department query prefix based on selected college
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
        return ''; // no query for all colleges (fetch all)
    }
  };

  const toggle = () => setIsOpen(!isOpen);

  return (
    <div className="searchbar-container">
      {/* NavbarToggler for the hamburger icon */}
      <NavbarToggler
        onClick={toggle}
        className="searchbar-toggle"
      />

      {/* Collapsible content */}
      <Collapse isOpen={isOpen} className={isOpen ? 'searchbar-expanded' : 'searchbar-collapsed'}>
        <Form>
          <Row>
            <Col md={2} className="mb-2">
              <FormGroup>
                <Label for="collegeSelect" className="mr-2">
                  College
                </Label>
                <Input
                  type="select"
                  name="college"
                  id="collegeSelect"
                  value={selectedCollege}
                  onChange={(e) => {
                    setSelectedCollege(e.target.value);
                    setCollege(collegeNameToKey(e.target.value));
                  }}
                >
                  {colleges.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </Input>
              </FormGroup>
            </Col>
            <Col md={2} className="mb-2">
              <FormGroup>
                <Label for="departmentSelect" className="mr-2">
                  Department
                </Label>
                <Input
                  type="select"
                  name="department"
                  id="departmentSelect"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  disabled={departments.length === 0}
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
            <Col md={2} className="mb-2">
              <FormGroup>
                <Label for="searchAreaSelect" className="mr-2">
                  Search Area
                </Label>
                <Input
                  type="select"
                  name="searchArea"
                  id="searchAreaSelect"
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
            <Col md={2} className="mb-2">
              <FormGroup>
                <Label for="sortSelect" className="mr-2">
                  Sort By
                </Label>
                <Input
                  type="select"
                  name="sortOption"
                  id="sortSelect"
                  value={sortOption}
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
            <Col md={2} className="mb-2">
              <FormGroup>
                <Label for="searchInput" className="mr-2">
                  Search
                </Label>
                <Input
                  type="text"
                  name="query"
                  id="searchInput"
                  placeholder="Enter keyword"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter') {
                      e.preventDefault(); 
                      handleSearch();
                    }
                  }}
                />
              </FormGroup>
            </Col>
            <Col md={2} className="align-items-end">
              <Button
                color="primary"
                onClick={handleSearch}
                style={{ backgroundColor: searchButtonBgColor }}
                className="mr-2"
              >
                Search
              </Button>{' '}
              <Button
                color="secondary"
                onClick={handleReset}
                style={{ backgroundColor: resetButtonBgColor }}
              >
                Reset
              </Button>
            </Col>
          </Row>
        </Form>
      </Collapse>
    </div>
  );
}

export default Searchbar;