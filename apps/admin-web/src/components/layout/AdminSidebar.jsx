import { useState, useEffect } from 'react';
import {
  Collapse,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  NavbarToggler,
} from 'reactstrap';
import useAdminSearchStore from '../../store/adminSearchStore';
import useCustomizationStore from '../../store/customizationStore';
import '../../css/Searchbar.css';
import useSearchStore from '../../store/searchStore';

function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(true); 

  const {
    college,
    type,
    query,
    department,
    setCollege,
    setType,
    setQuery,
    setDepartment
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
  // const sortingOptions = [
  //   { label: 'Name (A-Z)', value: 'name' },
  //   { label: 'Name (Z-A)', value: 'name.descending' },
  //   { label: 'Course Number (Asc)', value: 'courseNumber' },
  //   { label: 'Course Number (Desc)', value: 'courseNumber.descending' },
  //   { label: 'Section Name (Asc)', value: 'sectionName' },
  //   { label: 'Section Name (Desc)', value: 'sectionName.descending' },
  // ];

  useEffect(() => {
    // Sync local state with store
      setSearchArea(keyToSearchArea(type));
      setSearchInput(query || '');
      setSelectedCollege(keyToCollegeName(college));
  }, [type, query, college, department, termId]);

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

  };

  const handleReset = () => {
    // Reset local state
    setSearchArea('All fields');
    setSearchInput('');
    
    // Reset store state
    setType('all');
    setQuery('');
    setCollege('smith');
    setDepartment('');
    
    // Reset termId to null (for "All Terms")
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

  const handleTermChange = (e) => {
    // Convert empty string to null for "All Terms"
    const newTermId = e.target.value === '' ? null : e.target.value;
    console.log("Term changed to:", newTermId === null ? "All Terms" : newTermId);
    setTermId(newTermId);
  };

  return (
    <div className="admin-sidebar bg-light p-3 h-100">
      <NavbarToggler
        onClick={() => setIsOpen(!isOpen)}
        className="d-lg-none"
      />
      <Collapse isOpen={isOpen} navbar>
      <div className="sidebar-inner p-3">
        <h5 className="mb-3">Course Search</h5>
        <Form
          onSubmit={(e) => {
            e.preventDefault(); // Prevents the default form submission
            handleSearch();
          }}>
          <FormGroup>
            <Label>College</Label>
            <Input
              type="select"
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

          <FormGroup>
            <Label>Department</Label>
            <Input
              type="select"
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

          <FormGroup>
            <Label>Search Area</Label>
            <Input
              type="select"
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

          <FormGroup>
          <Label>Term</Label>
          <Input
            type="select"
            value={termId || ''}
            onChange={(e) => handleTermChange(e)}
          >
            <option value="" key="all">Select Term</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </Input>
        </FormGroup>
          

          <FormGroup>
            <Label>Search Query</Label>
            <Input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter search terms"
            />
          </FormGroup>

          <div className="d-flex gap-2 mt-4">
            <Button
              color="primary"
              onClick={handleSearch}
              style={{ backgroundColor: searchButtonBgColor }}
              block
            >
              Search
            </Button>
            <Button
              color="secondary"
              onClick={handleReset}
              style={{ backgroundColor: resetButtonBgColor }}
              block
            >
              Reset
            </Button>
          </div>
        </Form>
        </div>
      </Collapse>
    </div>
  );
}

export default AdminSidebar;