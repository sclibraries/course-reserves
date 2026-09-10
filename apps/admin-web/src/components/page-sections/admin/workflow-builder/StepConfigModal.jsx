import { useState, useEffect, useMemo } from 'react';
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
  CardBody,
  Alert,
  Badge
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

/**
 * StepConfigModal - Configure individual workflow steps
 */
function StepConfigModal({ isOpen, step, allSteps, currentIndex, onSave, onClose }) {
  const defaultStep = useMemo(() => ({
    step_key: '',
    step_name: '',
    step_type: 'action',
    description: '',
    is_required: true,
    is_automated: false,
    is_gate: false,
    depends_on: [],
    automation_handler: '',
    automation_config: {},
    due_date_offset: null,
    assigned_role: null,
    estimated_duration_minutes: null,
    instructions: '',
    metadata: {},
    form_fields: []
  }), []);

  const [formData, setFormData] = useState(defaultStep);
  const [validationError, setValidationError] = useState(null);

  const stepIdentifier = useMemo(() => {
    if (!step) return null;
    return step.id ?? step.local_id ?? step.sequence_order ?? currentIndex;
  }, [step, currentIndex]);

  const availableDependencies = useMemo(() => {
    if (!Array.isArray(allSteps)) return [];

    return allSteps
      .map((candidate, idx) => ({
        value: candidate.id ?? candidate.local_id ?? candidate.sequence_order ?? idx,
        label: candidate.step_name || `Step ${idx + 1}`,
        index: idx,
        sequence_order: candidate.sequence_order ?? candidate.step_order ?? idx + 1
      }))
      .filter(({ index, value }) => {
        if (index === currentIndex) {
          return false;
        }
        // Only allow dependencies on steps that come before the current one
        return index < currentIndex && value !== stepIdentifier;
      });
  }, [allSteps, currentIndex, stepIdentifier]);

  useEffect(() => {
    if (step) {
      setFormData({
        ...defaultStep,
        ...step,
        step_key: step.step_key || step.step_name || '',
        is_required: step.is_required === 1 || step.is_required === true,
        is_automated: step.is_automated === 1 || step.is_automated === true,
        is_gate: step.is_gate === 1 || step.is_gate === true,
        depends_on: Array.isArray(step.depends_on)
          ? step.depends_on.map((dep) => {
              const numeric = Number(dep);
              return Number.isNaN(numeric) ? dep : numeric;
            })
          : [],
        automation_handler: step.automation_handler || '',
        automation_config: typeof step.automation_config === 'object' && step.automation_config !== null
          ? step.automation_config
          : {},
        metadata: typeof step.metadata === 'object' && step.metadata !== null
          ? step.metadata
          : {},
        form_fields: Array.isArray(step.form_fields) ? step.form_fields : []
      });
    } else {
      setFormData(defaultStep);
    }
    setValidationError(null);
  }, [step, defaultStep]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // If user tries to uncheck required on a gate step, ignore – gates are always required
    if (name === 'is_required' && formData.is_gate) {
      return;
    }

    let nextValue = type === 'checkbox' ? checked : value;

    // If gate is toggled on, force required = true
    if (name === 'is_gate') {
      nextValue = checked;
    }

    setFormData(prev => ({
      ...prev,
      [name]: nextValue,
      ...(name === 'is_gate' && checked ? { is_required: true } : {})
    }));
  };

  const handleDependenciesChange = (event) => {
    const selected = Array.from(event.target.selectedOptions).map((option) => {
      const numericValue = Number(option.value);
      return Number.isNaN(numericValue) ? option.value : numericValue;
    });
    setFormData((prev) => ({
      ...prev,
      depends_on: selected
    }));
  };

  const validateForm = () => {
    if (!formData.step_name.trim()) {
      return 'Step name is required.';
    }

    if (formData.is_automated && !formData.automation_handler.trim()) {
      return 'Automated steps must have a handler key.';
    }

    if (formData.is_gate && !formData.is_required) {
      return 'Gate steps must be marked as required.';
    }

    const dependencyValues = Array.isArray(formData.depends_on) ? formData.depends_on : [];
    if (dependencyValues.some((dep) => dep === stepIdentifier)) {
      return 'A step cannot depend on itself.';
    }

    // Ensure dependencies only reference earlier steps
    const invalidDependency = dependencyValues.find((dep) => {
      const candidate = availableDependencies.find((option) => option.value === dep);
      return !candidate;
    });

    if (invalidDependency !== undefined) {
      return 'Dependencies can only reference steps that come earlier in the workflow.';
    }

    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errorMessage = validateForm();
    if (errorMessage) {
      setValidationError(errorMessage);
      return;
    }

    const sanitizedDependsOn = Array.isArray(formData.depends_on)
      ? formData.depends_on.map((dep) => {
          const numeric = Number(dep);
          return Number.isNaN(numeric) ? dep : numeric;
        })
      : [];

    const parsedDueDate = formData.due_date_offset === '' || formData.due_date_offset === null
      ? null
      : Number(formData.due_date_offset);

    const parsedEstimatedDuration = formData.estimated_duration_minutes === '' || formData.estimated_duration_minutes === null
      ? null
      : Number(formData.estimated_duration_minutes);

    let parsedAutomationConfig = {};
    if (typeof formData.automation_config === 'string') {
      try {
        parsedAutomationConfig = formData.automation_config.trim() ? JSON.parse(formData.automation_config) : {};
      } catch {
        setValidationError('Automation config must be valid JSON.');
        return;
      }
    } else if (typeof formData.automation_config === 'object' && formData.automation_config !== null) {
      parsedAutomationConfig = formData.automation_config;
    }

    let parsedMetadata = {};
    if (typeof formData.metadata === 'string') {
      try {
        parsedMetadata = formData.metadata.trim() ? JSON.parse(formData.metadata) : {};
      } catch {
        setValidationError('Metadata must be valid JSON.');
        return;
      }
    } else if (typeof formData.metadata === 'object' && formData.metadata !== null) {
      parsedMetadata = formData.metadata;
    }

    let parsedFormFields = [];
    if (Array.isArray(formData.form_fields)) {
      parsedFormFields = formData.form_fields;
    } else if (typeof formData.form_fields === 'string') {
      const trimmed = formData.form_fields.trim();
      if (trimmed) {
        try {
          const parsed = JSON.parse(trimmed);
          parsedFormFields = Array.isArray(parsed) ? parsed : [];
        } catch {
          setValidationError('Form fields must be valid JSON representing an array.');
          return;
        }
      }
    }

    const payload = {
      ...formData,
      step_key: formData.step_key?.trim() || formData.step_name,
      is_required: Boolean(formData.is_required),
      is_automated: Boolean(formData.is_automated),
      is_gate: Boolean(formData.is_gate),
      automation_handler: formData.automation_handler?.trim() || '',
      depends_on: sanitizedDependsOn,
      due_date_offset: Number.isNaN(parsedDueDate) ? null : parsedDueDate,
      estimated_duration_minutes: Number.isNaN(parsedEstimatedDuration) ? null : parsedEstimatedDuration,
      automation_config: parsedAutomationConfig,
      metadata: parsedMetadata,
      form_fields: parsedFormFields
    };

    onSave(payload);
  };

  const stepTypes = [
    {
      value: 'action',
      label: 'Action',
      icon: 'fa-play',
      color: 'primary',
      description: 'A task someone must do (default).'
    },
    {
      value: 'decision',
      label: 'Decision',
      icon: 'fa-code-branch',
      color: 'warning',
      description: 'A choice that sends the workflow down different paths.'
    },
    {
      value: 'notification',
      label: 'Notification',
      icon: 'fa-bell',
      color: 'info',
      description: 'Send an FYI or alert, no work needed.'
    },
    {
      value: 'assignment',
      label: 'Assignment',
      icon: 'fa-user-check',
      color: 'success',
      description: 'Assign work to a person or role.'
    },
    {
      value: 'approval',
      label: 'Approval',
      icon: 'fa-check-circle',
      color: 'danger',
      description: 'Someone must approve before things continue.'
    }
  ];

  return (
    <Modal isOpen={isOpen} toggle={onClose} size="lg">
      <ModalHeader toggle={onClose}>
        {step ? 'Edit Step' : 'Add New Step'}
      </ModalHeader>
      <Form onSubmit={handleSubmit}>
        <ModalBody>
          {validationError && (
            <Alert color="danger" toggle={() => setValidationError(null)}>
              <FontAwesomeIcon icon="fa-solid fa-triangle-exclamation" className="me-2" />
              {validationError}
            </Alert>
          )}

          {/* Section A: Basic step info */}
          <Card className="mb-3">
            <CardBody>
              <h5 className="mb-1">Basic Details</h5>
              <small className="text-muted d-block mb-3">
                Give this step a clear name and type so staff know what they’re doing.
              </small>

              <FormGroup>
                <Label for="step_name">Step name *</Label>
                <Input
                  type="text"
                  id="step_name"
                  name="step_name"
                  value={formData.step_name}
                  onChange={handleChange}
                  placeholder="e.g., Verify course in FOLIO"
                  required
                />
                <small className="text-muted">
                  What staff will see in the checklist (e.g., ‘Verify course in FOLIO’, ‘Email instructor’).
                </small>
              </FormGroup>

              {/* Step Type and Key hidden for simplicity */}
              <div className="d-none">
                <FormGroup className="mt-3">
                  <Label>Step type *</Label>
                  <Input type="text" name="step_type" value={formData.step_type} readOnly />
                </FormGroup>
                <FormGroup className="mt-3">
                  <Label for="step_key">Step key (internal)</Label>
                  <Input
                    type="text"
                    id="step_key"
                    name="step_key"
                    value={formData.step_key}
                    onChange={handleChange}
                    readOnly={Boolean(step)}
                  />
                </FormGroup>
              </div>

              <FormGroup className="mt-3">
                <Label for="description">Description</Label>
                <Input
                  type="textarea"
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Optional longer description to help staff understand the context of this step."
                />
              </FormGroup>
            </CardBody>
          </Card>

          {/* Section B: Completion rules */}
          <Card className="mb-3">
            <CardBody>
              <h5 className="mb-1">Step Rules</h5>
              <small className="text-muted d-block mb-3">
                Control whether this step is required and whether it blocks later steps.
              </small>

              <Row>
                <Col md={12}>
                  <FormGroup check className="mb-2">
                    <Label check title="Must be completed before the workflow can finish.">
                      <Input
                        type="checkbox"
                        name="is_required"
                        checked={Boolean(formData.is_required)}
                        onChange={handleChange}
                        disabled={Boolean(formData.is_gate)}
                      />
                      {' '}Required step
                    </Label>
                  </FormGroup>
                </Col>
              </Row>

              <Row className="mt-2">
                <Col md={12}>
                  <FormGroup check>
                    <Label check title="Blocks all later steps until this one is completed.">
                      <Input
                        type="checkbox"
                        name="is_gate"
                        checked={Boolean(formData.is_gate)}
                        onChange={handleChange}
                      />
                      {' '}Gate step (blocks later steps)
                    </Label>
                  </FormGroup>
                </Col>
              </Row>

              <Row className="mt-3">
                <Col md={6}>
                  <FormGroup>
                    <Label for="assigned_role">Assigned Role</Label>
                    <Input
                      type="text"
                      id="assigned_role"
                      name="assigned_role"
                      value={formData.assigned_role || ''}
                      onChange={handleChange}
                      placeholder="e.g., reserves_staff"
                    />
                    <small className="text-muted">
                      Role that normally owns this step (e.g., `reserves_staff`).
                    </small>
                  </FormGroup>
                </Col>
              </Row>
            </CardBody>
          </Card>

          {/* Technical sections hidden for simplicity */}
          <div className="d-none">
            {/* Automation section */}
            <Input type="checkbox" name="is_automated" checked={Boolean(formData.is_automated)} readOnly />
            <Input type="text" name="automation_handler" value={formData.automation_handler} readOnly />
            
            {/* Dependencies */}
            <Input type="select" name="depends_on" multiple value={formData.depends_on} readOnly />

            {/* Other fields */}
            <Input type="number" name="due_date_offset" value={formData.due_date_offset ?? ''} readOnly />
            <Input type="number" name="estimated_duration_minutes" value={formData.estimated_duration_minutes ?? ''} readOnly />
            <Input type="textarea" name="instructions" value={formData.instructions} readOnly />
            <Input type="textarea" name="metadata" value={JSON.stringify(formData.metadata)} readOnly />
            <Input type="textarea" name="form_fields" value={JSON.stringify(formData.form_fields)} readOnly />
          </div>
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
  allSteps: PropTypes.array,
  currentIndex: PropTypes.number,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
};

export default StepConfigModal;
