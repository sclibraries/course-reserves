import PropTypes from 'prop-types';
import { BookOpen } from 'lucide-react';
import ResourceBasicFields from '../common/ResourceBasicFields';
import ResourceTypeSelector from '../common/ResourceTypeSelector';
import { ResourceFormSection } from './ResourceFormSection';
import TypeFieldsSection from './TypeFieldsSection';

export const WhatBasics = ({ formData, handleFieldChange, materialTypes, onTypeChange, materialTypeFields, titleError }) => (
  <ResourceFormSection id="what-is-it" title="What is it?" icon={BookOpen}>
    <ResourceTypeSelector
      materialTypes={materialTypes}
      selectedTypeId={formData.material_type_id}
      onTypeChange={onTypeChange}
    />
    <ResourceBasicFields formData={formData} handleFieldChange={handleFieldChange} titleError={titleError} />
    {formData.material_type_id && (
      <TypeFieldsSection
        materialTypeFields={materialTypeFields}
        metadata={formData.metadata}
        handleFieldChange={handleFieldChange}
      />
    )}
  </ResourceFormSection>
);

WhatBasics.propTypes = {
  formData: PropTypes.object.isRequired,
  handleFieldChange: PropTypes.func.isRequired,
  materialTypes: PropTypes.array.isRequired,
  onTypeChange: PropTypes.func.isRequired,
  materialTypeFields: PropTypes.array,
  titleError: PropTypes.string,
};
