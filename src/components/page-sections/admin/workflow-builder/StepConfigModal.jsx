import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  Row,
  Col,
  Card,
  CardBody
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

/**
 * StepConfigModal - Configure individual workflow steps
 */
function StepConfigModal({ isOpen, step, onSave, onClose }) {
  const [formData, setFormData] = useState({
    step_name: '',
    step_type: 'action',
    description: '',
    required: true,
    due_date_offset: 7
  });

  useEffect(() => {
    if (step) {
      setFormData(step);
    } else {
      setFormData({
        step_name: '',
        step_type: 'action',
        description: '',
        required: true,
        due_date_offset: 7
      });
    }
  }, [step]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const stepTypes = [
    { value: 'action', label: 'Action', icon: 'fa-play', color: 'primary', description: 'A task that needs to be performed' },
    { value: 'decision', label: 'Decision', icon: 'fa-code-branch', color: 'warning', description: 'A choice point in the workflow' },
    { value: 'notification', label: 'Notification', icon: 'fa-bell', color: 'info', description: 'Send a notification or alert' },
    { value: 'assignment', label: 'Assignment', icon: 'fa-user-check', color: 'success', description: 'Assign to a user or role' },
    { value: 'approval', label: 'Approval', icon: 'fa-check-circle', color: 'danger', description: 'Requires approval to proceed' }
  ];

  return (
    <Modal isOpen={isOpen} toggle={onClose} size="lg">
      <ModalHeader toggle={onClose}>
        {step ? 'Edit Step' : 'Add New Step'}
      </ModalHeader>
      <Form onSubmit={handleSubmit}>
        <ModalBody>
          <FormGroup>
            <Label for="step_name">Step Name *</Label>
            <Input
              type="text"
              id="step_name"
              name="step_name"
              value={formData.step_name}
              onChange={handleChange}
              placeholder="e.g., Review submission"
              required
            />
          </FormGroup>

          <FormGroup>
            <Label>Step Type *</Label>
            <Row>
              {stepTypes.map(type => (
                <Col key={type.value} md={6} className="mb-3">
                  <Card
                    className={`cursor-pointer ${formData.step_type === type.value ? `border-${type.color} border-2` : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, step_type: type.value }))}
                    style={{ cursor: 'pointer' }}>
                    <CardBody className="p-3">
                      <div className="d-flex align-items-center">
                        <FontAwesomeIcon
                          icon={`fa-solid ${type.icon}`}
                          className={`text-${type.color} me-3`}
                          size="2x"
                        />
                        <div>
                          <h6 className="mb-0">{type.label}</h6>
                          <small className="text-muted">{type.description}</small>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </Col>
              ))}
            </Row>
          </FormGroup>

          <FormGroup>
            <Label for="description">Description</Label>
            <Input
              type="textarea"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Detailed description of this step"
            />
          </FormGroup>

          <Row>
            <Col md={6}>
              <FormGroup>
                <Label for="due_date_offset">Due Date (days from start)</Label>
                <Input
                  type="number"
                  id="due_date_offset"
                  name="due_date_offset"
                  value={formData.due_date_offset}
                  onChange={handleChange}
                  min={1}
                />
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup check className="mt-4">
                <Label check>
                  <Input
                    type="checkbox"
                    name="required"
                    checked={formData.required}
                    onChange={handleChange}
                  />
                  {' '}Required Step
                </Label>
              </FormGroup>
            </Col>
          </Row>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button color="primary" type="submit">
            <FontAwesomeIcon icon="fa-solid fa-save" className="me-2" />
            Save Step
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
}

StepConfigModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  step: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
};

export default StepConfigModal;
