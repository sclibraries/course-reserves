/**
 * AdditionalCommonFields - Common Form Fields for Resource Management
 * 
 * This component provides reusable form fields that are commonly used across
 * different resource forms. It handles:
 * - Folder selection with creation capability
 * - Visibility start and end dates with automatic term defaults
 * - Consistent UI and validation
 * 
 * Features:
 * - Auto-populates visibility dates from course term data
 * - Allows creating new folders inline
 * - Proper error handling and loading states
 * 
 * Used by: BaseResourceForm, ResourceFormManager
 * 
 * @component
 * @example
 * <AdditionalCommonFields
 *   handleFieldChange={handleFieldChange}
 *   formData={formData}
 *   setFormData={setFormData}
 * />
 */

import { useState, useEffect } from 'react';
import { Row, Col, FormGroup, Label, Input, Button, InputGroup } from 'reactstrap';
import { useFolderManagement } from '../../../../hooks/useFolderManagement';
import { useAdminCourseStore } from '../../../../store/adminCourseStore';
import { FaFolder, FaPlus, FaTimes, FaCalendarAlt } from 'react-icons/fa';
import PropTypes from 'prop-types';

export const AdditionalCommonFields = ({ handleFieldChange, formData, setFormData }) => {
  // Folder management
  const { folders, loading: foldersLoading, error: foldersError, createFolder } = useFolderManagement();
  
  // New folder creation state
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  
  // Course data for auto-populating dates
  const { folioCourseData } = useAdminCourseStore();

  /**
   * Auto-populate visibility dates from course term data
   * Only sets dates if they're not already set to avoid overriding user changes
   */
  useEffect(() => {
    if (folioCourseData?.courseListingObject?.termObject) {
      const term = folioCourseData.courseListingObject.termObject;
      
      setFormData((prev) => ({
        ...prev,
        start_visibility: prev.start_visibility || new Date(term.startDate).toISOString().split('T')[0],
        end_visibility: prev.end_visibility || new Date(term.endDate).toISOString().split('T')[0],
      }));
    }
  }, [folioCourseData, setFormData]);
  
  /**
   * Handle creating a new folder
   * Creates folder and automatically selects it in the dropdown
   */
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      return;
    }
    
    setCreatingFolder(true);
    try {
      const newFolder = await createFolder({ name: newFolderName.trim() });
      
      // Auto-select the newly created folder
      setFormData(prev => ({ 
        ...prev, 
        folder: newFolder.folder_id 
      }));
      
      // Reset form state
      setNewFolderName('');
      setShowNewFolderInput(false);
    } catch (err) {
      console.error('Error creating folder:', err);
      // Error handling is managed by useFolderManagement hook
    } finally {
      setCreatingFolder(false);
    }
  };

  /**
   * Handle folder dropdown changes
   * Detects when user wants to create a new folder
   */
  const handleFolderChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'folder' && value === '__new__') {
      setShowNewFolderInput(true);
      return;
    }
    
    handleFieldChange(e);
  };

  /**
   * Cancel new folder creation
   */
  const handleCancelNewFolder = () => {
    setShowNewFolderInput(false);
    setNewFolderName('');
  };

  return (
    <>
      {/* Folder Selection */}
      <Col md={6}>
        <FormGroup>
          <Label for="folder" className="form-label fw-bold">
            <FaFolder className="me-2 text-primary" /> 
            Folder Organization
          </Label>
          
          {!showNewFolderInput ? (
            <>
              <Input
                id="folder"
                name="folder"
                type="select"
                value={formData.folder || ''}
                onChange={handleFolderChange}
                disabled={foldersLoading}
                className="form-select"
              >
                <option value="">-- No Folder --</option>
                {folders.map(folder => (
                  <option key={folder.folder_id} value={folder.folder_id}>
                    {folder.name}
                  </option>
                ))}
                <option value="__new__" className="text-primary">
                  + Create New Folder
                </option>
              </Input>
              <small className="form-text text-muted">
                Optional: Organize resources into folders for better management
              </small>
            </>
          ) : (
            <>
              <InputGroup>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter new folder name"
                  disabled={creatingFolder}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                <Button 
                  color="success" 
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || creatingFolder}
                  className="px-3"
                >
                  {creatingFolder ? (
                    <>Creating...</>
                  ) : (
                    <>
                      <FaPlus className="me-1" />
                      Add
                    </>
                  )}
                </Button>
                <Button 
                  color="secondary" 
                  onClick={handleCancelNewFolder}
                  disabled={creatingFolder}
                  className="px-3"
                >
                  <FaTimes />
                </Button>
              </InputGroup>
              <small className="form-text text-muted">
                Press Enter or click Add to create the folder
              </small>
            </>
          )}
          
          {/* Loading and error states */}
          {foldersLoading && (
            <small className="text-info mt-1 d-block">
              Loading folders...
            </small>
          )}
          {foldersError && (
            <small className="text-danger mt-1 d-block">
              Error loading folders: {foldersError}
            </small>
          )}
        </FormGroup>
      </Col>
      
      {/* Visibility Dates */}
      <Col md={6}>
        <FormGroup>
          <Label className="form-label fw-bold">
            <FaCalendarAlt className="me-2 text-primary" />
            Visibility Schedule
          </Label>
          
          <Row>
            <Col md={6}>
              <FormGroup className="mb-2">
                <Label for="start_visibility" className="form-label">
                  Start Date
                </Label>
                <Input
                  id="start_visibility"
                  name="start_visibility"
                  type="date"
                  value={formData.start_visibility || ''}
                  onChange={handleFieldChange}
                  className="form-control"
                />
              </FormGroup>
            </Col>
            
            <Col md={6}>
              <FormGroup className="mb-2">
                <Label for="end_visibility" className="form-label">
                  End Date
                </Label>
                <Input
                  id="end_visibility"
                  name="end_visibility"
                  type="date"
                  value={formData.end_visibility || ''}
                  onChange={handleFieldChange}
                  className="form-control"
                />
              </FormGroup>
            </Col>
          </Row>
          
          <small className="form-text text-muted">
            Control when this resource is visible to students. 
            Dates are auto-populated from course term but can be customized.
          </small>
        </FormGroup>
      </Col>
    </>
  );
};

AdditionalCommonFields.propTypes = {
  /** Function to handle field value changes */
  handleFieldChange: PropTypes.func.isRequired,
  /** Current form data object */
  formData: PropTypes.shape({
    /** Whether to use proxy for the resource */
    use_proxy: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.string,
      PropTypes.number,
    ]),
    /** Selected folder ID */
    folder: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    /** Visibility start date (YYYY-MM-DD format) */
    start_visibility: PropTypes.string,
    /** Visibility end date (YYYY-MM-DD format) */
    end_visibility: PropTypes.string,
  }).isRequired,
  /** Function to update the entire form data object */
  setFormData: PropTypes.func.isRequired
};

export default AdditionalCommonFields;
