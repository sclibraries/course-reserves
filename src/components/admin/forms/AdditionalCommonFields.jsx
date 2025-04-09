import { useState, useEffect } from 'react';
import { Row, Col, FormGroup, Label, Input, Button, InputGroup } from 'reactstrap';
import { useFolderManagement } from '../../../hooks/useFolderManagement';
import { useAdminCourseStore } from '../../../store/adminCourseStore';
import { FaFolder } from 'react-icons/fa';
import PropTypes from 'prop-types';

export const AdditionalCommonFields = ({ handleFieldChange, formData, setFormData }) => {
  const { folders, loading: foldersLoading, error: foldersError, createFolder } = useFolderManagement();
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const { folioCourseData } = useAdminCourseStore();

  useEffect(() => {
    if (folioCourseData && folioCourseData.courseListingObject?.termObject) {
      setFormData((prev) => ({
        ...prev,
        start_visibility: prev.start_visibility || new Date(folioCourseData.courseListingObject.termObject.startDate)
          .toISOString().split('T')[0],
        end_visibility: prev.end_visibility || new Date(folioCourseData.courseListingObject.termObject.endDate)
          .toISOString().split('T')[0],
      }));
    }
  }, [folioCourseData]);
  
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const newFolder = await createFolder({ name: newFolderName.trim() });
      // Set the folder field in the form data to the newly created folder's id
      setFormData(prev => ({ ...prev, folder: newFolder.folder_id }));
      setNewFolderName('');
      setShowNewFolderInput(false);
    } catch (err) {
      console.error('Error creating folder:', err);
    } finally {
      setCreatingFolder(false);
    }
  };

  /**
   * Handle standard field changes for the folder dropdown
   */
  const handleFolderChange = (e) => {
    const { name, value } = e.target;
    
    // Handle special case for folder dropdown
    if (name === 'folder' && value === '__new__') {
      setShowNewFolderInput(true);
      return;
    }
    
    // Otherwise use the normal handler
    handleFieldChange(e);
  };

  return (
    <>
      <Col md={6}>
        <FormGroup>
          <Label for="folder">
            <FaFolder className="me-1" /> Folder
          </Label>
          {!showNewFolderInput ? (
            <Input
              id="folder"
              name="folder"
              type="select"
              value={formData.folder || ''}
              onChange={handleFolderChange}
              disabled={foldersLoading}
            >
              <option value="">-- Select Folder --</option>
              {folders.map(folder => (
                <option key={folder.folder_id} value={folder.folder_id}>
                  {folder.name}
                </option>
              ))}
              <option value="__new__">+ Create new folder</option>
            </Input>
          ) : (
            <InputGroup>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter new folder name"
              />
              <Button 
                color="primary" 
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || creatingFolder}
              >
                {creatingFolder ? 'Adding...' : 'Add'}
              </Button>
              <Button 
                color="secondary" 
                onClick={() => {
                  setShowNewFolderInput(false);
                  setNewFolderName('');
                }}
              >
                Cancel
              </Button>
            </InputGroup>
          )}
          {foldersLoading && <div className="text-muted mt-1">Loading folders...</div>}
          {foldersError && <div className="text-danger mt-1">Error: {foldersError}</div>}
        </FormGroup>
      </Col>
      
      <Col md={6}>
        {/* Visibility Start and End Dates - Side by Side */}
        <Row>
          <Col md={6}>
            <FormGroup>
              <Label for="start_visibility">Visibility Start Date</Label>
              <Input
                id="start_visibility"
                name="start_visibility"
                type="date"
                value={formData.start_visibility || ''}
                onChange={handleFieldChange}
              />
              <small className="text-muted">
                When visible to students
              </small>
            </FormGroup>
          </Col>
          
          <Col md={6}>
            <FormGroup>
              <Label for="end_visibility">Visibility End Date</Label>
              <Input
                id="end_visibility"
                name="end_visibility"
                type="date"
                value={formData.end_visibility || ''}
                onChange={handleFieldChange}
              />
              <small className="text-muted">
                When no longer visible
              </small>
            </FormGroup>
          </Col>
        </Row>
      </Col>
    </>
  );
};

AdditionalCommonFields.propTypes = {
  handleFieldChange: PropTypes.func.isRequired,
  formData: PropTypes.shape({
    use_proxy: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.string,
      PropTypes.number,
    ]),
    folder: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    start_visibility: PropTypes.string,
    end_visibility: PropTypes.string,
  }).isRequired,
  setFormData: PropTypes.func.isRequired
};
