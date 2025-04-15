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
import useSearchStore from '../../store/searchStore';
import { useAuth } from '../../contexts/AuthContext';
import '../../css/Admin.css';

function HorizontalAdminSidebar() {
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

  const {
    termId,
    setTermId,
    terms,
  } = useSearchStore();

  const {
    searchButtonBgColor,
    resetButtonBgColor,
  } = useCustomizationStore((state) =>
    state.getCustomizationForCollege(college)
  );
  
  // Get user info and permissions from auth context
  const { user, isAdmin } = useAuth();

  // Local states for dropdowns
  const [searchArea, setSearchArea] = useState('All fields');
  const [searchInput, setSearchInput] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('All Colleges');
  const [departments, setDepartments] = useState([]);
  const [selectedSort, setSelectedSort] = useState('name');
  const [availableColleges, setAvailableColleges] = useState(['All Colleges']);

  const searchAreas = [
    'All fields',
    'Course Name',
    'Course Code',
    'Section',
    'Instructor',
  ];
  
  const allColleges = [
    'All Colleges',
    'Smith',
    'Hampshire',
    'MtHolyoke',
    'Amherst',
    'UMass',
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

  // Map full institution names to college keys
  const institutionToCollegeKey = {
    'Smith College': 'smith',
    'Hampshire College': 'hampshire',
    'Mount Holyoke College': 'mtholyoke',
    'Amherst College': 'amherst',
    'UMass Amherst': 'umass'
  };

  // Map institution names to UI college names
  const institutionToCollegeName = {
    'Smith College': 'Smith',
    'Hampshire College': 'Hampshire',
    'Mount Holyoke College': 'MtHolyoke',
    'Amherst College': 'Amherst',
    'UMass Amherst': 'UMass'
  };

  // Set available colleges based on user permissions
  useEffect(() => {
    if (!user) return;
    
    // Admin users can see all colleges
    if (isAdmin) {
      setAvailableColleges(allColleges);
      return;
    }
    
    // Regular users can only see their own institution
    if (user.institution) {
      const userCollegeKey = institutionToCollegeKey[user.institution];
      const userCollegeName = institutionToCollegeName[user.institution];
      
      if (userCollegeKey && userCollegeName) {
        // If user's institution maps to a valid college, use that
        setAvailableColleges(['All Colleges', userCollegeName]);
        
        // If no college is selected yet, set it to user's college
        if (college === 'all' || !college) {
          setCollege(userCollegeKey);
          setSelectedCollege(userCollegeName);
        }
      } else {
        // Fallback if we can't map the institution
        setAvailableColleges(['All Colleges']);
      }
    }
  }, [user, isAdmin]);

  useEffect(() => {
    // Sync local state with store
    setSearchArea(keyToSearchArea(type));
    setSearchInput(query || '');
    setSelectedCollege(keyToCollegeName(college));
    setSelectedSort(sort || 'name');
  }, [type, query, college, department, termId, sort]);

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
    const collegeKey = collegeNameToKey(selectedCollege);
    const sanitizedInput = searchInput.trim();

    setType(areaKey);
    setCollege(collegeKey);
    setQuery(sanitizedInput);
    setSort(selectedSort);
  };

  const handleReset = () => {
    setSearchArea('All fields');
    setSearchInput('');
    setSelectedSort('name');
    setType('all');
    setQuery('');
    
    // Reset college to user's college if they're not an admin
    if (!isAdmin && user?.institution) {
      const userCollegeKey = institutionToCollegeKey[user.institution];
      const userCollegeName = institutionToCollegeName[user.institution];
      
      if (userCollegeKey && userCollegeName) {
        setCollege(userCollegeKey);
        setSelectedCollege(userCollegeName);
      } else {
        setCollege('all');
        setSelectedCollege('All Colleges');
      }
    } else {
      setCollege('all');
      setSelectedCollege('All Colleges');
    }
    
    setDepartment('');
    setSort('name');
    setTermId(null);
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
                  setSelectedCollege(e.target.value);
                  setCollege(collegeNameToKey(e.target.value));
                }}
                className="filter-select"
                disabled={availableColleges.length <= 2 && !isAdmin} // Disable if user only has access to one college
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