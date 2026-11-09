import PropTypes from 'prop-types';
import { GraduationCap } from 'lucide-react';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import FolderSelector from '../common/FolderSelector';
import { ResourceFormSection } from './ResourceFormSection';

export const StudentSection = ({
  formData,
  handleFieldChange,
  handleFolderChange,
  setFormData,
  sharedEditWarning,
}) => (
  <ResourceFormSection id="what-students-see" title="What do students see?" icon={GraduationCap}>
    <div className="tw-space-y-2">
      <Label htmlFor="notes">Description</Label>
      <Textarea
        id="notes"
        name="notes"
        value={formData.notes || ''}
        onChange={handleFieldChange}
        placeholder="Enter a description of this resource"
        rows={3}
      />
    </div>
    <div className="tw-space-y-2">
      <Label htmlFor="external_note">Note for students</Label>
      <Textarea
        id="external_note"
        name="external_note"
        value={formData.external_note || ''}
        onChange={handleFieldChange}
        placeholder="Notes visible to students"
        rows={2}
      />
    </div>
    {sharedEditWarning}
    <FolderSelector
      selectedFolder={formData.folder}
      handleFolderChange={handleFolderChange}
      setFormData={setFormData}
    />
  </ResourceFormSection>
);

StudentSection.propTypes = {
  formData: PropTypes.object.isRequired,
  handleFieldChange: PropTypes.func.isRequired,
  handleFolderChange: PropTypes.func.isRequired,
  setFormData: PropTypes.func.isRequired,
  sharedEditWarning: PropTypes.node,
};
