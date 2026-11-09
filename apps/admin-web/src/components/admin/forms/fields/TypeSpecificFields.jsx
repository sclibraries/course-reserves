import PropTypes from 'prop-types';
import { Info } from 'lucide-react';
import { Alert } from '../../../ui/alert';
import { Card, CardContent, CardHeader } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import NativeSelect from '../../../ui/native-select';
import { Textarea } from '../../../ui/textarea';

export const TypeSpecificFields = ({ materialTypeFields = [], metadata = {}, handleFieldChange }) => {
  if (!materialTypeFields.length) {
    return (
      <Alert className="tw-flex tw-items-center tw-gap-2">
        <Info aria-hidden="true" className="tw-size-4" />
        No fields are defined for this material type.
      </Alert>
    );
  }

  const fieldsByCategory = materialTypeFields.reduce((categories, field) => {
    const category = field.category || 'General';
    categories[category] ||= [];
    categories[category].push(field);
    return categories;
  }, {});

  const renderField = (field) => {
    const { field_name: name, field_type: type, label = name, description, required, options_json: optionsJson } = field;
    const value = metadata[name] ?? '';

    if (type === 'checkbox') {
      return (
        <div className="tw-flex tw-items-center tw-gap-2">
          <input
            id={name}
            name={name}
            type="checkbox"
            checked={!!value}
            onChange={handleFieldChange}
            required={required}
            className="tw-size-6 tw-rounded tw-border-input tw-accent-primary focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring focus-visible:tw-ring-offset-2"
          />
          <Label htmlFor={name}>{description || label}</Label>
        </div>
      );
    }

    const describedBy = description ? `${name}-description` : undefined;
    if (type === 'select') {
      let options = [];
      try {
        options = optionsJson ? JSON.parse(optionsJson) : [];
      } catch (error) {
        console.error('Failed to parse options JSON', error);
      }
      return (
        <NativeSelect id={name} name={name} value={value} onChange={handleFieldChange} required={required} aria-describedby={describedBy}>
          <option value="">-- Select --</option>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </NativeSelect>
      );
    }

    const controlProps = {
      id: name,
      name,
      value,
      onChange: handleFieldChange,
      required,
      placeholder: description,
      'aria-describedby': describedBy,
    };
    return type === 'textarea'
      ? <Textarea {...controlProps} rows={3} />
      : <Input {...controlProps} type={type === 'number' ? 'number' : 'text'} />;
  };

  return (
    <div className="tw-min-w-0 tw-space-y-3">
      {Object.entries(fieldsByCategory).map(([category, fields]) => (
        <Card key={category} className="tw-min-w-0">
          <CardHeader className="tw-p-4 tw-pb-2">
            <h5 className="tw-font-medium">{category}</h5>
          </CardHeader>
          <CardContent className="tw-grid tw-min-w-0 tw-grid-cols-1 tw-gap-4 tw-p-4 tw-pt-0 md:tw-grid-cols-2">
            {fields.map((field) => (
              <div key={field.field_name} className={`tw-min-w-0 tw-space-y-2 ${field.field_type === 'textarea' ? 'md:tw-col-span-2' : ''}`}>
                {field.field_type !== 'checkbox' && (
                  <Label htmlFor={field.field_name}>
                    {field.label || field.field_name}
                    {field.required && <span aria-hidden="true" className="tw-ml-1 tw-text-destructive">*</span>}
                  </Label>
                )}
                {renderField(field)}
                {field.description && field.field_type !== 'checkbox' && (
                  <p id={`${field.field_name}-description`} className="tw-text-sm tw-text-muted-foreground">{field.description}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

TypeSpecificFields.propTypes = {
  materialTypeFields: PropTypes.arrayOf(PropTypes.shape({
    field_name: PropTypes.string.isRequired,
    field_type: PropTypes.string.isRequired,
    label: PropTypes.string,
    description: PropTypes.string,
    required: PropTypes.bool,
    options_json: PropTypes.string,
    category: PropTypes.string,
  })),
  metadata: PropTypes.object,
  handleFieldChange: PropTypes.func.isRequired,
};

export default TypeSpecificFields;
