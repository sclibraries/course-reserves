import { useState, useEffect } from 'react';
import { Col, FormGroup, Label, Input, Button } from 'reactstrap';
import { useFolderManagement } from '../../../hooks/useFolderManagement';
import { useAdminCourseStore } from '../../../store/adminCourseStore';
import PropTypes from 'prop-types';

export const AdditionalCommonFields = ({ handleFieldChange, formData, setFormData }) => {
  const { folders, loading, error, createFolder } = useFolderManagement();
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const { folioCourseData } = useAdminCourseStore();

  useEffect(() => {
    if (folioCourseData) {
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
      const newFolder = await createFolder({ name: newFolderName });
      const value = {
        name: 'folder',
        value: newFolder.folder_id,
      };
      // Set the folder field in the form data to the newly created folder's id.
      handleFieldChange(value);
      setNewFolderName('');
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingFolder(false);
    }
  };

  return (
    <>
      <Col>
        <FormGroup>
          <Label>Use Proxy?</Label>
          <br />
          <div>
            <Input
              type="radio"
              name="use_proxy"
              value="1"
              checked={
                formData.use_proxy === true ||
                formData.use_proxy === '1' ||
                formData.use_proxy === 1
              }
              onChange={handleFieldChange}
            />
            <Label check className="ml-1 mr-3">
              Yes
            </Label>
            <Input
              type="radio"
              name="use_proxy"
              value="0"
              checked={
                formData.use_proxy === false ||
                formData.use_proxy === '0' ||
                formData.use_proxy === 0
              }
              onChange={handleFieldChange}
            />
            <Label check className="ml-1">
              No
            </Label>
          </div>
        </FormGroup>
      </Col>
      <Col>
        <FormGroup>
          <Label htmlFor="folder">Folder</Label>
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
          <Label htmlFor="start_visibility">Start Visibility</Label>
          <Input
            type="date"
            id="start_visibility"
            name="start_visibility"
            value={
              formData.start_visibility ||
              (folioCourseData
                ? new Date(folioCourseData?.courseListingObject?.termObject?.startDate)
                    .toISOString()
                    .split('T')[0]
                : '')
            }
            onChange={handleFieldChange}
          />
        </FormGroup>
      </Col>
      <Col>
        <FormGroup>
          <Label htmlFor="end_visibility">End Visibility</Label>
          <Input
            type="date"
            id="end_visibility"
            name="end_visibility"
            value={
              formData.end_visibility ||
              (folioCourseData
                ? new Date(folioCourseData?.courseListingObject?.termObject?.endDate)
                    .toISOString()
                    .split('T')[0]
                : '')
            }
            onChange={handleFieldChange}
          />
        </FormGroup>
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
    folder: PropTypes.string,
    start_visibility: PropTypes.string,
    end_visibility: PropTypes.string,
  }).isRequired,
};
