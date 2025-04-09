import PropTypes from 'prop-types';
import { FormGroup, Label, Input, Row, Col } from 'reactstrap';
import { ProxyToggle } from './ProxyToggle';

/**
 * ResourceBasicFields - Common fields for all resource types
 */
export const ResourceBasicFields = ({ formData, handleFieldChange }) => {
  return (
    <>
      {/* Resource Name */}
      <FormGroup>
        <Label for="title" className="required">Resource Name</Label>
        <Input
          id="title"
          name="title"
          value={formData.title || ''}
          onChange={handleFieldChange}
          placeholder="Enter resource name"
          required
        />
      </FormGroup>
      
      {/* Primary URL */}
      <FormGroup>
        <Label for="link">Primary URL</Label>
        <Input
          id="link"
          name="link"
          value={formData.link || ''}
          onChange={handleFieldChange}
          placeholder="https://example.com"
        />
      </FormGroup>
      
      {/* Use Proxy Toggle */}
      <ProxyToggle 
        name="use_proxy"
        checked={formData.use_proxy || false} 
        onChange={handleFieldChange} 
      />

      {/* Description */}
      <FormGroup>
        <Label for="notes">Description</Label>
        <Input
          id="notes"
          name="notes"
          type="textarea"
          value={formData.notes || ''}
          onChange={handleFieldChange}
          placeholder="Enter a description of this resource"
          rows={3}
        />
      </FormGroup>
      
      {/* Internal and External Notes - Side by Side */}
      <Row>
        <Col md={6}>
          <FormGroup>
            <Label for="internal_note">Internal Note (Staff Only)</Label>
            <Input
              id="internal_note"
              name="internal_note"
              type="textarea"
              value={formData.internal_note || ''}
              onChange={handleFieldChange}
              placeholder="Notes visible only to staff"
              rows={2}
            />
          </FormGroup>
        </Col>
        
        <Col md={6}>
          <FormGroup>
            <Label for="external_note">External Note (Visible to Users)</Label>
            <Input
              id="external_note"
              name="external_note"
              type="textarea"
              value={formData.external_note || ''}
              onChange={handleFieldChange}
              placeholder="Notes visible to users"
              rows={2}
            />
          </FormGroup>
        </Col>
      </Row>
    </>
  );
};

ResourceBasicFields.propTypes = {
  formData: PropTypes.shape({
    title: PropTypes.string,
    link: PropTypes.string,
    use_proxy: PropTypes.bool,
    notes: PropTypes.string,
    internal_note: PropTypes.string,
    external_note: PropTypes.string
  }).isRequired,
  handleFieldChange: PropTypes.func.isRequired
};

export default ResourceBasicFields;
