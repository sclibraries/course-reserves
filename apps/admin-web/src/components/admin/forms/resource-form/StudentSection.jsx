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
  readOnly = false,
}) => (
  <ResourceFormSection id="what-students-see" title="What do students see?" icon={GraduationCap}>
    {sharedEditWarning}
    <fieldset disabled={readOnly} className="tw-m-0 tw-min-w-0 tw-space-y-4 tw-border-0 tw-p-0">
      <legend className="tw-sr-only">Shared student and folder details</legend>
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
      <FolderSelector
        selectedFolder={formData.folder}
        handleFolderChange={handleFolderChange}
        setFormData={setFormData}
      />
    </fieldset>
  </ResourceFormSection>
);

StudentSection.propTypes = {
  formData: PropTypes.object.isRequired,
  handleFieldChange: PropTypes.func.isRequired,
  handleFolderChange: PropTypes.func.isRequired,
  setFormData: PropTypes.func.isRequired,
  sharedEditWarning: PropTypes.node,
  readOnly: PropTypes.bool,
};
