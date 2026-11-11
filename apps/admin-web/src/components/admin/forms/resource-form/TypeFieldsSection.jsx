import PropTypes from 'prop-types';
import TypeSpecificFields from '../fields/TypeSpecificFields';

export const TypeFieldsSection = ({ materialTypeFields, metadata, handleFieldChange, readOnly = false }) => (
  <section aria-labelledby="type-fields-title" className="tw-min-w-0 tw-space-y-3">
    <h4 id="type-fields-title" className="tw-text-base tw-font-medium">Type-specific fields</h4>
    <fieldset disabled={readOnly} className="tw-m-0 tw-min-w-0 tw-border-0 tw-p-0">
      <legend className="tw-sr-only">Shared type-specific fields</legend>
      <TypeSpecificFields
        materialTypeFields={materialTypeFields}
        metadata={metadata}
        handleFieldChange={handleFieldChange}
      />
    </fieldset>
  </section>
);

TypeFieldsSection.propTypes = {
  materialTypeFields: PropTypes.array,
  metadata: PropTypes.object,
  handleFieldChange: PropTypes.func.isRequired,
  readOnly: PropTypes.bool,
};

export default TypeFieldsSection;
