import PropTypes from 'prop-types';
import { Shield } from 'lucide-react';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import { ResourceFormSection } from './ResourceFormSection';

export const StaffSection = ({ formData, handleFieldChange, readOnly = false }) => (
  <ResourceFormSection id="staff-only" title="Staff only" icon={Shield}>
    <fieldset disabled={readOnly} className="tw-m-0 tw-min-w-0 tw-border-0 tw-p-0">
      <legend className="tw-sr-only">Shared staff note</legend>
      <div className="tw-space-y-2">
        <Label htmlFor="internal_note">Internal note</Label>
        <Textarea
          id="internal_note"
          name="internal_note"
          value={formData.internal_note || ''}
          onChange={handleFieldChange}
          placeholder="Notes visible only to staff"
          rows={2}
        />
      </div>
    </fieldset>
  </ResourceFormSection>
);

StaffSection.propTypes = {
  formData: PropTypes.object.isRequired,
  handleFieldChange: PropTypes.func.isRequired,
  readOnly: PropTypes.bool,
};
