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
import { notify } from '../../../services/notify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { checklistService } from '../../../services/admin/checklistService';
import ChecklistTemplateEditor from './ChecklistTemplateEditor';

/**
 * ChecklistTemplateManager - Admin interface for managing checklist templates
 * 
 * Simple interface for creating checklists that staff follow when processing items.
 * Each template is a list of tasks that can be checked off.
 */
function ChecklistTemplateManager() {
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
      const data = await checklistService.listTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load checklist templates:', err);
      setError('Failed to load checklist templates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (templateId) => {
    try {
      await checklistService.duplicateTemplate(templateId);
      notify.success('Template duplicated');
      loadTemplates();
    } catch (err) {
      console.error('Failed to duplicate template:', err);
      notify.fromError(err, "Couldn't duplicate the template");
    }
  };

  const handleDelete = async (templateId, templateName) => {
    if (!window.confirm(`Are you sure you want to delete the template "${templateName}"?`)) {
      return;
    }

    try {
      await checklistService.deleteTemplate(templateId);
      notify.success('Template deleted');
      loadTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
      notify.fromError(err, "Couldn't delete the template");
    }
  };

  const toggleTemplateDetails = async (templateId) => {
    if (expandedTemplate?.id === templateId) {
      setExpandedTemplate(null);
      return;
    }

    try {
      const details = await checklistService.getTemplate(templateId);
      setExpandedTemplate(details);
    } catch (err) {
      console.error('Failed to load template details:', err);
      notify.fromError(err, "Couldn't load template details");
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

  const handleEditorSave = () => {
    notify.success('Checklist template saved');
    setShowEditor(false);
    setEditingTemplateId(null);
    loadTemplates();
  };

  const handleEditorCancel = () => {
    setShowEditor(false);
    setEditingTemplateId(null);
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner color="primary" />
        <p className="mt-2">Loading checklist templates...</p>
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
      <ChecklistTemplateEditor
        templateId={editingTemplateId}
        onSave={handleEditorSave}
        onCancel={handleEditorCancel}
      />
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1">Checklist Templates</h1>
          <p className="text-muted">
            Create checklists for staff to follow when processing course reserve items
          </p>
        </div>
        <Button 
          color="primary"
          onClick={handleCreateTemplate}>
          <FontAwesomeIcon icon="fa-solid fa-plus" className="me-2" />
          Create Checklist
        </Button>
      </div>

      {templates.length === 0 && !loading ? (
        <Alert color="info">
          <h4 className="alert-heading">
            <FontAwesomeIcon icon="fa-solid fa-clipboard-list" className="me-2" />
            No Checklist Templates Yet
          </h4>
          <p>You haven&apos;t created any checklist templates yet. Click &quot;Create Checklist&quot; to get started.</p>
          <p className="mb-0">
            <strong>Suggested starter checklists:</strong> Book - We Own, Electronic Resource, Article Scan, Streaming Video
          </p>
        </Alert>
      ) : (
        <Card>
          <CardBody>
            <Table hover responsive>
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Checklist Name</th>
                  <th style={{ width: '20%' }}>Material Types</th>
                  <th style={{ width: '15%' }}>Format</th>
                  <th style={{ width: '10%' }}>Tasks</th>
                  <th style={{ width: '20%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => {
                  const isExpanded = expandedTemplate?.id === template.id;
                  const taskCount = template.task_count || (template.tasks?.length || 0);

                  return (
                    <tr key={template.id}>
                      <td>
                        <strong>{template.name}</strong>
                        {template.description && (
                          <div className="text-muted small">{template.description}</div>
                        )}
                      </td>
                      <td>
                        {template.material_types && template.material_types.length > 0 ? (
                          <div className="d-flex flex-wrap gap-1">
                            {template.material_types.map((type, idx) => (
                              <Badge key={idx} color="secondary" className="me-1">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted">Any</span>
                        )}
                      </td>
                      <td>
                        <Badge color={template.format === 'physical' ? 'primary' : 'info'}>
                          {template.format || 'any'}
                        </Badge>
                      </td>
                      <td className="text-center">
                        <Badge color="secondary" pill>
                          {taskCount}
                        </Badge>
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
                          {isExpanded ? 'Hide' : 'Show'}
                        </Button>
                        <Button
                          color="link"
                          size="sm"
                          onClick={() => handleEditTemplate(template.id)}
                          className="p-0 me-3">
                          <FontAwesomeIcon icon="fa-solid fa-edit" className="me-1" />
                          Edit
                        </Button>
                        <Button
                          color="link"
                          size="sm"
                          onClick={() => handleDuplicate(template.id, template.name)}
                          className="p-0 me-3">
                          <FontAwesomeIcon icon="fa-solid fa-copy" className="me-1" />
                          Duplicate
                        </Button>
                        <Button
                          color="link"
                          size="sm"
                          className="p-0 text-danger"
                          onClick={() => handleDelete(template.id, template.name)}>
                          <FontAwesomeIcon icon="fa-solid fa-trash" className="me-1" />
                          Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>

            {/* Expanded template details */}
            {expandedTemplate && (
              <div className="mt-3 p-3 bg-light rounded">
                <h5 className="mb-3">{expandedTemplate.name} - Tasks</h5>
                {expandedTemplate.tasks && expandedTemplate.tasks.length > 0 ? (
                  <Table size="sm" bordered className="mb-0 bg-white">
                    <thead>
                      <tr>
                        <th style={{ width: '60%' }}>Task</th>
                        <th style={{ width: '20%' }}>Required</th>
                        <th style={{ width: '20%' }}>Help Text</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expandedTemplate.tasks.map((task, idx) => (
                        <tr key={task.id || idx}>
                          <td>{task.label}</td>
                          <td>
                            {task.optional ? (
                              <Badge color="light" className="text-muted">Optional</Badge>
                            ) : (
                              <Badge color="warning">Required</Badge>
                            )}
                          </td>
                          <td className="small text-muted">
                            {task.help_text || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <Alert color="warning" className="mb-0">
                    No tasks defined for this checklist.
                  </Alert>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Alert color="info" className="mt-4">
        <h5 className="alert-heading">
          <FontAwesomeIcon icon="fa-solid fa-info-circle" className="me-2" />
          About Checklists
        </h5>
        <p className="mb-2">
          Checklists help staff complete all necessary steps when processing course reserve items. 
          Each checklist is a simple list of tasks to check off.
        </p>
        <ul className="mb-0">
          <li><strong>Material Types:</strong> Link checklists to specific material types (book, article, video)</li>
          <li><strong>Format:</strong> Specify physical, electronic, or any format</li>
          <li><strong>Tasks:</strong> Create clear, actionable steps for staff to follow</li>
          <li><strong>Flexible:</strong> Staff can complete tasks in any order unless dependencies are specified</li>
        </ul>
      </Alert>
    </div>
  );
}

export default ChecklistTemplateManager;
