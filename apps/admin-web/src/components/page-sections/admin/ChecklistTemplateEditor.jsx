import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Container,
  Card,
  CardBody,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  Alert,
  Badge,
  Table
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { checklistService } from '../../../services/admin/checklistService';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * ChecklistTemplateEditor - Simple editor for creating/editing checklist templates
 */
function ChecklistTemplateEditor({ templateId, onSave, onCancel }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Template data
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [materialTypes, setMaterialTypes] = useState([]);
  const [format, setFormat] = useState('any');
  const [tasks, setTasks] = useState([]);

  // Material type input
  const [materialTypeInput, setMaterialTypeInput] = useState('');

  useEffect(() => {
    if (templateId) {
      loadTemplate();
    }
  }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const data = await checklistService.getTemplate(templateId);
      setName(data.name || '');
      setDescription(data.description || '');
      setMaterialTypes(data.material_types || []);
      setFormat(data.format || 'any');
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Failed to load template:', err);
      setError('Failed to load template. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMaterialType = (e) => {
    e.preventDefault();
    const type = materialTypeInput.trim().toLowerCase();
    if (type && !materialTypes.includes(type)) {
      setMaterialTypes([...materialTypes, type]);
      setMaterialTypeInput('');
    }
  };

  const handleRemoveMaterialType = (type) => {
    setMaterialTypes(materialTypes.filter(t => t !== type));
  };

  const handleAddTask = () => {
    setTasks([
      ...tasks,
      {
        id: Date.now(), // Temporary ID for UI
        label: '',
        optional: false,
        help_text: ''
      }
    ]);
  };

  const handleUpdateTask = (index, field, value) => {
    const updatedTasks = [...tasks];
    updatedTasks[index] = {
      ...updatedTasks[index],
      [field]: value
    };
    setTasks(updatedTasks);
  };

  const handleRemoveTask = (index) => {
    setTasks(tasks.filter((_, idx) => idx !== index));
  };

  const handleMoveTask = (index, direction) => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === tasks.length - 1)
    ) {
      return;
    }

    const newTasks = [...tasks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newTasks[index], newTasks[targetIndex]] = [newTasks[targetIndex], newTasks[index]];
    setTasks(newTasks);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!name.trim()) {
      setError('Please enter a checklist name');
      return;
    }

    if (tasks.length === 0) {
      setError('Please add at least one task');
      return;
    }

    // Check for empty task labels
    const hasEmptyLabels = tasks.some(task => !task.label.trim());
    if (hasEmptyLabels) {
      setError('All tasks must have a label');
      return;
    }

    const templateData = {
      name: name.trim(),
      description: description.trim(),
      material_types: materialTypes,
      format,
      tasks: tasks.map((task, idx) => ({
        ...task,
        order: idx + 1,
        label: task.label.trim(),
        help_text: task.help_text?.trim() || null
      }))
    };

    try {
      setSaving(true);
      setError(null);

      if (templateId) {
        await checklistService.updateTemplate(templateId, templateData, user?.username);
      } else {
        await checklistService.createTemplate(templateData, user?.username);
      }

      onSave();
    } catch (err) {
      console.error('Failed to save template:', err);
      setError('Failed to save template. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{templateId ? 'Edit' : 'Create'} Checklist Template</h2>
        <Button color="secondary" outline onClick={onCancel}>
          <FontAwesomeIcon icon="fa-solid fa-times" className="me-2" />
          Cancel
        </Button>
      </div>

      {error && (
        <Alert color="danger" toggle={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <Card className="mb-4">
          <CardBody>
            <h4 className="mb-3">Basic Information</h4>

            <FormGroup>
              <Label for="name">Checklist Name *</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Book - We Own, Electronic Resource, Video/DVD"
                required
              />
            </FormGroup>

            <FormGroup>
              <Label for="description">Description</Label>
              <Input
                id="description"
                type="textarea"
                rows="2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of when to use this checklist"
              />
            </FormGroup>

            <FormGroup>
              <Label>Material Types</Label>
              <div className="d-flex gap-2 mb-2 flex-wrap">
                {materialTypes.map((type) => (
                  <Badge key={type} color="secondary" className="d-flex align-items-center gap-2">
                    {type}
                    <FontAwesomeIcon
                      icon="fa-solid fa-times"
                      className="cursor-pointer"
                      onClick={() => handleRemoveMaterialType(type)}
                      style={{ cursor: 'pointer' }}
                    />
                  </Badge>
                ))}
              </div>
              <div className="d-flex gap-2">
                <Input
                  type="text"
                  value={materialTypeInput}
                  onChange={(e) => setMaterialTypeInput(e.target.value)}
                  placeholder="e.g., book, article, video"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMaterialType(e);
                    }
                  }}
                />
                <Button color="secondary" outline onClick={handleAddMaterialType}>
                  Add
                </Button>
              </div>
              <small className="text-muted">
                Add material types this checklist applies to. Leave empty to apply to all types.
              </small>
            </FormGroup>

            <FormGroup>
              <Label for="format">Format</Label>
              <Input
                id="format"
                type="select"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="any">Any Format</option>
                <option value="physical">Physical Only</option>
                <option value="electronic">Electronic Only</option>
              </Input>
            </FormGroup>
          </CardBody>
        </Card>

        <Card className="mb-4">
          <CardBody>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4 className="mb-0">Tasks</h4>
              <Button color="primary" size="sm" onClick={handleAddTask}>
                <FontAwesomeIcon icon="fa-solid fa-plus" className="me-2" />
                Add Task
              </Button>
            </div>

            {tasks.length === 0 ? (
              <Alert color="info">
                No tasks yet. Click &quot;Add Task&quot; to create the first task.
              </Alert>
            ) : (
              <Table bordered>
                <thead>
                  <tr>
                    <th style={{ width: '5%' }}>#</th>
                    <th style={{ width: '40%' }}>Task Label *</th>
                    <th style={{ width: '35%' }}>Help Text</th>
                    <th style={{ width: '10%' }}>Required</th>
                    <th style={{ width: '10%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, idx) => (
                    <tr key={task.id}>
                      <td className="text-center">{idx + 1}</td>
                      <td>
                        <Input
                          type="text"
                          value={task.label}
                          onChange={(e) => handleUpdateTask(idx, 'label', e.target.value)}
                          placeholder="e.g., Pull item from shelf"
                          bsSize="sm"
                        />
                      </td>
                      <td>
                        <Input
                          type="text"
                          value={task.help_text || ''}
                          onChange={(e) => handleUpdateTask(idx, 'help_text', e.target.value)}
                          placeholder="Optional help text"
                          bsSize="sm"
                        />
                      </td>
                      <td className="text-center">
                        <Input
                          type="checkbox"
                          checked={!task.optional}
                          onChange={(e) => handleUpdateTask(idx, 'optional', !e.target.checked)}
                        />
                      </td>
                      <td>
                        <div className="d-flex gap-1 justify-content-center">
                          <Button
                            color="link"
                            size="sm"
                            className="p-0"
                            onClick={() => handleMoveTask(idx, 'up')}
                            disabled={idx === 0}
                            title="Move up"
                          >
                            <FontAwesomeIcon icon="fa-solid fa-arrow-up" />
                          </Button>
                          <Button
                            color="link"
                            size="sm"
                            className="p-0"
                            onClick={() => handleMoveTask(idx, 'down')}
                            disabled={idx === tasks.length - 1}
                            title="Move down"
                          >
                            <FontAwesomeIcon icon="fa-solid fa-arrow-down" />
                          </Button>
                          <Button
                            color="link"
                            size="sm"
                            className="p-0 text-danger"
                            onClick={() => handleRemoveTask(idx)}
                            title="Remove task"
                          >
                            <FontAwesomeIcon icon="fa-solid fa-trash" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>

        <div className="d-flex justify-content-end gap-2">
          <Button color="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button color="primary" type="submit" disabled={saving}>
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                Saving...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon="fa-solid fa-save" className="me-2" />
                Save Checklist
              </>
            )}
          </Button>
        </div>
      </Form>
    </Container>
  );
}

ChecklistTemplateEditor.propTypes = {
  templateId: PropTypes.number,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default ChecklistTemplateEditor;
