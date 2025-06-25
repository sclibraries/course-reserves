/**
 * @file Advanced search interface component
 * @module Searchbar
 * @description Provides a compact search interface for course reserves with essential filters
 */
import { useState, useEffect } from 'react';
import {
  FormGroup,
  Label,
  Input,
  Button,
  InputGroup,
  Form,
  Collapse,
} from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaRedo, FaFilter, FaAngleDown, FaAngleUp } from 'react-icons/fa';
import useSearchStore from '../../store/searchStore';
import useCustomizationStore from '../../store/customizationStore';
import { trackingService } from '../../services/trackingService';
import { getTermName } from '../../util/termHelpers';
import { config } from '../../config';
import '../../css/Searchbar.css';

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
    termId,
    setTermId,
    terms,
  } = useSearchStore();

  const { searchButtonBgColor, resetButtonBgColor, additionalHeaderText, searchBarBgColor } =
    useCustomizationStore((state) => state.getCustomizationForCollege(college));

  const [searchArea, setSearchArea] = useState('All fields');
  const [searchInput, setSearchInput] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('All Colleges');
  const [departments, setDepartments] = useState([]);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const toggleAdvancedFilters = () => setAdvancedFiltersOpen(!advancedFiltersOpen);

  const searchAreas = ['All fields', 'Course Name', 'Course Code', 'Section', 'Instructor'];
  const colleges = ['All', 'Amherst College', 'Hampshire College', 'Mount Holyoke College', 'Smith College', 'UMass Amherst'];
  
  const sortingOptions = [
    { label: 'Name (A-Z)', value: 'name' },
    { label: 'Name (Z-A)', value: 'name.descending' },
    { label: 'Course Number (Asc)', value: 'courseNumber' },
    { label: 'Course Number (Desc)', value: 'courseNumber.descending' },
    { label: 'Section Name (Asc)', value: 'sectionName' },
    { label: 'Section Name (Desc)', value: 'sectionName.descending' },
  ];

  // Sync local state with store
  useEffect(() => {
    setSearchArea(keyToSearchArea(type));
    setSearchInput(query || '');
    setSelectedCollege(keyToCollegeName(college));
  }, [type, query, college, department, sortOption]);

  // Fetch departments when college changes
  useEffect(() => {
    setDepartments([]);
    if (!college || college === 'all') return;
    
    const collegeKey = college;
    const queryParam = getCollegeQuery(collegeKey);
    if (!queryParam) return;
    
    let url = `${config.api.urls.folio}${config.api.endpoints.folioSearch.departments}`;
    if (queryParam) {
      url += `?query=${encodeURIComponent(queryParam)}%20sortBy%20name/sort.ascending`;
    }

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        if (data && data.data && Array.isArray(data.data.departments)) {
          setDepartments(data.data.departments);
        } else {
          setDepartments([]);
        }
      })
      .catch(error => {
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

  // Conversion helper functions
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
      case 'Smith College': return 'smith';
      case 'Hampshire College': return 'hampshire';
      case 'Mount Holyoke College': return 'mtholyoke';
      case 'Amherst College': return 'amherst';
      case 'UMass Amherst': return 'umass';
      case 'All':
      default: return 'all';
    }
  };

  const keyToCollegeName = (key) => {
    switch (key) {
      case 'smith': return 'Smith College';
      case 'hampshire': return 'Hampshire College';
      case 'mtholyoke': return 'Mount Holyoke College';
      case 'amherst': return 'Amherst College';
      case 'umass': return 'UMass Amherst';
      case 'all':
      default: return 'All';
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

  return (
    <div className="search-panel-container" role="search" style={{backgroundColor: searchBarBgColor || '#f8f9fa'}}>
      <div className="search-panel">
        <Form onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}>
          {/* Mobile Search Bar - Always visible on mobile */}
          <div className="mobile-search-container d-flex d-md-none">
            <div className="mobile-search-row">
              <FormGroup className="mobile-search-field">
                <Label for="mobileSearchInput" className="filter-label d-none">Search</Label>
                <InputGroup className="mobile-input-group">
                  <Input
                    id="mobileSearchInput"
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search courses..."
                    className="filter-input"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                  />
                  <Button
                    color="primary"
                    onClick={handleSearch}
                    style={{ backgroundColor: searchButtonBgColor || '#0066cc' }}
                    className="mobile-search-button"
                    type="submit"
                    aria-label="Search courses"
                  >
                    <FaSearch className="button-icon" aria-hidden="true" />
                    <span className="visually-hidden">Search</span>
                  </Button>
                  <Button
                    color="light"
                    onClick={toggleAdvancedFilters}
                    className="mobile-filter-toggle"
                    type="button"
                    aria-expanded={advancedFiltersOpen}
                    aria-controls="advancedFilters"
                    aria-label={advancedFiltersOpen ? "Hide advanced filters" : "Show advanced filters"}
                  >
                    <FaFilter className="button-icon" aria-hidden="true" />
                    {advancedFiltersOpen ? <FaAngleUp className="ms-1" /> : <FaAngleDown className="ms-1" />}
                    <span className="visually-hidden">
                      {advancedFiltersOpen ? "Hide" : "Show"} advanced filters
                    </span>
                  </Button>
                </InputGroup>
              </FormGroup>
            </div>
          </div>

          {/* Advanced Filters Section */}
          <Collapse isOpen={advancedFiltersOpen} className="d-md-block" id="advancedFilters">
            {/* Desktop Search Bar - Hidden on mobile */}
            <div className="d-none d-md-block mb-3">
              <div className="filter-controls-row">
                {/* College Filter */}
                <FormGroup className="filter-item">
                  <Label for="collegeSelect" className="filter-label">Institution</Label>
                  <Input
                    id="collegeSelect"
                    type="select"
                    value={selectedCollege}
                    onChange={(e) => {
                      const newCollege = e.target.value;
                      const newCollegeKey = collegeNameToKey(newCollege);
                      const currentTermName = getTermName(terms, termId);
                      
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

                      setSelectedCollege(newCollege);
                      setCollege(newCollegeKey);
                      useCustomizationStore.getState().setCurrentCollege(newCollegeKey);
                      setDepartment('');
                      setSearchInput('');
                      setSearchArea('All fields');
                      setType('all');
                      setSortOption('');

                      const queryParams = new URLSearchParams();
                      queryParams.set('college', newCollegeKey);
                      navigate(`/search?${queryParams.toString()}`);
                    }}
                    className="filter-select"
                  >
                    {colleges.map((col) => (
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
                    onChange={(e) => {
                      const newDept = e.target.value;
                      const currentTermName = getTermName(terms, termId);
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
                    onChange={handleTermChange}
                    className="filter-select"
                  >
                    <option value="">Select term</option>
                    {terms.map((term) => (
                      <option key={term.id} value={term.id}>{term.name}</option>
                    ))}
                  </Input>
                </FormGroup>

                {/* Search Area Select */}
                <FormGroup className="filter-item">
                  <Label for="searchAreaSelect" className="filter-label">Search In</Label>
                  <Input
                    id="searchAreaSelect"
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

                {/* Sort Filter */}
                <FormGroup className="filter-item">
                  <Label for="sortSelect" className="filter-label">Sort By</Label>
                  <Input
                    id="sortSelect"
                    type="select"
                    value={sortOption || ''}
                    onChange={(e) => {
                      setSortOption(e.target.value);
                    }}
                    className="filter-select"
                  >
                    <option value="">Default</option>
                    {sortingOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Input>
                </FormGroup>

                {/* Search Input - Only on desktop */}
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearch();
                        }
                      }}
                    />
                  </InputGroup>
                </FormGroup>
                      
                {/* Action Buttons */}
                <div className="filter-buttons">
                  <div className="button-group">
                    <Button
                      color="primary"
                      onClick={handleSearch}
                      style={{ backgroundColor: searchButtonBgColor || '#0066cc' }}
                      className="action-button search-button"
                      type="submit"
                    >
                      <FaSearch className="button-icon" aria-hidden="true" /> Search
                    </Button>
                    <Button
                      color="secondary"
                      onClick={handleReset}
                      style={{ backgroundColor: resetButtonBgColor || '#6c757d' }}
                      className="action-button reset-button"
                      type="button"
                      aria-label="Reset search filters"
                    >
                      <FaRedo className="button-icon" aria-hidden="true" />
                      <span className="visually-hidden">Reset</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Advanced Filters */}
            <div className="d-md-none mobile-advanced-filters">
              {/* Mobile Filter Items */}
              <div className="mobile-filter-grid">
                {/* College Filter */}
                <FormGroup className="mobile-filter-item">
                  <Label for="mobileCollegeSelect" className="filter-label">Institution</Label>
                  <Input
                    id="mobileCollegeSelect"
                    type="select"
                    value={selectedCollege}
                    onChange={(e) => {
                      const newCollege = e.target.value;
                      const newCollegeKey = collegeNameToKey(newCollege);
                      // Same logic as desktop dropdown
                      setSelectedCollege(newCollege);
                      setCollege(newCollegeKey);
                      useCustomizationStore.getState().setCurrentCollege(newCollegeKey);
                      setDepartment('');
                      const queryParams = new URLSearchParams();
                      queryParams.set('college', newCollegeKey);
                      navigate(`/search?${queryParams.toString()}`);
                    }}
                    className="filter-select"
                  >
                    {colleges.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </Input>
                </FormGroup>

                {/* Department Filter */}
                <FormGroup className="mobile-filter-item">
                  <Label for="mobileDepartmentSelect" className="filter-label">Department</Label>
                  <Input
                    id="mobileDepartmentSelect"
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
                <FormGroup className="mobile-filter-item">
                  <Label for="mobileTermSelect" className="filter-label">Term</Label>
                  <Input
                    id="mobileTermSelect"
                    type="select"
                    value={termId || ''}
                    onChange={handleTermChange}
                    className="filter-select"
                  >
                    <option value="">Select term</option>
                    {terms.map((term) => (
                      <option key={term.id} value={term.id}>{term.name}</option>
                    ))}
                  </Input>
                </FormGroup>

                {/* Search Area Select */}
                <FormGroup className="mobile-filter-item">
                  <Label for="mobileSearchAreaSelect" className="filter-label">Search In</Label>
                  <Input
                    id="mobileSearchAreaSelect"
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

                {/* Sort Filter */}
                <FormGroup className="mobile-filter-item">
                  <Label for="mobileSortSelect" className="filter-label">Sort By</Label>
                  <Input
                    id="mobileSortSelect"
                    type="select"
                    value={sortOption || ''}
                    onChange={(e) => {
                      setSortOption(e.target.value);
                    }}
                    className="filter-select"
                  >
                    <option value="">Default</option>
                    {sortingOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Input>
                </FormGroup>
              </div>

              {/* Mobile Action Buttons */}
              <div className="mobile-filter-actions mt-3">
                <div className="d-flex justify-content-between">
                  <Button
                    color="secondary"
                    onClick={() => {
                      handleReset();
                      setAdvancedFiltersOpen(false);
                    }}
                    style={{ backgroundColor: resetButtonBgColor || '#6c757d' }}
                    className="action-button reset-button-mobile"
                    type="button"
                  >
                    <FaRedo className="button-icon" aria-hidden="true" /> Reset
                  </Button>
                  <Button
                    color="primary"
                    onClick={() => {
                      handleSearch();
                      setAdvancedFiltersOpen(false);
                    }}
                    style={{ backgroundColor: searchButtonBgColor || '#0066cc' }}
                    className="action-button apply-button-mobile"
                    type="submit"
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </div>
          </Collapse>
        </Form>
      </div>
      
      {additionalHeaderText && (
        <div 
          className="additional-header-text"
          dangerouslySetInnerHTML={{__html: additionalHeaderText}} 
        />
      )}
    </div>
  );
}

export default Searchbar;
