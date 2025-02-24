import { useState } from 'react';
import { Col, FormGroup, Label, Input, Button } from 'reactstrap';
import { useFolderManagement } from '../../../hooks/useFolderManagement';
import PropTypes from 'prop-types';

export const AdditionalCommonFields = ({handleFieldChange, formData}) => {

  const { folders, loading, error, createFolder } = useFolderManagement();
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const newFolder = await createFolder({ name: newFolderName });
      const value = {
        name: 'folder',
        value: newFolder.folder_id
      }
      // Set the folder field in the form data to the newly created folder's id.
      handleFieldChange(value);
      setNewFolderName('');
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingFolder(false);
    }
  };

  console.log(formData)

  return (
    <>
      <Col>
        <FormGroup>
          <Label>Use Proxy?</Label><br />
          <div>
            <Input
              type="radio"
              name="use_proxy"
              value="1"
              checked={formData.use_proxy === true || formData.use_proxy === '1' || formData.use_proxy === 1}
              onChange={handleFieldChange}
            />
            <Label check className="ml-1 mr-3">Yes</Label>
            <Input
              type="radio"
              name="use_proxy"
              value="0"
              checked={formData.use_proxy === false || formData.use_proxy === '0' || formData.use_proxy === 0}
              onChange={handleFieldChange}
            />
            <Label check className="ml-1">No</Label>
          </div>
        </FormGroup>
      </Col>
      <Col>
        <FormGroup>
          <Label for="folder">Folder</Label>
          <Input
            type="select"
            id="folder"
            name="folder"
            value={formData.folder || ''}
            onChange={handleFieldChange}
          >
            <option value="">Do not assign to a folder</option>
            {folders.map((folder) => (
              <option key={folder.folder_id} value={folder.folder_id}>
                {folder.name}
              </option>
            ))}
          </Input>
          <div className="mt-2">
            <Input
              type="text"
              placeholder="New folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              disabled={loading}
            />
            <Button
              color="primary"
              onClick={handleCreateFolder}
              disabled={creatingFolder || !newFolderName.trim()}
              className="ml-2"
            >
              {creatingFolder ? 'Creating...' : 'Add Folder'}
            </Button>
          </div>
          {error && <div className="text-danger mt-1">{error}</div>}
        </FormGroup>
      </Col>
      <Col>
        <FormGroup>
          <Label for="start_visibility">Start Visibility</Label>
          <Input
            type="date"
            id="start_visibility"
            name="start_visibility"
            value={formData.start_visibility || ''}
            onChange={handleFieldChange}
          />
        </FormGroup>
      </Col>
      <Col>
        <FormGroup>
          <Label for="end_visibility">End Visibility</Label>
          <Input
            type="date"
            id="end_visibility"
            name="end_visibility"
            value={formData.end_visibility || ''}
            onChange={handleFieldChange}
          />
        </FormGroup>
      </Col>
    </>
  );
};

PropTypes.AdditionalCommonFields = {
  handleFieldChange: PropTypes.func.isRequired,
  formData: PropTypes.object
};
