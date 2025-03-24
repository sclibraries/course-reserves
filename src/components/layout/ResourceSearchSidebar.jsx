/**
 * @file Resource search sidebar component
 * @module ResourceSearchSidebar
 * @description Advanced search and filtering sidebar for administrative resource management.
 * Provides dynamic filters based on material types with customizable metadata fields.
 * @requires react
 * @requires reactstrap
 * @requires react-toastify
 * @requires ../../store/resourceSearchStore
 * @requires ../../services/admin/adminMaterialTypeService
 * @requires ../../services/admin/adminResourceService
 */

import { useState, useEffect } from 'react';
import {
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  Collapse,
  Spinner
} from 'reactstrap';
import { toast } from 'react-toastify';
import useResourceSearchStore from '../../store/resourceSearchStore';
import { adminMaterialTypeService } from '../../services/admin/adminMaterialTypeService';
import { adminResourceService } from '../../services/admin/adminResourceService';
import '../../css/Searchbar.css';

/**
 * Resource search sidebar component
 * 
 * Provides a comprehensive interface for searching and filtering resources with:
 * - Basic text search by resource name
 * - Material type filtering with dynamic metadata fields
 * - Date range filtering
 * - Collapsible interface for space efficiency
 * 
 * Features:
 * - Dynamic metadata fields based on selected material type
 * - Immediate search results with loading indicator
 * - Reset functionality to clear all filters
 * - Error handling with toast notifications
 * 
 * @component
 * @example
 * return (
 *   <div className="resource-management">
 *     <ResourceSearchSidebar />
 *     <ResourceList />
 *   </div>
 * )
 */
function ResourceSearchSidebar() {
  /**
   * Sidebar expanded/collapsed state
   * @type {boolean}
   */
  const [isOpen, setIsOpen] = useState(true);
  
  /**
   * Loading state for search operations
   * @type {boolean}
   */
  const [loading, setLoading] = useState(false);
  
  /**
   * Available material types for filtering
   * @type {Array<Object>}
   */
  const [materialTypes, setMaterialTypes] = useState([]);
  
  /**
   * Resource search state and actions from store
   * @type {Object}
   */
  const { 
    filters, 
    setFilters, 
    resetFilters, 
    setSearchResults,
    setPagination 
  } = useResourceSearchStore();
  
  /**
   * Active metadata fields for the selected material type
   * @type {Array<Object>}
   */
  const [activeTypeFields, setActiveTypeFields] = useState([]);

  /**
   * Toggle sidebar expanded/collapsed state
   * @function
   * @returns {void}
   */
  const toggleSidebar = () => setIsOpen(!isOpen);

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
   * @function
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
   * @function
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
   * @function
   * @returns {Promise<void>}
   */
  const handleReset = async () => {
    setLoading(true);
    resetFilters();
    setActiveTypeFields([]);
    setSearchResults([]); // Clear current results for immediate feedback.
    await handleSearch();
  };

  return (
    <div className="resource-sidebar bg-light p-3 h-100">
      {/* Add toggle button if needed */}
      <Button className="d-md-none mb-2" color="light" onClick={toggleSidebar}>
        {isOpen ? 'Hide Filters' : 'Show Filters'}
      </Button>
      
      <Collapse isOpen={isOpen}>
        <div className="sidebar-inner p-3">
          <h5 className="mb-3">Resource Search</h5>
          <Form onSubmit={async (e) => {
            e.preventDefault();
            await handleSearch();
          }}>
            {/* Basic Filters */}
            <FormGroup>
              <Label>Resource Name</Label>
              <Input
                type="text"
                value={filters.name || ''}
                onChange={e => setFilters({ ...filters, name: e.target.value })}
              />
            </FormGroup>

            <FormGroup>
              <Label>Material Type</Label>
              <Input
                type="select"
                value={filters.materialTypeId || ''}
                onChange={e => setFilters({ ...filters, materialTypeId: e.target.value })}
              >
                <option value="">All Types</option>
                {materialTypes.map(type => (
                  <option key={type.material_type_id} value={type.material_type_id}>
                    {type.name}
                  </option>
                ))}
              </Input>
            </FormGroup>

            {/* Dynamic Metadata Fields */}
            {activeTypeFields.map(field => (
              <FormGroup key={field.mt_field_id}>
                <Label>{field.label || field.field_name}</Label>
                {field.field_type === 'select' ? (
                  <Input
                    type="select"
                    value={(filters.metadata && filters.metadata[field.field_name]) || ''}
                    onChange={e => handleMetadataChange(field.field_name, e.target.value)}
                  >
                    <option value="">All</option>
                    {JSON.parse(field.options_json).map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Input>
                ) : (
                  <Input
                    type="text"
                    value={(filters.metadata && filters.metadata[field.field_name]) || ''}
                    onChange={e => handleMetadataChange(field.field_name, e.target.value)}
                  />
                )}
              </FormGroup>
            ))}

            {/* Date Filters */}
            <FormGroup>
              <Label>Creation Date Range</Label>
              <div className="d-flex gap-2">
                <Input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
            </FormGroup>
            <FormGroup>
              <Label>End Date</Label>
              <div className="d-flex gap-2">
                <Input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
            </FormGroup>

            {/* Action Buttons */}
            <div className="d-flex gap-2 mt-4">
              <Button color="primary" type="submit" disabled={loading}>
                {loading ? <Spinner size="sm" /> : 'Search'}
              </Button>
              <Button color="secondary" type="button" onClick={handleReset} disabled={loading}>
                Reset
              </Button>
            </div>
          </Form>

          {loading && (
            <div className="mt-3 text-center">
              <Spinner color="primary" />
            </div>
          )}
        </div>
      </Collapse>
    </div>
  );
}

export default ResourceSearchSidebar;