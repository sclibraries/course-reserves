/**
 * @file HorizontalResourceSidebar component
 * @module HorizontalResourceSidebar
 * @description Provides a horizontal search and filter bar for resource management
 * 
 * @requires react
 * @requires reactstrap
 * @requires react-icons/fa
 * @requires prop-types
 */

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
import { toast } from 'react-toastify';
import PropTypes from 'prop-types';
import useResourceSearchStore from '../../store/resourceSearchStore';
import { adminMaterialTypeService } from '../../services/admin/adminMaterialTypeService';
import { adminResourceService } from '../../services/admin/adminResourceService';
import '../../css/Admin.css';

/**
 * HorizontalResourceSidebar component
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Function} props.refreshResources - Function to refresh the resources list
 * @returns {JSX.Element} Horizontal sidebar with search and filter controls
 */
function HorizontalResourceSidebar({ refreshResources }) {
  // Control loading state during API calls
  const [loading, setLoading] = useState(false);
  
  // Available material types for filtering
  const [materialTypes, setMaterialTypes] = useState([]);
  
  // Resource search state and actions from store
  const { 
    filters, 
    setFilters, 
    resetFilters, 
    setSearchResults,
    setPagination 
  } = useResourceSearchStore();
  
  // Active metadata fields for the selected material type
  const [activeTypeFields, setActiveTypeFields] = useState([]);

  /**
   * Fetch material types on component mount
   */
  useEffect(() => {
    const fetchMaterialTypes = async () => {
      try {
        const { data } = await adminMaterialTypeService.getMaterialTypes();
        setMaterialTypes(data);
      } catch (err) {
        console.error('Error fetching material types:', err);
        toast.error('Error fetching material types.');
      }
    };
    fetchMaterialTypes();
  }, []);

  /**
   * Update dynamic metadata fields when material type filter changes
   */
  useEffect(() => {
    if (filters.materialTypeId) {
      const selectedType = materialTypes.find(
        t => t.material_type_id === filters.materialTypeId
      );
      setActiveTypeFields(selectedType?.fields || []);
    } else {
      setActiveTypeFields([]);
    }
  }, [filters.materialTypeId, materialTypes]);

  /**
   * Execute resource search with current filters
   * @async
   * @function handleSearch
   * @returns {Promise<void>}
   */
  const handleSearch = async () => {
    setLoading(true);
    try {
      const { data, pagination } = await adminResourceService.searchResources({
        name: filters.name,
        materialTypeId: filters.materialTypeId,
        metadata: filters.metadata,
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: filters.page,
        perPage: filters.perPage
      });
      setSearchResults(data);
      setPagination(pagination);
      toast.success('Search completed successfully.');
    } catch (err) {
      console.error('Failed to search resources:', err);
      toast.error(err.message || 'Failed to search resources.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update metadata filter value for a specific field
   * @function handleMetadataChange
   * @param {string} fieldName - The name of the metadata field
   * @param {string} value - The new filter value
   * @returns {void}
   */
  const handleMetadataChange = (fieldName, value) => {
    setFilters({
      ...filters,
      metadata: {
        ...filters.metadata,
        [fieldName]: value
      }
    });
  };

  /**
   * Reset filters and re-run the search
   * @async
   * @function handleReset
   * @returns {Promise<void>}
   */
  const handleReset = async () => {
    setLoading(true);
    resetFilters();
    setActiveTypeFields([]);
    setSearchResults([]); // Clear current results for immediate feedback.
    
    // Use the refreshResources function to reload with default settings
    if (refreshResources) {
      await refreshResources();
    }
    
    setLoading(false);
  };

  return (
    <div className="horizontal-admin-sidebar mb-4">
      <div className="admin-filter-panel">
        <Form onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}>
          <div className="filter-controls-row">
            {/* Resource Name Search */}
            <FormGroup className="filter-item search-field">
              <Label for="nameInput" className="filter-label">Resource Name</Label>
              <InputGroup>
                <Input
                  id="nameInput"
                  type="text"
                  value={filters.name || ''}
                  onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                  placeholder="Search resources..."
                  className="filter-input"
                />
              </InputGroup>
            </FormGroup>

            {/* Material Type */}
            <FormGroup className="filter-item">
              <Label for="materialTypeSelect" className="filter-label">Material Type</Label>
              <Input
                id="materialTypeSelect"
                type="select"
                value={filters.materialTypeId || ''}
                onChange={(e) => setFilters({ ...filters, materialTypeId: e.target.value })}
                className="filter-select"
              >
                <option value="">All Types</option>
                {materialTypes.map((type) => (
                  <option key={type.material_type_id} value={type.material_type_id}>
                    {type.name}
                  </option>
                ))}
              </Input>
            </FormGroup>

            {/* Date Range - Start Date */}
            <FormGroup className="filter-item">
              <Label for="startDate" className="filter-label">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="filter-input"
              />
            </FormGroup>

            {/* Date Range - End Date */}
            <FormGroup className="filter-item">
              <Label for="endDate" className="filter-label">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="filter-input"
              />
            </FormGroup>

            {/* Dynamic Metadata Field (if available) */}
            {activeTypeFields.length > 0 && activeTypeFields[0] && (
              <FormGroup className="filter-item">
                <Label for="metadataField" className="filter-label">
                  {activeTypeFields[0].label || activeTypeFields[0].field_name}
                </Label>
                {activeTypeFields[0].field_type === 'select' ? (
                  <Input
                    id="metadataField"
                    type="select"
                    value={(filters.metadata && filters.metadata[activeTypeFields[0].field_name]) || ''}
                    onChange={(e) => handleMetadataChange(activeTypeFields[0].field_name, e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All</option>
                    {JSON.parse(activeTypeFields[0].options_json).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Input>
                ) : (
                  <Input
                    id="metadataField"
                    type="text"
                    value={(filters.metadata && filters.metadata[activeTypeFields[0].field_name]) || ''}
                    onChange={(e) => handleMetadataChange(activeTypeFields[0].field_name, e.target.value)}
                    className="filter-input"
                  />
                )}
              </FormGroup>
            )}

            {/* Action Buttons */}
            <div className="filter-buttons">
              <Label className="filter-label d-block">&nbsp;</Label>
              <div className="button-group">
                <Button
                  color="primary"
                  className="action-button search-button"
                  type="submit"
                  disabled={loading}
                >
                  <FaSearch className="button-icon" /> Search
                </Button>
                <Button
                  color="secondary"
                  onClick={handleReset}
                  className="action-button reset-button"
                  type="button"
                  disabled={loading}
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

// PropTypes validation
HorizontalResourceSidebar.propTypes = {
  /**
   * Function to refresh the resources list
   */
  refreshResources: PropTypes.func
};

// Default props
HorizontalResourceSidebar.defaultProps = {
  refreshResources: () => {}
};

export default HorizontalResourceSidebar;
