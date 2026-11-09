import PropTypes from 'prop-types';
import TypeSpecificFields from '../fields/TypeSpecificFields';

export const TypeFieldsSection = ({ materialTypeFields, metadata, handleFieldChange }) => (
  <section aria-labelledby="type-fields-title" className="tw-min-w-0 tw-space-y-3">
    <h4 id="type-fields-title" className="tw-text-base tw-font-medium">Type-specific fields</h4>
    <TypeSpecificFields
      materialTypeFields={materialTypeFields}
      metadata={metadata}
      handleFieldChange={handleFieldChange}
    />
  </section>
);

TypeFieldsSection.propTypes = {
  materialTypeFields: PropTypes.array,
  metadata: PropTypes.object,
  handleFieldChange: PropTypes.func.isRequired,
};

export default TypeFieldsSection;
