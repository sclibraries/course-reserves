import { useState, useEffect } from 'react';
import {
  Form, FormGroup, Label, Input, Button, Row, Col
} from 'reactstrap';
import useSearchStore from '../store/searchStore';
import { useNavigate } from 'react-router-dom';
import '../Searchbar.css';


function Searchbar() {
  const navigate = useNavigate();

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

  // Local states for dropdowns
  const [searchArea, setSearchArea] = useState('All fields');
  const [searchInput, setSearchInput] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('All Colleges');
  const [departments, setDepartments] = useState([]);

  const searchAreas = ['All fields', 'Course Name', 'Course Code', 'Section', 'Instructor'];
  const colleges = ['All Colleges', 'Smith', 'Hampshire', 'MtHolyoke', 'Amherst', 'UMass'];
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
    let url = 'https://libtools2.smith.edu/folio/web/search/search-departments';

    if (queryParam) {
      url += `?query=${encodeURIComponent(queryParam)}`;
    }
    fetch(url)
      .then(res => res.json())
      .then(data => {
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
    if (collegeKey && collegeKey !== 'all') queryParams.set('college', collegeKey);
    if (areaKey && areaKey !== 'all') queryParams.set('type', areaKey);
    if (sanitizedInput) queryParams.set('query', sanitizedInput);
    if (department && department.trim() !== '') queryParams.set('department', department);
    if (sortOption && sortOption.trim() !== '') queryParams.set('sort', sortOption);

    navigate(`/search?${queryParams.toString()}`);
  };

  const handleReset = () => {
    // Reset the store
    setCollege('all');
    setType('all');
    setQuery('');
    setDepartment('');
    setSortOption('');

    // Reset local states
    setSearchArea('All fields');
    setSearchInput('');
    setSelectedCollege('All Colleges');
    setDepartments([]);

    // Navigate back to the base search page
    navigate('/search');
  };

  const searchAreaToKey = (area) => {
    switch (area) {
      case 'All fields': return 'all';
      case 'Course Name': return 'name';
      case 'Course Code': return 'code';
      case 'Section': return 'section';
      case 'Instructor': return 'instructor';
      default: return 'all';
    }
  };

  const keyToSearchArea = (key) => {
    switch (key) {
      case 'all': return 'All fields';
      case 'name': return 'Course Name';
      case 'code': return 'Course Code';
      case 'section': return 'Section';
      case 'instructor': return 'Instructor';
      default: return 'All fields';
    }
  };

  const collegeNameToKey = (col) => {
    switch (col) {
      case 'Smith': return 'smith';
      case 'Hampshire': return 'hampshire';
      case 'MtHolyoke': return 'mtholyoke';
      case 'Amherst': return 'amherst';
      case 'UMass': return 'umass';
      case 'All Colleges':
      default: return 'all';
    }
  };

  const keyToCollegeName = (key) => {
    switch (key) {
      case 'smith': return 'Smith';
      case 'hampshire': return 'Hampshire';
      case 'mtholyoke': return 'MtHolyoke';
      case 'amherst': return 'Amherst';
      case 'umass': return 'UMass';
      case 'all':
      default: return 'All Colleges';
    }
  };

  const getCollegeQuery = (collegeKey) => {
    // Returns the department query prefix based on selected college
    switch (collegeKey) {
      case 'smith': return 'name==sc*';
      case 'hampshire': return 'name==hc*';
      case 'mtholyoke': return 'name==mh*';
      case 'amherst': return 'name==ac*';
      case 'umass': return 'name==um*';
      default: return ''; // no query for all colleges (fetch all)
    }
  };

  return (
    <div className="searchbar-container p-3 border-bottom">
      <Form>
        <Row form>
          {/* College Dropdown */}
          <Col md={2}>
            <FormGroup>
              <Label for="collegeSelect">College</Label>
              <Input
                type="select"
                id="collegeSelect"
                value={selectedCollege}
                onChange={(e) => {
                  setSelectedCollege(e.target.value);
                  setCollege(collegeNameToKey(e.target.value));
                }}
              >
                {colleges.map((col) => (
                  <option key={col}>{col}</option>
                ))}
              </Input>
            </FormGroup>
          </Col>

          {/* Department Dropdown */}
          <Col md={2}>
            <FormGroup>
              <Label for="departmentSelect">Department</Label>
              <Input
                type="select"
                id="departmentSelect"
                value={department || ''}
                disabled={departments.length === 0}
                onChange={(e) => {
                  setDepartment(e.target.value);
                }}
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>{dept.name}</option>
                ))}
              </Input>
            </FormGroup>
          </Col>
          {/* Search Area Dropdown */}
          <Col md={2}>
            <FormGroup>
              <Label for="searchAreaSelect">Search Area</Label>
              <Input
                type="select"
                id="searchAreaSelect"
                value={searchArea}
                onChange={(e) => {
                  setSearchArea(e.target.value);
                  setType(searchAreaToKey(e.target.value));
                }}
              >
                {searchAreas.map((area) => (
                  <option key={area}>{area}</option>
                ))}
              </Input>
            </FormGroup>
          </Col>
                
          {/* Sorting Dropdown */}
          <Col md={2}>
            <FormGroup>
              <Label for="sortSelect">Sort By</Label>
              <Input
                type="select"
                id="sortSelect"
                value={sortOption || ''}
                onChange={(e) => {
                  setSortOption(e.target.value);
                  handleSearch(); // Trigger search immediately after changing sort option
                }}
              >
                <option value="">Default</option>
                {sortingOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Input>
            </FormGroup>
          </Col>

          {/* Search Input */}
          <Col md={2}>
            <FormGroup>
              <Label for="searchInput">Search</Label>
              <Input
                type="text"
                id="searchInput"
                placeholder="Enter a keyword..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter') handleSearch(); }}
              />
            </FormGroup>
          </Col>

          {/* Buttons */}
          <Col md={2} className="align-items-end">
            <Button color="primary" onClick={handleSearch}>Search</Button>
            <Button color="secondary" className="ms-2" onClick={handleReset}>Reset</Button>
          </Col>
        </Row>
      </Form>
    </div>
  );
}

export default Searchbar;