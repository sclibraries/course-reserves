import PropTypes from 'prop-types';
import { Form, FormGroup, Label, Input, Button, Alert } from 'reactstrap';
import { useDepartments } from '../../hooks/useDepartments';
import { collegeNameToKey } from '../../util/searchUtils';

const SearchForm = ({
  // Required props
  selectedCollege,
  setSelectedCollege,
  searchArea,
  setSearchArea, 
  searchInput,
  setSearchInput,
  department,
  setDepartment,
  
  // Optional props with defaults
  terms = [],
  termId = null,
  handleTermChange = null,
  showTerms = false,
  onSubmit = () => {},
  onReset = () => {},
  searchButtonBgColor = "#007bff",
  resetButtonBgColor = "#6c757d",
  colleges = [
    'All Colleges', 'Smith', 'Hampshire', 'MtHolyoke', 'Amherst', 'UMass'
  ],
  searchAreas = [
    'All fields', 'Course Name', 'Course Code', 'Section', 'Instructor'
  ],
}) => {
  // Use our custom hook
  const { departments, loading, error } = useDepartments(collegeNameToKey(selectedCollege));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (typeof onSubmit === 'function') {
      onSubmit();
    }
  };

  const handleReset = (e) => {
    e.preventDefault();
    if (typeof onReset === 'function') {
      onReset();
    }
  };

  return (
    <Form onSubmit={handleSubmit} aria-label="Course search form">
      {error && (
        <Alert color="danger" className="mb-3">
          Error loading departments: {error}
        </Alert>
      )}
      
      <FormGroup>
        <Label for="college-select">College</Label>
        <Input
          type="select"
          id="college-select"
          name="college"
          value={selectedCollege}
          onChange={(e) => setSelectedCollege(e.target.value)}
          aria-label="Select a college"
        >
          {colleges.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </Input>
      </FormGroup>

      <FormGroup>
        <Label for="department-select">Department</Label>
        <Input
          type="select"
          id="department-select"
          name="department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          disabled={loading || departments.length === 0}
          aria-label="Select a department"
          aria-busy={loading}
        >
          <option value="">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.name}>
              {dept.name}
            </option>
          ))}
        </Input>
        {loading && <small className="form-text text-muted">Loading departments...</small>}
      </FormGroup>

      <FormGroup>
        <Label for="search-area-select">Search Area</Label>
        <Input
          type="select"
          id="search-area-select"
          name="searchArea"
          value={searchArea}
          onChange={(e) => setSearchArea(e.target.value)}
          aria-label="Select search area"
        >
          {searchAreas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </Input>
      </FormGroup>

      {showTerms && handleTermChange && (
        <FormGroup>
          <Label for="term-select">Term</Label>
          <Input
            type="select"
            id="term-select"
            name="term"
            value={termId || ''}
            onChange={handleTermChange}
            aria-label="Select a term"
          >
            <option value="" key="all">All Terms</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </Input>
        </FormGroup>
      )}

      <FormGroup>
        <Label for="search-input">Search Query</Label>
        <Input
          type="text"
          id="search-input"
          name="searchInput"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Enter search terms"
          aria-label="Search query"
        />
      </FormGroup>

      <div className="d-flex gap-2 mt-4">
        <Button
          color="primary"
          type="submit"
          style={{ backgroundColor: searchButtonBgColor }}
          block
          aria-label="Submit search"
        >
          Search
        </Button>
        <Button
          color="secondary"
          onClick={handleReset}
          style={{ backgroundColor: resetButtonBgColor }}
          block
          aria-label="Reset search form"
        >
          Reset
        </Button>
      </div>
    </Form>
  );
};

// Add proper PropTypes validation
SearchForm.propTypes = {
  selectedCollege: PropTypes.string.isRequired,
  setSelectedCollege: PropTypes.func.isRequired,
  searchArea: PropTypes.string.isRequired,
  setSearchArea: PropTypes.func.isRequired,
  searchInput: PropTypes.string.isRequired,
  setSearchInput: PropTypes.func.isRequired,
  department: PropTypes.string.isRequired,
  setDepartment: PropTypes.func.isRequired,
  terms: PropTypes.array,
  termId: PropTypes.string,
  handleTermChange: PropTypes.func,
  showTerms: PropTypes.bool,
  onSubmit: PropTypes.func,
  onReset: PropTypes.func,
  searchButtonBgColor: PropTypes.string,
  resetButtonBgColor: PropTypes.string,
  colleges: PropTypes.arrayOf(PropTypes.string),
  searchAreas: PropTypes.arrayOf(PropTypes.string)
};

export default SearchForm;