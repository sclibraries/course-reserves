import { useState } from 'react';
import PropTypes from 'prop-types';
import { Folder } from 'lucide-react';
import { Alert } from '../../../ui/alert';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import NativeSelect from '../../../ui/native-select';
import { useFolderManagement } from '../../../../hooks/useFolderManagement';

export const FolderSelector = ({ selectedFolder, handleFolderChange, setFormData }) => {
  const { folders, loading, error, createFolder } = useFolderManagement();
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [createError, setCreateError] = useState(null);
  const fieldError = createError || error;
  const fieldId = showNewFolderInput ? 'new-folder-name' : 'folder';

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);
    setCreateError(null);
    try {
      const newFolder = await createFolder({ name: newFolderName.trim() });
      if (setFormData) {
        setFormData(prev => ({ ...prev, folder: newFolder.folder_id }));
      } else {
        handleFolderChange({ target: { name: 'folder', value: newFolder.folder_id } });
      }
      setNewFolderName('');
      setShowNewFolderInput(false);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFolderDropdownChange = (event) => {
    if (event.target.value === '__new__') {
      setCreateError(null);
      setShowNewFolderInput(true);
      return;
    }
    handleFolderChange(event);
  };

  return (
    <div className="tw-space-y-2">
      <Label htmlFor={fieldId} className="tw-flex tw-items-center tw-gap-2">
        <Folder aria-hidden="true" className="tw-size-4" />
        {showNewFolderInput ? 'New folder name' : 'Folder'}
      </Label>
      {!showNewFolderInput ? (
        <NativeSelect
          id="folder"
          name="folder"
          value={selectedFolder || ''}
          onChange={handleFolderDropdownChange}
          disabled={loading}
          aria-describedby={fieldError ? 'folder-error' : undefined}
        >
          <option value="">-- Select Folder --</option>
          {folders.map(folder => (
            <option key={folder.folder_id} value={folder.folder_id}>{folder.name}</option>
          ))}
          <option value="__new__">+ Create new folder</option>
        </NativeSelect>
      ) : (
        <div className="tw-flex tw-flex-wrap tw-gap-2">
          <Input
            id="new-folder-name"
            value={newFolderName}
            onChange={event => setNewFolderName(event.target.value)}
            placeholder="Enter new folder name"
            disabled={creatingFolder}
            aria-describedby={fieldError ? 'folder-error' : undefined}
          />
          <Button type="button" onClick={handleCreateFolder} disabled={!newFolderName.trim() || creatingFolder}>
            {creatingFolder ? 'Adding...' : 'Add'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowNewFolderInput(false);
              setNewFolderName('');
              setCreateError(null);
            }}
            disabled={creatingFolder}
          >
            Cancel
          </Button>
        </div>
      )}
      {loading && <p role="status" className="tw-text-sm tw-text-muted-foreground">Loading folders...</p>}
      {fieldError && <Alert id="folder-error" variant="destructive" className="tw-p-2 tw-text-sm">{fieldError}</Alert>}
    </div>
  );
};

FolderSelector.propTypes = {
  selectedFolder: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  handleFolderChange: PropTypes.func.isRequired,
  setFormData: PropTypes.func,
};

export default FolderSelector;
