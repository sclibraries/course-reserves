import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardBody,
  CardHeader,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  Alert,
  Spinner,
  Progress,
  Badge
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { toast } from 'react-toastify';
import { checklistService } from '../../../services/admin/checklistService';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * ItemChecklistView - Display and manage checklist for a submission item
 * 
 * Shows the assigned checklist and allows staff to check off tasks as they complete them.
 */
function ItemChecklistView({ itemId, onComplete }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState(null);
  const [error, setError] = useState(null);
  const [taskNotes, setTaskNotes] = useState({});
  const [templates, setTemplates] = useState([]);
  const [showSelector, setShowSelector] = useState(false);
  const [noChecklistAssigned, setNoChecklistAssigned] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedMaterialType, setSelectedMaterialType] = useState('all');

  useEffect(() => {
    loadChecklist();
    loadTemplates();
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTemplates = async () => {
    try {
      const data = await checklistService.listTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  // Filter templates based on search and filters
  const getFilteredTemplates = () => {
    return templates.filter(template => {
      // Search filter
      const matchesSearch = !searchQuery || 
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Format filter
      const matchesFormat = selectedFormat === 'all' || template.format === selectedFormat;
      
      // Material type filter
      const matchesMaterialType = selectedMaterialType === 'all' || 
        (template.material_types && template.material_types.includes(selectedMaterialType));
      
      return matchesSearch && matchesFormat && matchesMaterialType;
    });
  };

  // Get unique formats and material types for filters
  const getUniqueFormats = () => {
    const formats = new Set(templates.map(t => t.format).filter(Boolean));
    return Array.from(formats).sort();
  };

  const getUniqueMaterialTypes = () => {
    const types = new Set();
    templates.forEach(t => {
      if (t.material_types && Array.isArray(t.material_types)) {
        t.material_types.forEach(type => types.add(type));
      }
    });
    return Array.from(types).sort();
  };

  // Reset filters when selector is closed
  const handleCloseSelector = () => {
    setShowSelector(false);
    setSearchQuery('');
    setSelectedFormat('all');
    setSelectedMaterialType('all');
  };

  const loadChecklist = async () => {
    try {
      setLoading(true);
      setError(null);
      setNoChecklistAssigned(false);
      const data = await checklistService.getItemChecklist(itemId);
      setChecklist(data);
      
      // Initialize notes from existing task data
      const notes = {};
      if (data.tasks) {
        data.tasks.forEach(task => {
          if (task.notes) {
            notes[task.id] = task.notes;
          }
        });
      }
      setTaskNotes(notes);
    } catch (err) {
      console.error('Failed to load checklist:', err);
      // Check if it's a 404 (no checklist assigned)
      console.log(err)
      if (err.status === 404 || (err.message && err.message.toLowerCase().includes('No checklist assigned to this item'))) {
        setNoChecklistAssigned(true);
        setError(null);
      } else {
        setError('Failed to load checklist. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAssignChecklist = async (templateId) => {
    try {
      setSaving(true);
      await checklistService.assignChecklistToItem(itemId, templateId, user?.username);
      toast.success('Checklist assigned successfully');
      setShowSelector(false);
      setNoChecklistAssigned(false);
      loadChecklist();
    } catch (err) {
      console.error('Failed to assign checklist:', err);
      toast.error('Failed to assign checklist');
    } finally {
      setSaving(false);
    }
  };

  const handleTaskToggle = async (taskId, currentStatus) => {
    try {
      setSaving(true);
      const newStatus = !currentStatus;
      const notes = taskNotes[taskId] || null;
      
      await checklistService.updateTaskStatus(itemId, taskId, newStatus, notes, user?.username);
      
      // Update local state
      setChecklist(prev => ({
        ...prev,
        tasks: prev.tasks.map(task =>
          task.id === taskId
            ? { ...task, completed: newStatus, completed_at: newStatus ? new Date().toISOString() : null }
            : task
        )
      }));

      toast.success(`Task ${newStatus ? 'completed' : 'unchecked'}`);
    } catch (err) {
      console.error('Failed to update task:', err);
      toast.error('Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleNotesChange = (taskId, notes) => {
    setTaskNotes(prev => ({
      ...prev,
      [taskId]: notes
    }));
  };

  const handleNotesBlur = async (taskId, completed) => {
    // Save notes when field loses focus
    try {
      const notes = taskNotes[taskId] || null;
      await checklistService.updateTaskStatus(itemId, taskId, completed, notes, user?.username);
    } catch (err) {
      console.error('Failed to save notes:', err);
    }
  };

  const handleCompleteAll = async () => {
    if (!window.confirm('Are you sure you want to mark all remaining tasks as complete and finish this item?')) {
      return;
    }

    try {
      setSaving(true);
      await checklistService.completeItemChecklist(itemId, user?.username);
      toast.success('Item completed successfully!');
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error('Failed to complete checklist:', err);
      toast.error('Failed to complete checklist');
      setSaving(false);
    }
  };

  const getProgress = () => {
    if (!checklist?.tasks || checklist.tasks.length === 0) return 0;
    const completed = checklist.tasks.filter(task => task.completed).length;
    return Math.round((completed / checklist.tasks.length) * 100);
  };

  const getRequiredTasksRemaining = () => {
    if (!checklist?.tasks) return 0;
    return checklist.tasks.filter(task => !task.optional && !task.completed).length;
  };

  if (loading) {
    return (
      <Card>
        <CardBody className="text-center py-5">
          <Spinner color="primary" />
          <p className="mt-2">Loading checklist...</p>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardBody>
          <Alert color="danger">
            <h5>Error</h5>
            <p>{error}</p>
            <Button color="primary" size="sm" onClick={loadChecklist}>
              Try Again
            </Button>
          </Alert>
        </CardBody>
      </Card>
    );
  }

  if (!checklist && noChecklistAssigned) {
    return (
      <Card>
        <CardBody>
          {!showSelector ? (
            <>
              <Alert color="info">
                <h5>
                  <FontAwesomeIcon icon="fa-solid fa-clipboard-list" className="me-2" />
                  No Checklist Assigned
                </h5>
                <p>This item doesn&apos;t have a checklist assigned yet. Select a checklist template to get started.</p>
              </Alert>
              <Button 
                color="primary" 
                onClick={() => setShowSelector(true)}
                disabled={templates.length === 0}
              >
                <FontAwesomeIcon icon="fa-solid fa-plus" className="me-2" />
                Assign Checklist
              </Button>
              {templates.length === 0 && (
                <p className="text-muted mt-2 mb-0">
                  <small>No checklist templates available. Create templates in the Admin Checklists section.</small>
                </p>
              )}
            </>
          ) : (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Select Checklist Template</h5>
                <Button 
                  color="link" 
                  size="sm"
                  onClick={handleCloseSelector}
                >
                  Cancel
                </Button>
              </div>
              
              {/* Search and Filters */}
              <div className="mb-3">
                <Input
                  type="text"
                  placeholder="Search templates by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-2"
                />
                <div className="d-flex gap-2">
                  <Input
                    type="select"
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    bsSize="sm"
                  >
                    <option value="all">All Formats</option>
                    {getUniqueFormats().map(format => (
                      <option key={format} value={format}>{format}</option>
                    ))}
                  </Input>
                  <Input
                    type="select"
                    value={selectedMaterialType}
                    onChange={(e) => setSelectedMaterialType(e.target.value)}
                    bsSize="sm"
                  >
                    <option value="all">All Material Types</option>
                    {getUniqueMaterialTypes().map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </Input>
                </div>
              </div>

              {/* Template List */}
              <div className="list-group" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {getFilteredTemplates().length === 0 ? (
                  <div className="text-center text-muted py-4">
                    <FontAwesomeIcon icon="fa-solid fa-search" size="2x" className="mb-2" />
                    <p className="mb-0">No templates match your search criteria</p>
                  </div>
                ) : (
                  getFilteredTemplates().map(template => (
                  <button
                    key={template.id}
                    type="button"
                    className="list-group-item list-group-item-action"
                    onClick={() => handleAssignChecklist(template.id)}
                    disabled={saving}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h6 className="mb-1">{template.name}</h6>
                        <p className="mb-1 text-muted small">{template.description}</p>
                        <div className="d-flex gap-2 mt-2">
                          <Badge color="secondary">
                            {template.task_count} {template.task_count === 1 ? 'task' : 'tasks'}
                          </Badge>
                          <Badge color="info">{template.format}</Badge>
                          {template.material_types && template.material_types.length > 0 && (
                            <Badge color="light">
                              {template.material_types.join(', ')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <FontAwesomeIcon icon="fa-solid fa-chevron-right" className="text-muted" />
                    </div>
                  </button>
                  ))
                )}
              </div>
            </>
          )}
        </CardBody>
      </Card>
    );
  }

  // If no checklist data, don't try to render
  if (!checklist) {
    return (
      <Card>
        <CardBody>
          <Alert color="info">
            <FontAwesomeIcon icon="fa-solid fa-clipboard-list" className="me-2" />
            Loading checklist...
          </Alert>
        </CardBody>
      </Card>
    );
  }

  const progress = getProgress();
  const requiredRemaining = getRequiredTasksRemaining();
  const allRequiredComplete = requiredRemaining === 0;

  return (
    <Card>
      <CardHeader className="bg-white">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-1">
              <FontAwesomeIcon icon="fa-solid fa-clipboard-check" className="me-2" />
              {checklist.template_name}
            </h5>
            {checklist.description && (
              <p className="text-muted small mb-0">{checklist.description}</p>
            )}
          </div>
          <div className="d-flex align-items-center gap-3">
            <Button
              color="outline-secondary"
              size="sm"
              onClick={() => setShowSelector(true)}
            >
              <FontAwesomeIcon icon="fa-solid fa-exchange-alt" className="me-1" />
              Change
            </Button>
            <div className="text-end">
              <div className="text-muted small mb-1">Progress</div>
              <h4 className="mb-0">{progress}%</h4>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardBody>
        {/* Checklist Selector Modal */}
        {showSelector && (
          <Alert color="light" className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">Change Checklist Template</h6>
              <Button 
                color="link" 
                size="sm"
                className="text-decoration-none"
                onClick={handleCloseSelector}
              >
                <FontAwesomeIcon icon="fa-solid fa-times" /> Cancel
              </Button>
            </div>
            
            {/* Search and Filters */}
            <div className="mb-3">
              <Input
                type="text"
                placeholder="Search templates by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-2"
              />
              <div className="d-flex gap-2">
                <Input
                  type="select"
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  bsSize="sm"
                >
                  <option value="all">All Formats</option>
                  {getUniqueFormats().map(format => (
                    <option key={format} value={format}>{format}</option>
                  ))}
                </Input>
                <Input
                  type="select"
                  value={selectedMaterialType}
                  onChange={(e) => setSelectedMaterialType(e.target.value)}
                  bsSize="sm"
                >
                  <option value="all">All Material Types</option>
                  {getUniqueMaterialTypes().map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Input>
              </div>
            </div>

            {/* Template List */}
            <div className="list-group" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {getFilteredTemplates().length === 0 ? (
                <div className="text-center text-muted py-4">
                  <FontAwesomeIcon icon="fa-solid fa-search" size="2x" className="mb-2" />
                  <p className="mb-0">No templates match your search criteria</p>
                </div>
              ) : (
                getFilteredTemplates().map(template => {
                  const isCurrent = template.id === checklist.template_id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className={`list-group-item list-group-item-action ${isCurrent ? 'border-primary' : ''}`}
                      onClick={() => handleAssignChecklist(template.id)}
                      disabled={saving || isCurrent}
                      style={isCurrent ? { 
                        backgroundColor: '#e7f3ff',
                        borderWidth: '2px'
                      } : {}}
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <h6 className="mb-0">{template.name}</h6>
                            {isCurrent && (
                              <Badge color="primary">Current</Badge>
                            )}
                          </div>
                          {template.description && (
                            <p className="mb-2 small text-muted">{template.description}</p>
                          )}
                          <div className="d-flex gap-2 flex-wrap">
                            <Badge color="secondary">
                              <FontAwesomeIcon icon="fa-solid fa-tasks" className="me-1" />
                              {template.task_count} {template.task_count === 1 ? 'task' : 'tasks'}
                            </Badge>
                            <Badge color="info">
                              <FontAwesomeIcon icon="fa-solid fa-book" className="me-1" />
                              {template.format}
                            </Badge>
                            {template.material_types && template.material_types.length > 0 && (
                              <Badge color="light" className="text-dark">
                                <FontAwesomeIcon icon="fa-solid fa-tag" className="me-1" />
                                {template.material_types.join(', ')}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {!isCurrent && (
                          <FontAwesomeIcon icon="fa-solid fa-chevron-right" className="text-muted ms-2" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Alert>
        )}
        
        {/* Progress Bar */}
        <div className="mb-4">
          <Progress
            value={progress}
            color={progress === 100 ? 'success' : 'primary'}
            className="mb-2"
          />
          <div className="d-flex justify-content-between text-muted small">
            <span>
              {checklist.tasks.filter(t => t.completed).length} of {checklist.tasks.length} tasks completed
            </span>
            {requiredRemaining > 0 && (
              <span className="text-warning">
                {requiredRemaining} required {requiredRemaining === 1 ? 'task' : 'tasks'} remaining
              </span>
            )}
          </div>
        </div>

        {/* Task List */}
        <Form>
          {checklist.tasks.map((task, idx) => (
            <Card key={task.id} className="mb-3 border">
              <CardBody className="p-3">
                <div className="d-flex align-items-start">
                  <div className="me-3 mt-1">
                    <Input
                      type="checkbox"
                      checked={task.completed || false}
                      onChange={() => handleTaskToggle(task.id, task.completed)}
                      disabled={saving}
                      style={{ width: '20px', height: '20px' }}
                    />
                  </div>
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <Label
                        className="mb-0"
                        style={{
                          textDecoration: task.completed ? 'line-through' : 'none',
                          color: task.completed ? '#6c757d' : 'inherit'
                        }}
                      >
                        <strong>{idx + 1}. {task.label}</strong>
                      </Label>
                      <div>
                        {!task.optional && (
                          <Badge color="warning" className="ms-2">Required</Badge>
                        )}
                        {task.completed && (
                          <Badge color="success" className="ms-2">
                            <FontAwesomeIcon icon="fa-solid fa-check" className="me-1" />
                            Done
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {task.help_text && (
                      <div className="text-muted small mb-2">
                        <FontAwesomeIcon icon="fa-solid fa-info-circle" className="me-1" />
                        {task.help_text}
                      </div>
                    )}

                    {task.completed && task.completed_at && (
                      <div className="text-muted small mb-2">
                        Completed: {new Date(task.completed_at).toLocaleString()}
                      </div>
                    )}

                    {/* Optional notes for each task */}
                    <FormGroup className="mb-0">
                      <Input
                        type="textarea"
                        rows="2"
                        value={taskNotes[task.id] || ''}
                        onChange={(e) => handleNotesChange(task.id, e.target.value)}
                        onBlur={() => handleNotesBlur(task.id, task.completed)}
                        placeholder="Optional notes..."
                        disabled={saving}
                        bsSize="sm"
                      />
                    </FormGroup>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </Form>

        {/* Complete Button */}
        <div className="mt-4 pt-3 border-top">
          {allRequiredComplete ? (
            <Alert color="success" className="mb-3">
              <FontAwesomeIcon icon="fa-solid fa-check-circle" className="me-2" />
              All required tasks are complete! You can now mark this item as done.
            </Alert>
          ) : (
            <Alert color="warning" className="mb-3">
              <FontAwesomeIcon icon="fa-solid fa-exclamation-triangle" className="me-2" />
              Please complete all required tasks before marking this item as done.
            </Alert>
          )}

          <div className="d-flex gap-2">
            <Button
              color="success"
              onClick={handleCompleteAll}
              disabled={saving || !allRequiredComplete}
              className="flex-grow-1"
            >
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Processing...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon="fa-solid fa-check" className="me-2" />
                  Mark Item as Complete
                </>
              )}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

ItemChecklistView.propTypes = {
  itemId: PropTypes.number.isRequired,
  onComplete: PropTypes.func,
};

export default ItemChecklistView;
