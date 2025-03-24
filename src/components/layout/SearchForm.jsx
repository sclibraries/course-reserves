/**
 * @file Search form component
 * @module SearchForm
 * @description Reusable form component for searching course reserves with configurable filters and appearance
 * @requires prop-types
 * @requires reactstrap
 * @requires ../../hooks/useDepartments
 * @requires ../../util/searchUtils
 */

import PropTypes from 'prop-types';
import { Form, FormGroup, Label, Input, Button, Alert } from 'reactstrap';
import { useDepartments } from '../../hooks/useDepartments';
import { collegeNameToKey } from '../../util/searchUtils';

/**
 * Course reserves search form component
 * 
 * A flexible, configurable search form that allows filtering by:
 * - College/institution
 * - Department
 * - Search area (All fields, Course Name, etc.)
 * - Term (optional)
 * - Keyword search
 * 
 * The component handles form submission, reset functionality, and dynamic department loading
 * based on selected college.
 * 
 * @component
 * @example
 * const [selectedCollege, setSelectedCollege] = useState('All Colleges');
 * const [searchArea, setSearchArea] = useState('All fields');
 * const [searchInput, setSearchInput] = useState('');
 * const [department, setDepartment] = useState('');
 * 
 * return (
 *   <SearchForm
 *     selectedCollege={selectedCollege}
 *     setSelectedCollege={setSelectedCollege}
 *     searchArea={searchArea}
 *     setSearchArea={setSearchArea}
 *     searchInput={searchInput}
 *     setSearchInput={setSearchInput}
 *     department={department}
 *     setDepartment={setDepartment}
 *     onSubmit={handleSearch}
 *     onReset={handleReset}
 *   />
 * );
 */
const SearchForm = ({
  // Required props
  /**
   * Currently selected college
   * @type {string}
   */
  selectedCollege,
  
  /**
   * Function to update the selected college
   * @type {function}
   * @param {string} college - The new college value
   */
  setSelectedCollege,
  
  /**
   * Current search area selection (All fields, Course Name, etc.)
   * @type {string}
   */
  searchArea,
  
  /**
   * Function to update the search area
   * @type {function}
   * @param {string} area - The new search area value
   */
  setSearchArea, 
  
  /**
   * Current search input value/query
   * @type {string}
   */
  searchInput,
  
  /**
   * Function to update the search input
   * @type {function}
   * @param {string} input - The new search input value
   */
  setSearchInput,
  
  /**
   * Currently selected department
   * @type {string}
   */
  department,
  
  /**
   * Function to update the selected department
   * @type {function}
   * @param {string} dept - The new department value
   */
  setDepartment,
  
  // Optional props with defaults
  /**
   * Available academic terms for filtering
   * @type {Array<{id: string, name: string}>}
   * @default []
   */
  terms = [],
  
  /**
   * Currently selected term ID
   * @type {string|null}
   * @default null
   */
  termId = null,
  
  /**
   * Handler function for term selection changes
   * @type {function|null}
   * @param {Event} e - Change event from term select input
   * @default null
   */
  handleTermChange = null,
  
  /**
   * Whether to show term selection field
   * @type {boolean}
   * @default false
   */
  showTerms = false,
  
  /**
   * Form submission handler
   * @type {function}
   * @default () => {}
   */
  onSubmit = () => {},
  
  /**
   * Form reset handler
   * @type {function}
   * @default () => {}
   */
  onReset = () => {},
  
  /**
   * Background color for the search button
   * @type {string}
   * @default "#007bff"
   */
  searchButtonBgColor = "#007bff",
  
  /**
   * Background color for the reset button
   * @type {string}
   * @default "#6c757d"
   */
  resetButtonBgColor = "#6c757d",
  
  /**
   * List of available colleges to select from
   * @type {Array<string>}
   * @default ['All Colleges', 'Smith', 'Hampshire', 'MtHolyoke', 'Amherst', 'UMass']
   */
  colleges = [
    'All Colleges', 'Smith', 'Hampshire', 'MtHolyoke', 'Amherst', 'UMass'
  ],
  
  /**
   * List of available search areas to select from
   * @type {Array<string>}
   * @default ['All fields', 'Course Name', 'Course Code', 'Section', 'Instructor']
   */
  searchAreas = [
    'All fields', 'Course Name', 'Course Code', 'Section', 'Instructor'
  ],
}) => {
  /**
   * Custom hook that fetches departments based on selected college
   * @type {Object}
   * @property {Array} departments - List of departments for the selected college
   * @property {boolean} loading - Whether departments are currently being fetched
   * @property {string|null} error - Error message if department fetching failed
   */
  const { departments, loading, error } = useDepartments(collegeNameToKey(selectedCollege));

  /**
   * Handle form submission
   * Prevents default form behavior and calls the onSubmit handler
   * 
   * @function
   * @param {Event} e - Form submit event
   * @returns {void}
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (typeof onSubmit === 'function') {
      onSubmit();
    }
  };

  /**
   * Handle form reset
   * Prevents default form behavior and calls the onReset handler
   * 
   * @function
   * @param {Event} e - Form reset event
   * @returns {void}
   */
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