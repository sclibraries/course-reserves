import { useState, useEffect } from 'react';
import {
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  InputGroup,
} from 'reactstrap';
import { FaSearch, FaRedo } from 'react-icons/fa';
import useAdminSearchStore from '../../store/adminSearchStore';
import useCustomizationStore from '../../store/customizationStore';
import useCollegeManagement from '../../hooks/useCollegeManagement';
import '../../css/Admin.css';

function HorizontalAdminSidebar() {
  const {
    college,
    type,
    query,
    department,
    sort,
    termId,
    terms,
    setCollege,
    setType,
    setQuery,
    setDepartment,
    setSort,
    setTermId,
    fetchTerms,
  } = useAdminSearchStore();

  // Use the centralized college management hook
  const {
    selectedCollege,
    availableColleges,
    handleCollegeChange,
    isCollegeDisabled
  } = useCollegeManagement(college, setCollege); // Pass setCollege to sync with store


  const {
    searchButtonBgColor,
    resetButtonBgColor,
  } = useCustomizationStore((state) =>
    state.getCustomizationForCollege(college)
  );
  
  // Local states for dropdowns
  const [searchArea, setSearchArea] = useState('All fields');
  const [searchInput, setSearchInput] = useState('');
  const [departments, setDepartments] = useState([]);
  const [selectedSort, setSelectedSort] = useState('name');

  const searchAreas = [
    'All fields',
    'Course Name',
    'Course Code',
    'Section',
    'Instructor',
  ];

  const sortOptions = [
    { label: 'Course Name (A-Z)', value: 'name' },
    { label: 'Course Name (Z-A)', value: 'name.desc' },
    { label: 'Course Number (Asc)', value: 'courseNumber' },
    { label: 'Course Number (Desc)', value: 'courseNumber.desc' },
    { label: 'Department (A-Z)', value: 'department' },
    { label: 'Department (Z-A)', value: 'department.desc' },
    { label: 'Term (Recent First)', value: 'term.desc' },
    { label: 'Term (Oldest First)', value: 'term' },
  ];

  useEffect(() => {
    // Sync local state with store
    setSearchArea(keyToSearchArea(type));
    setSearchInput(query || '');
    setSelectedSort(sort || 'name');
  }, [type, query, college, department, termId, sort]);

  // Fetch terms on mount if not already available
  useEffect(() => {
    if (terms.length === 0) {
      fetchTerms();
    }
  }, [fetchTerms, terms.length]);

  // Fetch departments whenever the selected college changes
  useEffect(() => {
    const collegeKey = college;
    const queryParam = getCollegeQuery(collegeKey);
    let url = 'https://libtools2.smith.edu/folio/web/search/search-departments';

    if (queryParam) {
      url += `?query=${encodeURIComponent(queryParam)}`;
    }
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
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
    const sanitizedInput = searchInput.trim();

    setType(areaKey);
    setQuery(sanitizedInput);
    setSort(selectedSort);
    // College is already managed by the hook and synced with the store
  };

  const handleReset = () => {
    setSearchArea('All fields');
    setSearchInput('');
    setSelectedSort('name');
    setType('all');
    setQuery('');
    
    // Do NOT reset college - preserve user's college selection
    // resetCollege(); // Commented out to preserve college selection
    
    setDepartment('');
    setSort('name');
    
    // Do NOT reset term - preserve user's term selection  
    // setTermId(null); // Commented out to preserve term selection
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

  const getCollegeQuery = (collegeKey) => {
    switch (collegeKey) {
      case 'smith': return 'name==sc*';
      case 'hampshire': return 'name==hc*';
      case 'mtholyoke': return 'name==mh*';
      case 'amherst': return 'name==ac*';
      case 'umass': return 'name==um*';
      default: return '';
    }
  };

  const handleTermChange = (e) => {
    const newTermId = e.target.value === '' ? null : e.target.value;
    setTermId(newTermId);
  };

  return (
    <div className="horizontal-admin-sidebar mb-4">
      <div className="admin-filter-panel">
        <Form onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}>
          <div className="filter-controls-row">
            {/* Search Input */}
            <FormGroup className="filter-item search-field">
              <Label for="searchInput" className="filter-label">Search</Label>
              <InputGroup>
                <Input
                  id="searchInput"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search courses..."
                  className="filter-input"
                />
              </InputGroup>
            </FormGroup>

            {/* College Filter - Only show options user has access to */}
            <FormGroup className="filter-item">
              <Label for="collegeSelect" className="filter-label">College</Label>
              <Input
                id="collegeSelect"
                type="select"
                value={selectedCollege}
                onChange={(e) => {
                  handleCollegeChange(e.target.value);
                }}
                className="filter-select"
                disabled={isCollegeDisabled}
              >
                {availableColleges.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </Input>
            </FormGroup>

            {/* Department Filter */}
            <FormGroup className="filter-item">
              <Label for="departmentSelect" className="filter-label">Department</Label>
              <Input
                id="departmentSelect"
                type="select"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={departments.length === 0}
                className="filter-select"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>{dept.name}</option>
                ))}
              </Input>
            </FormGroup>

            {/* Term Filter */}
            <FormGroup className="filter-item">
              <Label for="termSelect" className="filter-label">Term</Label>
              <Input
                id="termSelect"
                type="select"
                value={termId || ''}
                onChange={(e) => handleTermChange(e)}
                className="filter-select"
              >
                <option value="">All Terms</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>{term.name}</option>
                ))}
              </Input>
            </FormGroup>

            {/* Search Area Filter */}
            <FormGroup className="filter-item">
              <Label for="searchArea" className="filter-label">Search In</Label>
              <Input
                id="searchArea"
                type="select"
                value={searchArea}
                onChange={(e) => {
                  setSearchArea(e.target.value);
                  setType(searchAreaToKey(e.target.value));
                }}
                className="filter-select"
              >
                {searchAreas.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </Input>
            </FormGroup>

            {/* Sort Option */}
            <FormGroup className="filter-item">
              <Label for="sortOption" className="filter-label">Sort By</Label>
              <Input
                id="sortOption"
                type="select"
                value={selectedSort}
                onChange={(e) => {
                  setSelectedSort(e.target.value);
                  setSort(e.target.value);
                }}
                className="filter-select"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Input>
            </FormGroup>

            {/* Action Buttons */}
            <div className="filter-buttons">
              <Label className="filter-label d-block">&nbsp;</Label>
              <div className="button-group">
                <Button
                  color="primary"
                  onClick={handleSearch}
                  style={{ backgroundColor: searchButtonBgColor || '#4f46e5' }}
                  className="action-button search-button"
                  type="submit"
                >
                  <FaSearch className="button-icon" /> Search
                </Button>
                <Button
                  color="secondary"
                  onClick={handleReset}
                  style={{ backgroundColor: resetButtonBgColor || '#6c757d' }}
                  className="action-button reset-button"
                  type="button"
                >
                  <FaRedo className="button-icon" />
                </Button>
              </div>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}

export default HorizontalAdminSidebar;