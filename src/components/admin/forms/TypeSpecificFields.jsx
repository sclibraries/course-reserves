import PropTypes from 'prop-types';
import { Row, Col, FormGroup, Label, Input, Card, CardHeader, CardBody, Alert } from 'reactstrap';
import { FaBook, FaInfoCircle } from 'react-icons/fa';
import '../../../css/AdminForms.css';

/**
 * TypeSpecificFields component
 * 
 * Renders dynamic form fields based on the selected material type
 */
export const TypeSpecificFields = ({ materialTypeFields, metadata = {}, handleFieldChange }) => {
  // If no fields are available, show a message
  if (!materialTypeFields || materialTypeFields.length === 0) {
    return (
      <Alert color="info" className="mb-0">
        <FaInfoCircle className="me-2" />
        Select a material type to see specific fields.
      </Alert>
    );
  }

  // Group fields by category for better organization
  const fieldsByCategory = materialTypeFields.reduce((acc, field) => {
    const category = field.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(field);
    return acc;
  }, {});

  // Get the field value, checking metadata first then falling back to the field's default value
  const getFieldValue = (fieldName) => {
    return metadata[fieldName] !== undefined ? metadata[fieldName] : '';
  };

  // Render the appropriate input field based on its type
  const renderField = (field) => {
    const { field_name, field_type, label = field_name, description, required, options_json } = field;
    
    switch (field_type) {
      case 'text':
      case 'textField':
        return (
          <Input
            type="text"
            id={field_name}
            name={field_name}
            value={getFieldValue(field_name)}
            onChange={handleFieldChange}
            required={required}
            placeholder={description}
            className="form-control"
          />
        );
      
      case 'number':
        return (
          <Input
            type="number"
            id={field_name}
            name={field_name}
            value={getFieldValue(field_name)}
            onChange={handleFieldChange}
            required={required}
            placeholder={description}
            className="form-control"
          />
        );
      
      case 'textarea':
        return (
          <Input
            type="textarea"
            id={field_name}
            name={field_name}
            value={getFieldValue(field_name)}
            onChange={handleFieldChange}
            required={required}
            placeholder={description}
            className="form-control"
            rows={3}
          />
        );
        
        case 'select': {
          let options = [];
          try {
            options = options_json ? JSON.parse(options_json) : [];
          } catch (e) {
            console.error('Failed to parse options JSON', e);
          }
        
          return (
            <Input
              type="select"
              id={field_name}
              name={field_name}
              value={getFieldValue(field_name)}
              onChange={handleFieldChange}
              required={required}
              className="form-select"
            >
              <option value="">-- Select --</option>
              {options.map((opt, idx) => (
                <option key={idx} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Input>
          );
        }
        
        
      case 'checkbox':
        return (
          <div className="form-check">
            <Input
              type="checkbox"
              id={field_name}
              name={field_name}
              checked={!!getFieldValue(field_name)}
              onChange={(e) => {
                const event = {
                  target: {
                    name: field_name,
                    value: e.target.checked,
                    type: 'checkbox',
                    checked: e.target.checked,
                  },
                };
                handleFieldChange(event);
              }}
              required={required}
              className="form-check-input"
            />
            <Label for={field_name} check className="form-check-label">
              {description || label}
            </Label>
          </div>
        );
        
      default:
        return (
          <Input
            type="text"
            id={field_name}
            name={field_name}
            value={getFieldValue(field_name)}
            onChange={handleFieldChange}
            required={required}
            placeholder={description}
            className="form-control"
          />
        );
    }
  };

  return (
    <div className="type-specific-fields">
      {Object.entries(fieldsByCategory).map(([category, fields], categoryIndex) => (
        <Card key={categoryIndex} className="mb-4 type-fields-card">
          <CardHeader className="bg-light py-2">
            <h5 className="mb-0 d-flex align-items-center">
              <FaBook className="me-2" /> 
              {category}
            </h5>
          </CardHeader>
          <CardBody>
            <Row>
              {fields.map((field, fieldIndex) => {
                // Determine column width based on field type
                const colWidth = field.field_type === 'textarea' ? 12 : 
                                (field.field_type === 'checkbox' ? 6 : 6);
                
                return (
                  <Col md={colWidth} key={fieldIndex}>
                    <FormGroup className="mb-3">
                      {field.field_type !== 'checkbox' && (
                        <Label for={field.field_name} className="form-label">
                          {field.label || field.field_name}
                          {field.required && <span className="text-danger ms-1">*</span>}
                        </Label>
                      )}
                      {renderField(field)}
                      {field.description && field.field_type !== 'checkbox' && (
                        <small className="form-text text-muted">{field.description}</small>
                      )}
                    </FormGroup>
                  </Col>
                );
              })}
            </Row>
          </CardBody>
        </Card>
      ))}
    </div>
  );
};

TypeSpecificFields.propTypes = {
  materialTypeFields: PropTypes.arrayOf(
    PropTypes.shape({
      mt_field_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      field_name: PropTypes.string.isRequired,
      field_type: PropTypes.string.isRequired,
      label: PropTypes.string,
      description: PropTypes.string,
      required: PropTypes.bool,
      options_json: PropTypes.string,
      category: PropTypes.string,
    })
  ),
  metadata: PropTypes.object,
  handleFieldChange: PropTypes.func.isRequired,
};

export default TypeSpecificFields;