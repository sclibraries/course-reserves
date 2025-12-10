import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Container,
  Row,
  Col,
  Card,
  CardBody,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
  Alert,
  FormText
} from 'reactstrap';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { apiConfig } from '../../../../config/api.config';
import StepBuilder from './StepBuilder';
import ConditionBuilder from './ConditionBuilder';
import TransitionMapper from './TransitionMapper';

const DEFAULT_PROGRESS_MODE = 'legacy';
const PROGRESS_MODE_OPTIONS = [
  { value: 'strict', label: 'Strict (enforce all gates)' },
  { value: 'loose', label: 'Loose (allow parallel work)' },
  { value: 'legacy', label: 'Legacy (existing behavior)' }
];

let localStepCounter = 0;

const generateLocalStepId = () => {
  localStepCounter += 1;
  return -1 * (Date.now() + localStepCounter);
};

const ensureMetadata = (metadata = {}) => ({
  auto_apply: metadata?.auto_apply ?? true,
  final_actions: Array.isArray(metadata?.final_actions) ? [...metadata.final_actions] : [],
  progress_mode: metadata?.progress_mode || DEFAULT_PROGRESS_MODE
});

const normalizeStep = (step = {}, index = 0, fallbackLocalId = null) => {
  const dependsOnRaw = Array.isArray(step.depends_on)
    ? step.depends_on
    : step.depends_on !== undefined && step.depends_on !== null
      ? [step.depends_on]
      : [];

  const normalizedDependsOn = dependsOnRaw
    .map((value) => {
      const numeric = Number(value);
      return Number.isNaN(numeric) ? value : numeric;
    })
    .filter((value) => value !== null && value !== undefined && value !== '');

  const sequenceOrder = step.sequence_order ?? step.step_order ?? (index + 1);
  const localId = step.local_id ?? fallbackLocalId ?? step.id ?? generateLocalStepId();

  return {
    id: step.id ?? null,
    local_id: localId,
    step_key: step.step_key || `step_${Math.abs(localId)}_${index}`,
    step_name: step.step_name || step.name || `Step ${index + 1}`,
    description: step.description || step.step_description || '',
    step_type: step.step_type || 'action',
    sequence_order: sequenceOrder,
    is_required: step.is_required === 1 || step.is_required === true,
    is_automated: step.is_automated === 1 || step.is_automated === true,
    is_gate: step.is_gate === 1 || step.is_gate === true,
    depends_on: normalizedDependsOn,
    automation_handler: step.automation_handler || '',
    assigned_role: step.assigned_role ?? null,
    estimated_duration_minutes: step.estimated_duration_minutes ?? null,
    instructions: step.instructions || '',
    form_fields: Array.isArray(step.form_fields) ? step.form_fields : [],
    metadata: typeof step.metadata === 'object' && step.metadata !== null ? step.metadata : {},
    due_date_offset: step.due_date_offset ?? null
  };
};

const getStepIdentifier = (step, index) => step.id ?? step.local_id ?? step.sequence_order ?? (index + 1);

const pruneMissingDependencies = (steps) => {
  const validIds = new Set(steps.map((step, idx) => getStepIdentifier(step, idx)));
  return steps.map((step) => ({
    ...step,
    depends_on: (Array.isArray(step.depends_on) ? step.depends_on : []).filter((dep) => validIds.has(dep))
  }));
};

const sanitizeDependenciesForOrder = (steps) => {
  const identifierMap = new Map();
  steps.forEach((step, idx) => {
    identifierMap.set(getStepIdentifier(step, idx), idx);
  });

  return steps.map((step, idx) => {
    const sanitizedDeps = (Array.isArray(step.depends_on) ? step.depends_on : []).filter((dep) => {
      const depIndex = identifierMap.get(dep);
      return depIndex !== undefined && depIndex < idx;
    });

    return {
      ...step,
      depends_on: sanitizedDeps
    };
  });
};

const normalizeSteps = (steps = []) => {
  const normalized = steps.map((step, idx) => normalizeStep(step, idx, step.local_id ?? null));
  const reindexed = normalized.map((step, idx) => ({
    ...step,
    sequence_order: idx + 1
  }));
  return sanitizeDependenciesForOrder(pruneMissingDependencies(reindexed));
};

