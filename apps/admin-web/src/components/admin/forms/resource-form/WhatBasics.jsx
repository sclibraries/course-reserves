import PropTypes from 'prop-types';
import { BookOpen } from 'lucide-react';
import ResourceBasicFields from '../common/ResourceBasicFields';
import ResourceTypeSelector from '../common/ResourceTypeSelector';
import { ResourceFormSection } from './ResourceFormSection';

export const WhatBasics = ({ formData, handleFieldChange, materialTypes, onTypeChange }) => (
  <ResourceFormSection id="what-is-it" title="What is it?" icon={BookOpen}>
    <ResourceTypeSelector
      materialTypes={materialTypes}
      selectedTypeId={formData.material_type_id}
      onTypeChange={onTypeChange}
    />
    <ResourceBasicFields formData={formData} handleFieldChange={handleFieldChange} />
  </ResourceFormSection>
);

WhatBasics.propTypes = {
  formData: PropTypes.object.isRequired,
  handleFieldChange: PropTypes.func.isRequired,
  materialTypes: PropTypes.array.isRequired,
  onTypeChange: PropTypes.func.isRequired,
};
