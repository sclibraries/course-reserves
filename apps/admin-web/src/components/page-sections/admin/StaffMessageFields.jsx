import PropTypes from 'prop-types';
import {
  Alert,
  FormGroup,
  Input,
  Label,
  ListGroup,
  ListGroupItem,
  Spinner,
} from 'reactstrap';
import { FaAt, FaExclamationCircle } from 'react-icons/fa';

function StaffMessageFields({
  item,
  subject,
  setSubject,
  message,
  onMessageChange,
  textareaRef,
  showMentions,
  searchingStaff,
  staffUsers,
  mentionQuery,
  insertMention,
  category,
  setCategory,
  priority,
  setPriority,
  visibility,
  setVisibility,
  isTask,
  setIsTask,
  taskAssignee,
  setTaskAssignee,
  taskDueDate,
  setTaskDueDate,
}) {
  return (
    <>
      <Alert color="info" className="mb-3">
        <small>
          <strong>Tip:</strong> Use <code>@username</code> to mention staff members.
          Messages are visible to all staff by default.
        </small>
      </Alert>

      <FormGroup>
        <Label for="subject">Subject (optional)</Label>
        <Input
          id="subject"
          type="text"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Brief subject line"
        />
      </FormGroup>

      <FormGroup className="position-relative">
        <Label for="message">Message <span className="text-danger">*</span></Label>
        <Input
          id="message"
          type="textarea"
          innerRef={textareaRef}
          value={message}
          onChange={onMessageChange}
          rows={6}
          placeholder="Type your message here... Use @username to mention staff"
          required
        />
        {showMentions && (
          <div className="mention-dropdown">
            {searchingStaff ? (
              <div className="mention-loading"><Spinner size="sm" /> Searching...</div>
            ) : staffUsers.length > 0 ? (
              <ListGroup flush>
                {staffUsers.map((user) => (
                  <ListGroupItem
                    key={user.id}
                    action
                    onClick={() => insertMention(user.username)}
                    className="mention-option"
                  >
                    <FaAt className="me-2 text-muted" />
                    <strong>@{user.username}</strong>
                    <span className="text-muted ms-2">- {user.full_name}</span>
                  </ListGroupItem>
                ))}
              </ListGroup>
            ) : mentionQuery.length >= 2 ? (
              <div className="mention-empty">No staff found matching &ldquo;{mentionQuery}&rdquo;</div>
            ) : null}
          </div>
        )}
      </FormGroup>

      <div className="row">
        <div className="col-md-4">
          <FormGroup>
            <Label for="category">Category</Label>
            <Input id="category" type="select" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="question">Question</option>
              <option value="issue">Issue</option>
              <option value="update">Update</option>
              <option value="acquisitions">Acquisitions</option>
              <option value="cataloging">Cataloging</option>
              <option value="digitization">Digitization</option>
              <option value="copyright">Copyright</option>
              <option value="task">Task</option>
            </Input>
          </FormGroup>
        </div>
        <div className="col-md-4">
          <FormGroup>
            <Label for="priority">Priority</Label>
            <Input id="priority" type="select" value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Input>
          </FormGroup>
        </div>
        <div className="col-md-4">
          <FormGroup>
            <Label for="visibility">Visibility</Label>
            <Input id="visibility" type="select" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
              <option value="staff_only">Staff</option>
              <option value="faculty_visible">Faculty</option>
              <option value="assigned_only">Assignee</option>
            </Input>
          </FormGroup>
        </div>
      </div>

      <FormGroup check className="mb-3">
        <Input id="isTask" type="checkbox" checked={isTask} onChange={(event) => setIsTask(event.target.checked)} />
        <Label for="isTask" check>
          <FaExclamationCircle className="me-1 text-warning" />
          Create as Task (requires action)
        </Label>
      </FormGroup>

      {isTask && (
        <div className="task-options border p-3 rounded bg-light mb-3">
          <div className="row">
            <div className="col-md-6">
              <FormGroup>
                <Label for="taskAssignee">Assign To (username)</Label>
                <Input id="taskAssignee" type="text" value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)} placeholder="username" />
              </FormGroup>
            </div>
            <div className="col-md-6">
              <FormGroup>
                <Label for="taskDueDate">Due Date</Label>
                <Input
                  id="taskDueDate"
                  type="date"
                  value={taskDueDate}
                  onChange={(event) => setTaskDueDate(event.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </FormGroup>
            </div>
          </div>
        </div>
      )}

      <div className="item-context border-top pt-3">
        <small className="text-muted">
          <strong>Item:</strong> {item.title}<br />
          <strong>Course:</strong> {item.submission?.course_code} - {item.submission?.course_title}<br />
          <strong>Faculty:</strong> {item.submission?.faculty_display_name}
        </small>
      </div>
    </>
  );
}

StaffMessageFields.propTypes = {
  item: PropTypes.object.isRequired,
  subject: PropTypes.string.isRequired,
  setSubject: PropTypes.func.isRequired,
  message: PropTypes.string.isRequired,
  onMessageChange: PropTypes.func.isRequired,
  textareaRef: PropTypes.object.isRequired,
  showMentions: PropTypes.bool.isRequired,
  searchingStaff: PropTypes.bool.isRequired,
  staffUsers: PropTypes.arrayOf(PropTypes.object).isRequired,
  mentionQuery: PropTypes.string.isRequired,
  insertMention: PropTypes.func.isRequired,
  category: PropTypes.string.isRequired,
  setCategory: PropTypes.func.isRequired,
  priority: PropTypes.string.isRequired,
  setPriority: PropTypes.func.isRequired,
  visibility: PropTypes.string.isRequired,
  setVisibility: PropTypes.func.isRequired,
  isTask: PropTypes.bool.isRequired,
  setIsTask: PropTypes.func.isRequired,
  taskAssignee: PropTypes.string.isRequired,
  setTaskAssignee: PropTypes.func.isRequired,
  taskDueDate: PropTypes.string.isRequired,
  setTaskDueDate: PropTypes.func.isRequired,
};

export default StaffMessageFields;
