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

              <FormGroup className="mt-3">
                <Label>Step type *</Label>
                <small className="text-muted d-block mb-2">
                  Used for icons and grouping. It does not change logic by itself.
                </small>
                <Row>
                  {stepTypes.map(type => (
                    <Col key={type.value} md={6} className="mb-3">
                      <Card
                        className={`cursor-pointer ${formData.step_type === type.value ? `border-${type.color} border-2` : ''}`}
                        onClick={() => setFormData(prev => ({ ...prev, step_type: type.value }))}
                        style={{ cursor: 'pointer' }}
                      >
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

              <FormGroup className="mt-3">
                <Label for="step_key">Step key (internal)</Label>
                <Input
                  type="text"
                  id="step_key"
                  name="step_key"
                  value={formData.step_key}
                  onChange={handleChange}
                  placeholder="Machine-friendly key (e.g., verify_course_in_folio)"
                  readOnly={Boolean(step)}
                />
                <small className="text-muted">
                  Used by the system to uniquely identify this step. Do not edit after the workflow is in use.
                </small>
              </FormGroup>
            </CardBody>
          </Card>

          {/* Section B: Completion rules */}
          <Card className="mb-3">
            <CardBody>
              <h5 className="mb-1">Completion rules</h5>
              <small className="text-muted d-block mb-3">
                Control whether this step is required and whether it can block later steps.
              </small>

              <Row>
                <Col md={6}>
                  <FormGroup>
                    <Label for="due_date_offset">Target due date (days after workflow starts)</Label>
                    <Input
                      type="number"
                      id="due_date_offset"
                      name="due_date_offset"
                      value={formData.due_date_offset ?? ''}
                      onChange={handleChange}
                      min={1}
                    />
                    <small className="text-muted">
                      Optional. Used to calculate a suggested due date for this step, relative to when the workflow instance starts (e.g., ‘3’ = 3 days after start).
                    </small>
                  </FormGroup>
                </Col>
                <Col md={6} className="d-flex flex-column justify-content-center">
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
                    <small className="text-muted d-block">
                      This step must be completed to finish the workflow. If unchecked, the workflow can finish even if this step is skipped.
                    </small>
                  </FormGroup>
                </Col>
              </Row>

              <Row className="mt-3">
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
                    <small className="text-muted d-block mt-1">
                      Gate steps must be completed before any later steps can start. Use for critical checks like ‘Verify course in FOLIO’.
                    </small>
                    {formData.is_gate && (
                      <small className="text-muted d-block">
                        Gate steps are always required.
                      </small>
                    )}
                  </FormGroup>
                </Col>
              </Row>
            </CardBody>
          </Card>

          {/* Section C: Automation */}
          <Card className="mb-3">
            <CardBody>
              <h5 className="mb-1">Automation</h5>
              <small className="text-muted d-block mb-3">
                Use automation when the system (or another service) should complete this step.
              </small>

              <FormGroup check className="mb-2">
                <Label check title="Backend automation, not a person, completes this step.">
                  <Input
                    type="checkbox"
                    name="is_automated"
                    checked={Boolean(formData.is_automated)}
                    onChange={handleChange}
                  />
                  {' '}This step is completed by automation
                </Label>
                <small className="text-muted d-block">
                  Leave unchecked for normal human tasks. Turn on only if the backend will complete this step via an automation handler.
                </small>
              </FormGroup>

              <FormGroup className="mt-2">
                <Label for="automation_handler">Automation handler key</Label>
                <Input
                  type="text"
                  name="automation_handler"
                  id="automation_handler"
                  value={formData.automation_handler}
                  onChange={handleChange}
                  placeholder="e.g., ensure_course_and_offering"
                  disabled={!formData.is_automated}
                  title="Backend key that selects which automation runs."
                />
                <small className="text-muted d-block mt-1">
                  Identifier for the backend to run the right automation. Example: `ensure_course_and_offering` for the FOLIO ‘Verify course’ gate.
                </small>
                {formData.automation_handler === 'ensure_course_and_offering' && (
                  <small className="text-muted d-block mt-1">
                    This handler integrates with FOLIO to ensure the course and offering exist. On the workflow screen, this step will show a ‘Verify course in FOLIO’ panel instead of a normal checkbox.
                  </small>
                )}
              </FormGroup>

              <FormGroup className="mt-3">
                <Label for="automation_config">Automation configuration (JSON)</Label>
                <Input
                  type="textarea"
                  id="automation_config"
                  name="automation_config"
                  value={typeof formData.automation_config === 'string' ? formData.automation_config : JSON.stringify(formData.automation_config ?? {}, null, 2)}
                  onChange={handleChange}
                  rows={4}
                  placeholder="{ }"
                  disabled={!formData.is_automated}
                />
                <small className="text-muted d-block mt-1">
                  Optional advanced settings for this handler. Use valid JSON. Example:
                </small>
                <pre className="bg-light p-2 small mb-0 mt-1">
{`{
  "notifyEmail": "reserves@smith.edu",
  "retryLimit": 3
}`}
                </pre>
              </FormGroup>
            </CardBody>
          </Card>

          {/* Section D: Dependencies */}
          <Card className="mb-3">
            <CardBody>
              <h5 className="mb-1">Step dependencies</h5>
              <small className="text-muted d-block mb-3">
                Control which earlier steps must finish before this one can start.
              </small>
              <FormGroup>
                <Label for="depends_on">This step can only start after:</Label>
                <Input
                  type="select"
                  id="depends_on"
                  name="depends_on"
                  multiple
                  value={Array.isArray(formData.depends_on) ? formData.depends_on.map(String) : []}
                  onChange={handleDependenciesChange}
                  disabled={availableDependencies.length === 0}
                >
                  {availableDependencies.length === 0 ? (
                    <option value="" disabled>
                      {currentIndex === 0 ? 'No earlier steps available' : 'Select earlier steps'}
                    </option>
                  ) : (
                    availableDependencies.map((option) => (
                      <option key={option.value} value={option.value}>
                        {`Step ${option.sequence_order}: ${option.label}`}
                      </option>
                    ))
                  )}
                </Input>
                <small className="text-muted d-block mt-2" title="Earlier steps that must be completed before this one can start.">
                  Select any earlier steps that must be completed before this one begins. Only earlier steps are shown to avoid loops.
                </small>
              </FormGroup>

              {Array.isArray(formData.depends_on) && formData.depends_on.length > 0 && (
                <div className="d-flex flex-wrap gap-2">
                  {formData.depends_on.map((dep) => {
                    const dependency = availableDependencies.find((option) => option.value === dep);
                    const label = dependency ? dependency.label : `Step ${dep}`;
                    return (
                      <Badge color="light" key={dep} className="text-dark">
                        <FontAwesomeIcon icon="fa-solid fa-link" className="me-1" />
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Section E & F: Assignment, guidance, and advanced metadata */}
          <Card className="mt-3">
            <CardBody>
              <h5 className="mb-1">Assignment & guidance</h5>
              <small className="text-muted d-block mb-3">
                Who owns this step and how much work it is.
              </small>
              <Row>
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
                      Optional. Role that normally owns this step (e.g., `reserves_staff`, `access_services`). This can be used by the UI for filtering or routing.
                    </small>
                  </FormGroup>
                </Col>
                <Col md={6}>
                  <FormGroup>
                    <Label for="estimated_duration_minutes">Estimated time to complete (minutes)</Label>
                    <Input
                      type="number"
                      id="estimated_duration_minutes"
                      name="estimated_duration_minutes"
                      value={formData.estimated_duration_minutes ?? ''}
                      onChange={handleChange}
                      min={1}
                    />
                    <small className="text-muted">
                      Optional rough estimate for reporting and planning (e.g., `15`).
                    </small>
                  </FormGroup>
                </Col>
              </Row>

              <FormGroup>
                <Label for="instructions">Staff instructions</Label>
                <Input
                  type="textarea"
                  id="instructions"
                  name="instructions"
                  value={formData.instructions}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Plain-language instructions staff see when working on this step. Example: ‘Check the course in FOLIO and confirm the term and instructor match the submission.’"
                />
              </FormGroup>

              <h5 className="mb-1 mt-4">Advanced metadata</h5>
              <small className="text-muted d-block mb-3">
                Optional advanced settings for power users. Safe to leave empty.
              </small>
              <Row>
                <Col md={6}>
                  <FormGroup>
                    <Label for="metadata">Metadata (JSON)</Label>
                    <Input
                      type="textarea"
                      id="metadata"
                      name="metadata"
                      value={typeof formData.metadata === 'string' ? formData.metadata : JSON.stringify(formData.metadata ?? {}, null, 2)}
                      onChange={handleChange}
                      rows={4}
                      placeholder="{ }"
                    />
                    <small className="text-muted d-block mt-1">
                      Optional key/value data for integrations or reports. Use valid JSON.
                    </small>
                  </FormGroup>
                </Col>
                <Col md={6}>
                  <FormGroup>
                    <Label for="form_fields">Form fields (experimental)</Label>
                    <Input
                      type="textarea"
                      id="form_fields"
                      name="form_fields"
                      value={Array.isArray(formData.form_fields) ? JSON.stringify(formData.form_fields, null, 2) : (formData.form_fields || '')}
                      onChange={(e) => {
                        const { value } = e.target;
                        setFormData(prev => ({
                          ...prev,
                          form_fields: value
                        }));
                      }}
                      rows={4}
                      placeholder="Leave empty unless you know you need it."
                    />
                    <small className="text-muted d-block mt-1">
                      Optional configuration for custom forms or inputs on this step. Leave empty unless you know you need it.
                    </small>
                  </FormGroup>
                </Col>
              </Row>
            </CardBody>
          </Card>
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
