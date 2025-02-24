import { useState } from 'react';
import PropTypes from 'prop-types';
import { Form, FormGroup, Label, Input, Button } from 'reactstrap';
import { MATERIAL_TYPES } from '../../constants/admin';

export const AdminElectronicResourceForm = ({ onSubmit, initialData = {}, buttonText = 'Save' }) => {
  const [formData, setFormData] = useState({
    title: initialData.title || '',
    link: initialData.link || '',
    notes: initialData.notes || '',
    material_type: initialData.material_type || ''
  });

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Form onSubmit={handleSubmit}>
      <FormGroup>
        <Label>Title</Label>
        <Input
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
        />
      </FormGroup>
      <FormGroup>
        <Label>Link (URL)</Label>
        <Input
          name="link"
          value={formData.link}
          onChange={handleChange}
        />
      </FormGroup>
      <FormGroup>
        <Label>Notes</Label>
        <Input
          type="textarea"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
        />
      </FormGroup>
      <FormGroup>
        <Label>Material Type</Label>
        <Input
          type="select"
          name="material_type"
          value={formData.material_type}
          onChange={handleChange}
        >
          <option value="">--Select--</option>
          {Object.entries(MATERIAL_TYPES).map(([key, value]) => (
            <option key={key} value={key}>{value}</option>
          ))}
        </Input>
      </FormGroup>
      <Button color="primary" type="submit">
        {buttonText}
      </Button>
    </Form>
  );
};

AdminElectronicResourceForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  buttonText: PropTypes.string
};
