import { useState, useEffect, Fragment } from 'react';
import { 
  Card, 
  CardBody, 
  Button, 
  Table, 
  Badge, 
  Spinner,
  Alert
} from 'reactstrap';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { workflowService } from '../../../services/admin/workflowService';
import WorkflowTemplateEditor from './workflow-builder/WorkflowTemplateEditor';

/**
 * WorkflowTemplateManager - Admin interface for managing workflow templates
 * 
 * Allows admins to:
 * - View all workflow templates
 * - See template details (steps, conditions, transitions)
 * - Duplicate templates
 * - Delete templates
 * - Future: Create/edit templates (Phase 2)
 */
function WorkflowTemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await workflowService.listTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load workflow templates:', err);
      setError('Failed to load workflow templates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (templateId, templateName) => {
    try {
      await workflowService.duplicateTemplate(templateId);
      toast.success(`Template "${templateName}" duplicated successfully`);
      loadTemplates();
    } catch (err) {
      console.error('Failed to duplicate template:', err);
      toast.error('Failed to duplicate template');
    }
  };

  const handleDelete = async (templateId, templateName) => {
    if (!window.confirm(`Are you sure you want to archive the template "${templateName}"? It will be deactivated but not permanently deleted.`)) {
      return;
    }

    try {
      await workflowService.deleteTemplate(templateId);
      toast.success(`Template "${templateName}" archived successfully`);
      loadTemplates();
    } catch (err) {
      console.error('Failed to archive template:', err);
      toast.error('Failed to archive template');
    }
  };

  const toggleTemplateDetails = async (templateId) => {
    if (expandedTemplate?.id === templateId) {
      setExpandedTemplate(null);
      return;
    }

    try {
      const details = await workflowService.getTemplate(templateId);
      setExpandedTemplate(details);
    } catch (err) {
      console.error('Failed to load template details:', err);
      toast.error('Failed to load template details');
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplateId(null);
    setShowEditor(true);
  };

  const handleEditTemplate = (templateId) => {
    setEditingTemplateId(templateId);
    setShowEditor(true);
  };

  const handleEditorSave = (savedData) => {
    // Handle both direct template object and wrapped response { success: true, template: {...} }
    const template = savedData.template || savedData;
    const templateName = template.template_name || template.name || 'Template';
    
    toast.success(`Template "${templateName}" saved successfully`);
    setShowEditor(false);
    setEditingTemplateId(null);
    loadTemplates();
  };

  const handleEditorCancel = () => {
    setShowEditor(false);
    setEditingTemplateId(null);
  };

  const getCategoryBadge = (category) => {
    const colors = {
      'book': 'primary',
      'article': 'success',
      'video': 'info',
      'default': 'secondary',
      'course': 'warning'
    };
    return <Badge color={colors[category] || 'secondary'}>{category}</Badge>;
  };

  const getStepTypeBadge = (type) => {
    const colors = {
      'action': 'primary',
      'decision': 'warning',
      'notification': 'info',
      'assignment': 'success',
      'approval': 'danger'
    };
    return <Badge color={colors[type] || 'secondary'} className="me-1">{type}</Badge>;
  };

  const renderProgressModeBadge = (mode) => {
    const normalized = (mode || (expandedTemplate?.metadata?.progress_mode ?? 'legacy')).toLowerCase();
    const config = {
      strict: { color: 'danger', label: 'Strict' },
      loose: { color: 'info', label: 'Loose' },
      legacy: { color: 'secondary', label: 'Legacy' }
    };
    const { color, label } = config[normalized] || config.legacy;
    return <Badge color={color}>{label}</Badge>;
  };

  const getTemplateStats = (templateRecord) => {
    if (!templateRecord) {
      return {
        stepCount: 0,
        gateCount: 0,
        dependencyCount: 0
      };
    }

    const steps = templateRecord.steps || [];
    if (steps.length > 0) {
      const gateCount = steps.filter((step) => step.is_gate === 1 || step.is_gate === true).length;
      const dependencyCount = steps.reduce((total, step) => (
        total + (Array.isArray(step.depends_on) ? step.depends_on.length : 0)
      ), 0);
      return {
        stepCount: steps.length,
        gateCount,
        dependencyCount
      };
    }

    return {
      stepCount: templateRecord.step_count ?? 0,
      gateCount: templateRecord.gate_count ?? templateRecord.metrics?.gate_count ?? 0,
      dependencyCount: templateRecord.dependency_count ?? 0
    };
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner color="primary" />
        <p className="mt-2">Loading workflow templates...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert color="danger">
        <h4 className="alert-heading">Error</h4>
        <p>{error}</p>
        <Button color="primary" onClick={loadTemplates}>
          Try Again
        </Button>
      </Alert>
    );
  }

  // Show editor when creating or editing
  if (showEditor) {
    return (
      <WorkflowTemplateEditor
        templateId={editingTemplateId}
        onSave={handleEditorSave}
        onCancel={handleEditorCancel}
      />
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Workflow Templates</h1>
        <Button 
          color="primary"
          onClick={handleCreateTemplate}>
          <FontAwesomeIcon icon="fa-solid fa-plus" className="me-2" />
          Create Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Alert color="info">
          <h4 className="alert-heading">No Templates Found</h4>
          <p>No workflow templates are currently configured. Templates can be added through the backend API.</p>
        </Alert>
      ) : (
        <Card>
          <CardBody>
            <Table hover responsive>
              <thead>
                <tr>
                  <th style={{ width: '36%' }}>Template Name</th>
                  <th style={{ width: '14%' }}>Category</th>
                  <th style={{ width: '12%' }}>Entity Type</th>
                  <th style={{ width: '14%' }}>Progress Mode</th>
                  <th style={{ width: '8%' }}>Steps</th>
                  <th style={{ width: '16%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => {
                  const isExpanded = expandedTemplate?.id === template.id;
                  const statsSource = isExpanded ? expandedTemplate : template;
                  const stats = getTemplateStats(statsSource);
                  const progressModeValue = statsSource?.metadata?.progress_mode || statsSource?.progress_mode || 'legacy';

                  return (
                    <Fragment key={template.id}>
                      <tr>
                        <td>
                          <strong>{template.template_name}</strong>
                          {template.description && (
                            <div className="text-muted small">{template.description}</div>
                          )}
                        </td>
                        <td>{getCategoryBadge(template.category)}</td>
                        <td>
                          <Badge color="light" className="text-dark">
                            {template.entity_type}
                          </Badge>
                        </td>
                        <td>
                          {renderProgressModeBadge(progressModeValue)}
                        </td>
                        <td className="text-center">
                          <div className="d-flex flex-column align-items-center">
                            <Badge color="secondary" pill className="mb-1">
                              {stats.stepCount}
                            </Badge>
                            {stats.gateCount > 0 && (
                              <Badge color="dark" pill>
                                {stats.gateCount} Gate{stats.gateCount !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td>
                          <Button
                            color="link"
                            size="sm"
                            onClick={() => toggleTemplateDetails(template.id)}
                            className="p-0 me-3">
                            <FontAwesomeIcon 
                              icon={isExpanded ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down"} 
                              className="me-1" 
                            />
                            {isExpanded ? 'Hide' : 'Show'} Details
                          </Button>
                          <Button
                            color="link"
                            size="sm"
                            onClick={() => handleEditTemplate(template.id)}
                            className="p-0 me-3"
                            title="Edit this template">
                            <FontAwesomeIcon icon="fa-solid fa-edit" className="me-1" />
                            Edit
                          </Button>
                          <Button
                            color="link"
                            size="sm"
                            onClick={() => handleDuplicate(template.id, template.template_name)}
                            className="p-0 me-3"
                            title="Duplicate this template">
                            <FontAwesomeIcon icon="fa-solid fa-copy" className="me-1" />
                            Duplicate
                          </Button>
                          <Button
                            color="link"
                            size="sm"
                            className="p-0 text-danger"
                            onClick={() => handleDelete(template.id, template.template_name)}
                            title="Delete this template">
                            <FontAwesomeIcon icon="fa-solid fa-trash" className="me-1" />
                            Delete
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan="6" className="bg-light">
                            <div className="p-3">
                              <div className="d-flex align-items-center justify-content-between mb-3">
                                <h5 className="mb-0">Template Details</h5>
                                {renderProgressModeBadge(progressModeValue)}
                              </div>
                              <div className="text-muted small mb-3">
                                <span className="me-3"><strong>Gate Steps:</strong> {stats.gateCount}</span>
                                <span><strong>Total Dependencies:</strong> {stats.dependencyCount}</span>
                              </div>

                              {/* Steps */}
                              {expandedTemplate.steps && expandedTemplate.steps.length > 0 ? (
                                <div className="mb-3">
                                  <h6>Steps ({expandedTemplate.steps.length}):</h6>
                                  <Table size="sm" bordered className="mb-0 bg-white">
                                    <thead>
                                      <tr>
                                        <th style={{ width: '8%' }}>Order</th>
                                        <th style={{ width: '24%' }}>Step Name</th>
                                        <th style={{ width: '14%' }}>Type</th>
                                        <th style={{ width: '12%' }}>Required</th>
                                        <th style={{ width: '12%' }}>Gate</th>
                                        <th style={{ width: '18%' }}>Dependencies</th>
                                        <th style={{ width: '12%' }}>Data Required</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[...expandedTemplate.steps]
                                        .sort((a, b) => (a.sequence_order ?? a.step_order) - (b.sequence_order ?? b.step_order))
                                        .map((step) => {
                                          const order = step.sequence_order ?? step.step_order;
                                          const dependencyLabels = Array.isArray(step.depends_on) && step.depends_on.length > 0
                                            ? step.depends_on
                                                .map((dep) => {
                                                  const match = expandedTemplate.steps.find((candidate) => {
                                                    const candidateId = candidate.id ?? candidate.sequence_order ?? candidate.step_order;
                                                    return candidateId === dep;
                                                  });
                                                  return match ? match.step_name : `Step ${dep}`;
                                                })
                                                .filter(Boolean)
                                            : [];
                                          const isGate = step.is_gate === 1 || step.is_gate === true;
                                          
                                          // Parse required_data
                                          let requiredDataLabel = null;
                                          if (step.required_data) {
                                            try {
                                              const parsed = typeof step.required_data === 'string' 
                                                ? JSON.parse(step.required_data) 
                                                : step.required_data;
                                              requiredDataLabel = parsed.label || parsed.field || 'Yes';
                                            } catch {
                                              requiredDataLabel = 'Yes';
                                            }
                                          }

                                          return (
                                            <tr key={step.id ?? step.step_key}>
                                              <td className="text-center">{order}</td>
                                              <td><strong>{step.step_name}</strong></td>
                                              <td>{getStepTypeBadge(step.step_type)}</td>
                                              <td>
                                                {step.is_required ? (
                                                  <Badge color="danger">Required</Badge>
                                                ) : (
                                                  <Badge color="light" className="text-muted">Optional</Badge>
                                                )}
                                              </td>
                                              <td>
                                                {isGate ? (
                                                  <Badge color="dark">Gate</Badge>
                                                ) : (
                                                  <Badge color="light" className="text-muted">None</Badge>
                                                )}
                                              </td>
                                              <td className="small">
                                                {dependencyLabels.length > 0 ? dependencyLabels.join(', ') : <span className="text-muted">None</span>}
                                              </td>
                                              <td className="small">
                                                {requiredDataLabel ? (
                                                  <Badge color="info" title="This step requires data input">
                                                    {requiredDataLabel}
                                                  </Badge>
                                                ) : (
                                                  <Badge color="light" className="text-muted">None</Badge>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                    </tbody>
                                  </Table>
                                </div>
                              ) : (
                                <Alert color="warning" className="mb-3">
                                  No steps configured for this template.
                                </Alert>
                              )}

                              {/* Conditions */}
                              {expandedTemplate.conditions && expandedTemplate.conditions.length > 0 && (
                                <div className="mb-3">
                                  <h6>Conditions ({expandedTemplate.conditions.length}):</h6>
                                  <ul className="small">
                                    {expandedTemplate.conditions.map((condition) => (
                                      <li key={condition.id}>
                                        <strong>{condition.condition_name}:</strong> {condition.condition_type} - {condition.condition_logic}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Transitions */}
                              {expandedTemplate.transitions && expandedTemplate.transitions.length > 0 && (
                                <div>
                                  <h6>Transitions ({expandedTemplate.transitions.length}):</h6>
                                  <ul className="small">
                                    {expandedTemplate.transitions.map((transition) => (
                                      <li key={transition.id}>
                                        Step {transition.from_step_id} → Step {transition.to_step_id}
                                        {transition.condition_id && ' (conditional)'}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}

      <Alert color="info" className="mt-4">
        <h5 className="alert-heading">
          <FontAwesomeIcon icon="fa-solid fa-info-circle" className="me-2" />
          About Workflow Templates
        </h5>
        <p className="mb-2">
          Workflow templates define the steps, conditions, and transitions for automated workflows. 
          Templates are automatically applied when:
        </p>
        <ul className="mb-2">
          <li><strong>Course workflows:</strong> When a course submission is created (entity_type: course)</li>
          <li><strong>Resource workflows:</strong> When a resource is added, based on material category (book, article, video)</li>
        </ul>
        <p className="mb-0">
          <strong>Phase 2 Development:</strong> A full template builder UI with drag-and-drop step creation, 
          condition configuration, and visual transition mapping is planned for future development.
        </p>
      </Alert>
    </div>
  );
}

export default WorkflowTemplateManager;
