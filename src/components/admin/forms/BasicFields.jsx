// BasicFields.jsx
import { FormGroup, Label, Input } from 'reactstrap';
import PropTypes from 'prop-types';

export const BasicFields = ({ formData, setFormField }) => {
  return (
    <>
      <FormGroup>
        <Label for="name">Name</Label>
        <Input
          type="text"
          id="name"
          name="name"
          value={formData.name || ''}
          onChange={(e) => setFormField('name', e.target.value)}
        />
      </FormGroup>
      <FormGroup>
        <Label for="item_url">Item URL</Label>
        <Input
          type="url"
          id="item_url"
          name="item_url"
          value={formData.item_url || ''}
          onChange={(e) => setFormField('item_url', e.target.value)}
        />
      </FormGroup>
    </>
  );
};

BasicFields.propTypes = {
  formData: PropTypes.object.isRequired,
  setFormField: PropTypes.func.isRequired
};
