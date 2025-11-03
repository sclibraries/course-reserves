import { useState, useEffect } from 'react';
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
    if (!window.confirm(`Are you sure you want to delete the template "${templateName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await workflowService.deleteTemplate(templateId);
      toast.success(`Template "${templateName}" deleted successfully`);
      loadTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
      toast.error('Failed to delete template');
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

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Workflow Templates</h1>
        <Button 
          color="primary"
          disabled
          title="Template creation UI coming in Phase 2">
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
                  <th style={{ width: '40%' }}>Template Name</th>
                  <th style={{ width: '15%' }}>Category</th>
                  <th style={{ width: '15%' }}>Entity Type</th>
                  <th style={{ width: '10%' }}>Steps</th>
                  <th style={{ width: '20%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <>
                    <tr key={template.id}>
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
                      <td className="text-center">
                        <Badge color="secondary" pill>
                          {template.step_count || 0}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          color="link"
                          size="sm"
                          onClick={() => toggleTemplateDetails(template.id)}
                          className="p-0 me-3">
                          <FontAwesomeIcon 
                            icon={expandedTemplate?.id === template.id ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down"} 
                            className="me-1" 
                          />
                          {expandedTemplate?.id === template.id ? 'Hide' : 'Show'} Details
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
                    {expandedTemplate?.id === template.id && (
                      <tr>
                        <td colSpan="5" className="bg-light">
                          <div className="p-3">
                            <h5 className="mb-3">Template Details</h5>
                            
                            {/* Steps */}
                            {expandedTemplate.steps && expandedTemplate.steps.length > 0 ? (
                              <div className="mb-3">
                                <h6>Steps ({expandedTemplate.steps.length}):</h6>
                                <Table size="sm" bordered className="mb-0 bg-white">
                                  <thead>
                                    <tr>
                                      <th style={{ width: '10%' }}>Order</th>
                                      <th style={{ width: '30%' }}>Step Name</th>
                                      <th style={{ width: '15%' }}>Type</th>
                                      <th style={{ width: '15%' }}>Required</th>
                                      <th style={{ width: '30%' }}>Description</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {expandedTemplate.steps
                                      .sort((a, b) => a.step_order - b.step_order)
                                      .map((step) => (
                                        <tr key={step.id}>
                                          <td className="text-center">{step.step_order}</td>
                                          <td><strong>{step.step_name}</strong></td>
                                          <td>{getStepTypeBadge(step.step_type)}</td>
                                          <td>
                                            {step.is_required ? (
                                              <Badge color="danger">Required</Badge>
                                            ) : (
                                              <Badge color="light" className="text-muted">Optional</Badge>
                                            )}
                                          </td>
                                          <td className="small">{step.description || '-'}</td>
                                        </tr>
                                      ))}
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
                  </>
                ))}
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
