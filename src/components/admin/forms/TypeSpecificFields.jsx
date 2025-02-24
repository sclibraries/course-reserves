import PropTypes from 'prop-types';
import { FormGroup, Label, Input } from 'reactstrap';

export const TypeSpecificFields = ({ metadata, handleFieldChange, materialTypeFields }) => {
  if (!materialTypeFields || materialTypeFields.length === 0) return null;

    

  return (
    <>
      {materialTypeFields.map((field) => {
        // Render radio buttons if field type is 'radio'
        if (field.type === 'radio' && Array.isArray(field.options)) {
          return (
            <FormGroup key={field.field_name}>
              <Label>{field.label}</Label><br />
              {field.options.map((opt) => (
                <div key={opt} style={{ display: 'inline-block', marginRight: '1rem' }}>
                  <Input
                    type="radio"
                    name={field.field_name}
                    value={opt}
                    checked={metadata[field.field_name] === opt}
                    onChange={handleFieldChange}
                  />
                  <Label check className="ml-1">{opt}</Label>
                </div>
              ))}
            </FormGroup>
          );
        }
        // Otherwise render as a standard text (or other type) input.
        return (
          <FormGroup key={field.field_name}>
            <Label for={field.field_name}>{field.label}</Label>
            <Input
              id={field.field_name}
              name={field.field_name}
              type={field.type || 'text'}
              value={metadata[field.field_name] || ''}
              onChange={handleFieldChange}
            />
          </FormGroup>
        );
      })}
    </>
  );
};

TypeSpecificFields.propTypes = {
  metadata: PropTypes.object.isRequired,
  handleFieldChange: PropTypes.func.isRequired,
  materialTypeFields: PropTypes.arrayOf(PropTypes.shape({
    field_name: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    type: PropTypes.string,
    options: PropTypes.arrayOf(PropTypes.string)
  })).isRequired
};