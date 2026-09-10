import { useState } from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Label, Input, Button, InputGroup, Spinner } from 'reactstrap';
import { FaFolder } from 'react-icons/fa';
import { useFolderManagement } from '../../../../hooks/useFolderManagement';

/**
 * FolderSelector - Component for selecting or creating folders
 */
export const FolderSelector = ({ selectedFolder, handleFolderChange, setFormData }) => {
  const { folders, loading, error, createFolder } = useFolderManagement();
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    setCreatingFolder(true);
    try {
      const newFolder = await createFolder({ name: newFolderName.trim() });
      
      // Set the folder field in the form data to the newly created folder's id
      if (setFormData) {
        setFormData(prev => ({ ...prev, folder: newFolder.folder_id }));
      } else if (handleFolderChange) {
        // Create a synthetic event for the custom handler
        handleFolderChange({
          target: {
            name: 'folder',
            value: newFolder.folder_id
          }
        });
      }
      
      setNewFolderName('');
      setShowNewFolderInput(false);
    } catch (err) {
      console.error('Error creating folder:', err);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFolderDropdownChange = (e) => {
    const {  value } = e.target;
    
    // Handle special case for folder dropdown
    if (value === '__new__') {
      setShowNewFolderInput(true);
      return;
    }
    
    // Otherwise use the normal handler
    handleFolderChange(e);
  };

  return (
    <FormGroup>
      <Label for="folder">
        <FaFolder className="me-1" /> Folder
      </Label>
      {!showNewFolderInput ? (
        <Input
          id="folder"
          name="folder"
          type="select"
          value={selectedFolder || ''}
          onChange={handleFolderDropdownChange}
          disabled={loading}
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
      {loading && <div className="text-muted mt-1"><Spinner size="sm" /> Loading folders...</div>}
      {error && <div className="text-danger mt-1">Error: {error}</div>}
    </FormGroup>
  );
};

FolderSelector.propTypes = {
  selectedFolder: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]),
  handleFolderChange: PropTypes.func.isRequired,
  setFormData: PropTypes.func
};

export default FolderSelector;
