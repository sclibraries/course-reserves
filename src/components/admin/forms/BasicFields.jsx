// BasicFields.jsx
import React from 'react';
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
      <FormGroup check>
        <Label check>
          <Input
            type="checkbox"
            id="use_proxy"
            name="use_proxy"
            checked={formData.use_proxy}
            onChange={(e) => setFormField('use_proxy', e.target.checked)}
          />{' '}
          Use Proxy
        </Label>
      </FormGroup>
    </>
  );
};

BasicFields.propTypes = {
  formData: PropTypes.object.isRequired,
  setFormField: PropTypes.func.isRequired
};