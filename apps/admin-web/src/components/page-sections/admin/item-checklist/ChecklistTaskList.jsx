import PropTypes from 'prop-types';
import { Badge, Card, CardBody, Form, FormGroup, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function ChecklistTaskList({ tasks, taskNotes, saving, onTaskToggle, onNotesChange, onNotesBlur }) {
  return (
    <Form>
      {tasks.map((task, index) => (
        <Card key={task.id} className="mb-3 border">
          <CardBody className="p-3">
            <div className="d-flex align-items-start">
              <div className="me-3 mt-1">
                <Input
                  type="checkbox"
                  checked={task.completed || false}
                  onChange={() => onTaskToggle(task.id, task.completed)}
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
                    <strong>{index + 1}. {task.label}</strong>
                  </Label>
                  <div>
                    {!task.optional && <Badge color="warning" className="ms-2">Required</Badge>}
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
                <FormGroup className="mb-0">
                  <Input
                    type="textarea"
                    rows="2"
                    value={taskNotes[task.id] || ''}
                    onChange={(event) => onNotesChange(task.id, event.target.value)}
                    onBlur={() => onNotesBlur(task.id, task.completed)}
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
  );
}

ChecklistTaskList.propTypes = {
  tasks: PropTypes.arrayOf(PropTypes.object).isRequired,
  taskNotes: PropTypes.object.isRequired,
  saving: PropTypes.bool.isRequired,
  onTaskToggle: PropTypes.func.isRequired,
  onNotesChange: PropTypes.func.isRequired,
  onNotesBlur: PropTypes.func.isRequired
};

export default ChecklistTaskList;