const createNewStep = (position) => ({
  id: null,
  local_id: generateLocalStepId(),
  step_key: `step_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  step_name: 'New Step',
  description: '',
  step_type: 'action',
  sequence_order: position,
  is_required: true,
  is_automated: false,
  is_gate: false,
  depends_on: [],
  automation_handler: '',
  assigned_role: null,
  estimated_duration_minutes: null,
  instructions: '',
  form_fields: [],
  metadata: {},
  due_date_offset: null
});

/**
 * WorkflowTemplateEditor - Main visual template builder component
 */
function WorkflowTemplateEditor({ templateId, onSave, onCancel }) {
  const [activeTab, setActiveTab] = useState('steps');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Template metadata state
  const [template, setTemplate] = useState({
    name: '',
    description: '',
    workflow_type: 'course', // Changed from entity_type to match backend
    category: 'course', // Default category
    is_active: true,
    metadata: ensureMetadata(),
    steps: [],
    conditions: [],
    transitions: []
  });

  // Load existing template if editing
  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId);
    }
  }, [templateId]);

  const loadTemplate = async (id) => {
    try {
      setLoading(true);
      const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.getTemplate.replace(':id', id)}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': apiConfig.getAuthToken(),
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      if (response.ok) {
        setTemplate((prev) => {
          const normalizedSteps = normalizeSteps(data.steps || []);
          return {
            ...prev,
            ...data,
            id: data.id ?? prev.id ?? null,
            name: data.name ?? data.template_name ?? prev.name ?? '',
            template_name: data.template_name ?? data.name ?? prev.template_name,
            description: data.description ?? '',
            workflow_type: data.workflow_type || data.entity_type || prev.workflow_type,
            category: data.category || prev.category,
            is_active: data.is_active === 1 || data.is_active === true,
            metadata: ensureMetadata(data.metadata),
            steps: normalizedSteps,
            conditions: data.conditions || [],
            transitions: data.transitions || []
          };
        });
      } else {
        setError(data.message || 'Failed to load template');
      }
    } catch (err) {
      setError('Network error loading template');
      console.error('Load template error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Handle nested metadata fields
    if (name.startsWith('metadata.')) {
      const metadataKey = name.split('.')[1];
      setTemplate(prev => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          [metadataKey]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setTemplate(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleAddStep = () => {
    setTemplate((prev) => {
      const newStep = createNewStep(prev.steps.length + 1);
      const updatedSteps = [...prev.steps, newStep].map((step, idx) => ({
        ...step,
        sequence_order: idx + 1
      }));
      return {
        ...prev,
        steps: sanitizeDependenciesForOrder(pruneMissingDependencies(updatedSteps))
      };
    });
  };

  const handleUpdateStep = (index, updatedStep) => {
    setTemplate((prev) => {
      const newSteps = [...prev.steps];
      const existingStep = newSteps[index] || {};
      const mergedStep = normalizeStep(
        { ...existingStep, ...updatedStep },
        index,
        existingStep.local_id ?? null
      );

      newSteps[index] = {
        ...mergedStep,
        sequence_order: index + 1
      };

      const reindexed = newSteps.map((step, idx) => ({
        ...step,
        sequence_order: idx + 1
      }));

      return {
        ...prev,
        steps: sanitizeDependenciesForOrder(pruneMissingDependencies(reindexed))
      };
    });
  };

  const handleDeleteStep = (index) => {
    setTemplate((prev) => {
      const filtered = prev.steps.filter((_, i) => i !== index);
      return {
        ...prev,
        steps: normalizeSteps(filtered)
      };
    });
  };

  const handleReorderSteps = (reorderedSteps) => {
    const normalized = normalizeSteps(reorderedSteps);
    setTemplate((prev) => ({
      ...prev,
      steps: normalized
    }));
  };

  const handleUpdateConditions = (newConditions) => {
    setTemplate(prev => ({
      ...prev,
      conditions: newConditions
    }));
  };

  const handleUpdateTransitions = (newTransitions) => {
    setTemplate(prev => ({
      ...prev,
      transitions: newTransitions
    }));
  };

  const validateTemplate = () => {
    if (!template.name.trim()) {
      return 'Template name is required';
    }
    if (template.steps.length === 0) {
      return 'At least one step is required';
    }
    if (!template.metadata?.progress_mode) {
      return 'Select a progress mode for this template.';
    }

    const identifierMap = new Map();
    template.steps.forEach((step, index) => {
      identifierMap.set(getStepIdentifier(step, index), { step, index });
    });

    for (let index = 0; index < template.steps.length; index += 1) {
      const step = template.steps[index];
      const stepLabel = step.step_name || `Step ${index + 1}`;

      if (step.is_gate && !step.is_required) {
        return `Gate step "${stepLabel}" must be marked as required.`;
      }

      const dependencies = Array.isArray(step.depends_on) ? step.depends_on : [];
      const seen = new Set();

      for (const dep of dependencies) {
        if (seen.has(dep)) {
          return `Step "${stepLabel}" lists the same dependency multiple times.`;
        }
        seen.add(dep);

        const match = identifierMap.get(dep);

        if (!match) {
          return `Step "${stepLabel}" depends on an unknown step.`;
        }

        if (match.index === index) {
          return `Step "${stepLabel}" cannot depend on itself.`;
        }

        if (match.index > index) {
          const dependencyLabel = match.step.step_name || `Step ${match.index + 1}`;
          return `Step "${stepLabel}" cannot depend on "${dependencyLabel}" because it appears later in the workflow.`;
        }
      }
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateTemplate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const normalizedCurrentSteps = normalizeSteps(template.steps);
      const metadataForSave = ensureMetadata(template.metadata);
      metadataForSave.auto_apply = Boolean(metadataForSave.auto_apply);

      const url = templateId
        ? `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.updateTemplate.replace(':id', templateId)}`
        : `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.createTemplate}`;
      
      const method = templateId ? 'PUT' : 'POST';

      // Prepare data with proper type conversions for backend
      const stepsPayload = normalizedCurrentSteps.map((step, index) => {
        const dependsOnArray = Array.isArray(step.depends_on) ? step.depends_on : [];
        const numericDependsOn = Array.from(new Set(
          dependsOnArray
            .map((dep) => Number(dep))
            .filter((dep) => !Number.isNaN(dep))
        ));

        return {
          id: step.id ?? undefined,
          step_key: step.step_key,
          step_name: step.step_name,
          step_description: step.description,
          step_type: step.step_type,
          sequence_order: index + 1,
          is_required: step.is_required ? 1 : 0,
          is_automated: step.is_automated ? 1 : 0,
          is_gate: step.is_gate ? 1 : 0,
          depends_on: numericDependsOn,
          automation_handler: step.automation_handler ? step.automation_handler : null,
          automation_config: step.automation_config || {},
          assigned_role: step.assigned_role,
          estimated_duration_minutes: step.estimated_duration_minutes,
          instructions: step.instructions,
          due_date_offset: step.due_date_offset ?? null,
          metadata: step.metadata || {},
          form_fields: step.form_fields || []
        };
      });

      const dataToSend = {
        name: template.name,
        template_name: template.template_name ?? template.name,
        description: template.description,
        workflow_type: template.workflow_type,
        category: template.category,
        is_active: template.is_active ? 1 : 0,
        metadata: metadataForSave,
        steps: stepsPayload,
        conditions: template.conditions,
        transitions: template.transitions
      };

      if (template.id) {
        dataToSend.id = template.id;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiConfig.getAuthToken()
        },
        body: JSON.stringify(dataToSend)
      });

      const data = await response.json();

      if (response.ok) {
        onSave(data);
      } else {
        setError(data.message || data.error || 'Failed to save template');
      }
    } catch (err) {
      setError('Network error saving template');
      console.error('Save template error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!templateId) return;
    
    if (!confirm('Are you sure you want to archive this template? It will be deactivated but not permanently deleted.')) {
      return;
    }

    try {
      setLoading(true);
      const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.archiveTemplate.replace(':id', templateId)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': apiConfig.getAuthToken(),
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        onCancel();
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to archive template');
      }
    } catch (err) {
      setError('Network error deleting template');
      console.error('Delete template error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !template.name) {
    return (
      <div className="text-center py-5">
        <FontAwesomeIcon icon="fa-solid fa-spinner" spin size="3x" className="text-muted" />
        <p className="mt-3 text-muted">Loading template...</p>
      </div>
    );
  }

  const gateCount = template.steps.filter((step) => step.is_gate === 1 || step.is_gate === true).length;
  const dependencyCount = template.steps.reduce((total, step) => (
    total + (Array.isArray(step.depends_on) ? step.depends_on.length : 0)
  ), 0);
  const progressMode = template.metadata?.progress_mode || DEFAULT_PROGRESS_MODE;
  const progressModeLabel = PROGRESS_MODE_OPTIONS.find((option) => option.value === progressMode)?.label || progressMode;
  const progressModeSummary = progressModeLabel.split(' (')[0];

  return (
    <DndProvider backend={HTML5Backend}>
      <Container fluid className="py-4">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3>{templateId ? 'Edit Template' : 'Create New Template'}</h3>
            <p className="text-muted mb-0">
              Design your workflow with drag-and-drop steps
            </p>
          </div>
          <div>
            <Button color="secondary" onClick={onCancel} className="me-2">
              <FontAwesomeIcon icon="fa-solid fa-times" className="me-2" />
              Cancel
            </Button>
            {templateId && (
              <Button color="danger" onClick={handleDelete} className="me-2" disabled={loading}>
                <FontAwesomeIcon icon="fa-solid fa-trash" className="me-2" />
                Delete
              </Button>
            )}
            <Button color="primary" onClick={handleSave} disabled={loading}>
              <FontAwesomeIcon icon="fa-solid fa-save" className="me-2" />
              {loading ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </div>

        {error && (
          <Alert color="danger" toggle={() => setError(null)}>
            <FontAwesomeIcon icon="fa-solid fa-exclamation-circle" className="me-2" />
            {error}
          </Alert>
        )}

        <Row>
          {/* Left Sidebar - Template Metadata */}
          <Col md={4}>
            <Card>
              <CardBody>
                <h5 className="mb-3">Template Details</h5>
                <Form>
                  <FormGroup>
                    <Label for="name">Template Name *</Label>
                    <Input
                      type="text"
                      id="name"
                      name="name"
                      value={template.name}
                      onChange={handleInputChange}
                      placeholder="e.g., Standard Faculty Request"
                    />
                  </FormGroup>

                  <FormGroup>
                    <Label for="description">Description</Label>
                    <Input
                      type="textarea"
                      id="description"
                      name="description"
                      value={template.description}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Brief description of this workflow"
                    />
                  </FormGroup>

                  <FormGroup>
                    <Label for="workflow_type">Workflow Type *</Label>
                    <Input
                      type="select"
                      id="workflow_type"
                      name="workflow_type"
                      value={template.workflow_type}
                      onChange={handleInputChange}>
                      <option value="course">Course-Level Workflow</option>
                      <option value="item">Item-Level Workflow</option>
                    </Input>
                    <FormText color="muted">
                      {template.workflow_type === 'course' 
                        ? 'Applied to entire course submissions' 
                        : 'Applied to individual items by material type'}
                    </FormText>
                  </FormGroup>

                  <FormGroup>
                    <Label for="category">Category *</Label>
                    <Input
                      type="select"
                      id="category"
                      name="category"
                      value={template.category}
                      onChange={handleInputChange}>
                      {template.workflow_type === 'course' ? (
                        <>
                          <option value="course">Standard Course Processing</option>
                          <option value="rush">Rush Course Processing</option>
                          <option value="online">Online Course Setup</option>
                        </>
                      ) : (
                        <>
                          <option value="book">Book/Physical Item</option>
                          <option value="ebook">E-Book</option>
                          <option value="article">Article/Journal</option>
                          <option value="video">Video/Streaming</option>
                          <option value="link">External Link</option>
                          <option value="default">Default Item Processing</option>
                        </>
                      )}
                    </Input>
                    <FormText color="muted">
                      {template.workflow_type === 'course' 
                        ? 'Determines which course submissions use this workflow' 
                        : 'Matches items by material type'}
                    </FormText>
                  </FormGroup>

                  <FormGroup>
                    <Label for="metadata.progress_mode">Progress Mode *</Label>
                    <Input
                      type="select"
                      id="metadata.progress_mode"
                      name="metadata.progress_mode"
                      value={template.metadata?.progress_mode || DEFAULT_PROGRESS_MODE}
                      onChange={handleInputChange}>
                      {PROGRESS_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Input>
                    <FormText color="muted">
                      Strict requires gates to finish before any downstream work. Loose allows parallel work beyond gates. Legacy preserves the current behavior.
                    </FormText>
                  </FormGroup>

                  {/* Course-Specific Options */}
                  {template.workflow_type === 'course' && (
                    <>
                      <FormGroup check className="mb-3">
                        <Input
                          type="checkbox"
                          id="metadata.auto_apply"
                          name="metadata.auto_apply"
                          checked={template.metadata?.auto_apply ?? true}
                          onChange={handleInputChange}
                        />
                        <Label check for="metadata.auto_apply">
                          Auto-apply to new submissions
                        </Label>
                        <FormText color="muted" className="d-block ms-4">
                          Automatically create workflow instance when faculty submit matching courses
                        </FormText>
                      </FormGroup>

                      <FormGroup>
                        <Label>Final Actions (on completion)</Label>
                        <FormGroup check>
                          <Input
                            type="checkbox"
                            id="lock_submission"
                            checked={template.metadata?.final_actions?.some(a => a.type === 'lock_submission') ?? false}
                            onChange={(e) => {
                              const currentActions = template.metadata?.final_actions ? [...template.metadata.final_actions] : [];
                              const updatedActions = e.target.checked
                                ? [...currentActions, { type: 'lock_submission', enabled: true }]
                                : currentActions.filter(a => a.type !== 'lock_submission');
                              setTemplate(prev => ({
                                ...prev,
                                metadata: {
                                  ...prev.metadata,
                                  final_actions: updatedActions
                                }
                              }));
                            }}
                          />
                          <Label check for="lock_submission">
                            Lock submission when complete
                          </Label>
                        </FormGroup>
                        <FormGroup check>
                          <Input
                            type="checkbox"
                            id="notify_faculty"
                            checked={template.metadata?.final_actions?.some(a => a.type === 'notify_faculty') ?? false}
                            onChange={(e) => {
                              const currentActions = template.metadata?.final_actions ? [...template.metadata.final_actions] : [];
                              const updatedActions = e.target.checked
                                ? [...currentActions, { type: 'notify_faculty', enabled: true }]
                                : currentActions.filter(a => a.type !== 'notify_faculty');
                              setTemplate(prev => ({
                                ...prev,
                                metadata: {
                                  ...prev.metadata,
                                  final_actions: updatedActions
                                }
                              }));
                            }}
                          />
                          <Label check for="notify_faculty">
                            Notify faculty when complete
                          </Label>
                        </FormGroup>
                        <FormText color="muted">
                          Actions to execute when workflow completes successfully
                        </FormText>
                      </FormGroup>
                    </>
                  )}

                  <FormGroup check>
                    <Input
                      type="checkbox"
                      id="is_active"
                      name="is_active"
                      checked={template.is_active ?? true}
                      onChange={handleInputChange}
                    />
                    <Label check for="is_active">
                      Active (available for use)
                    </Label>
                  </FormGroup>
                </Form>

                {/* Summary Stats */}
                <div className="mt-4 pt-3 border-top">
                  <h6>Template Summary</h6>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-muted">Steps:</span>
                    <span className="fw-bold">{template.steps.length}</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-muted">Gate Steps:</span>
                    <span className="fw-bold">{gateCount}</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-muted">Dependencies:</span>
                    <span className="fw-bold">{dependencyCount}</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-muted">Conditions:</span>
                    <span className="fw-bold">{template.conditions.length}</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted">Transitions:</span>
                    <span className="fw-bold">{template.transitions.length}</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-2">
                    <span className="text-muted">Progress Mode:</span>
                    <span className="fw-bold text-capitalize">{progressModeSummary}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Col>

          {/* Right Panel - Tabbed Builder Interface */}
          <Col md={8}>
            <Card>
              <CardBody>
                <Nav tabs>
                  <NavItem>
                    <NavLink
                      className={activeTab === 'steps' ? 'active' : ''}
                      onClick={() => setActiveTab('steps')}
                      style={{ cursor: 'pointer' }}>
                      <FontAwesomeIcon icon="fa-solid fa-list-ol" className="me-2" />
                      Steps ({template.steps.length})
                    </NavLink>
                  </NavItem>
                  <NavItem>
                    <NavLink
                      className={activeTab === 'conditions' ? 'active' : ''}
                      onClick={() => setActiveTab('conditions')}
                      style={{ cursor: 'pointer' }}>
                      <FontAwesomeIcon icon="fa-solid fa-code-branch" className="me-2" />
                      Conditions ({template.conditions.length})
                    </NavLink>
                  </NavItem>
                  <NavItem>
                    <NavLink
                      className={activeTab === 'flow' ? 'active' : ''}
                      onClick={() => setActiveTab('flow')}
                      style={{ cursor: 'pointer' }}>
                      <FontAwesomeIcon icon="fa-solid fa-diagram-project" className="me-2" />
                      Flow ({template.transitions.length})
                    </NavLink>
                  </NavItem>
                </Nav>

                <TabContent activeTab={activeTab} className="mt-3">
                  <TabPane tabId="steps">
                    <StepBuilder
                      steps={template.steps}
                      onAddStep={handleAddStep}
                      onUpdateStep={handleUpdateStep}
                      onDeleteStep={handleDeleteStep}
                      onReorderSteps={handleReorderSteps}
                    />
                  </TabPane>

                  <TabPane tabId="conditions">
                    <ConditionBuilder
                      conditions={template.conditions}
                      steps={template.steps}
                      onUpdateConditions={handleUpdateConditions}
                    />
                  </TabPane>

                  <TabPane tabId="flow">
                    <TransitionMapper
                      steps={template.steps}
                      conditions={template.conditions}
                      transitions={template.transitions}
                      onUpdateTransitions={handleUpdateTransitions}
                    />
                  </TabPane>
                </TabContent>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </DndProvider>
  );
}

WorkflowTemplateEditor.propTypes = {
  templateId: PropTypes.number,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

export default WorkflowTemplateEditor;
