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
  Alert
} from 'reactstrap';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import StepBuilder from './StepBuilder';
import ConditionBuilder from './ConditionBuilder';
import TransitionMapper from './TransitionMapper';

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
    category: 'faculty-request',
    entity_type: 'course',
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
      const response = await fetch(`/api/workflow-admin/templates/${id}`);
      const data = await response.json();
      
      if (response.ok) {
        setTemplate(data);
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
    const { name, value } = e.target;
    setTemplate(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateSteps = (newSteps) => {
    setTemplate(prev => ({
      ...prev,
      steps: newSteps
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

      const url = templateId
        ? `/api/workflow-admin/templates/${templateId}`
        : '/api/workflow-admin/templates';
      
      const method = templateId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(template)
      });

      const data = await response.json();

      if (response.ok) {
        onSave(data);
      } else {
        setError(data.message || 'Failed to save template');
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
    
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/workflow-admin/templates/${templateId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onCancel();
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to delete template');
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
                    <Label for="category">Category</Label>
                    <Input
                      type="select"
                      id="category"
                      name="category"
                      value={template.category}
                      onChange={handleInputChange}>
                      <option value="faculty-request">Faculty Request</option>
                      <option value="ereserves">E-Reserves</option>
                      <option value="course-setup">Course Setup</option>
                      <option value="approval">Approval</option>
                    </Input>
                  </FormGroup>

                  <FormGroup>
                    <Label for="entity_type">Entity Type</Label>
                    <Input
                      type="select"
                      id="entity_type"
                      name="entity_type"
                      value={template.entity_type}
                      onChange={handleInputChange}>
                      <option value="course">Course</option>
                      <option value="resource">Resource</option>
                      <option value="request">Request</option>
                    </Input>
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
                    <span className="text-muted">Conditions:</span>
                    <span className="fw-bold">{template.conditions.length}</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted">Transitions:</span>
                    <span className="fw-bold">{template.transitions.length}</span>
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
                      onUpdateSteps={handleUpdateSteps}
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
