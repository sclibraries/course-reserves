/**
 * @file StaffMessagingModal.jsx
 * @description Modal for staff-to-staff messaging with @mentions, tasks, and threading
 */

import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Form,
  FormGroup,
  Label,
  Input,
  ListGroup,
  ListGroupItem,
  Spinner,
  Alert
} from 'reactstrap';
import { FaComment, FaPaperPlane, FaTimes, FaAt, FaExclamationCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';
import './StaffMessagingModal.css';

const StaffMessagingModal = ({ isOpen, toggle, item, onMessageSent }) => {
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('question');
  const [priority, setPriority] = useState('normal');
  const [visibility, setVisibility] = useState('staff_only');
  const [isTask, setIsTask] = useState(false);
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [sending, setSending] = useState(false);
  
  // @mention autocomplete
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [staffUsers, setStaffUsers] = useState([]);
  const [searchingStaff, setSearchingStaff] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const textareaRef = useRef(null);
  const mentionTimeoutRef = useRef(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setSubject('');
      setCategory('question');
      setPriority('normal');
      setVisibility('staff_only');
      setIsTask(false);
      setTaskAssignee('');
      setTaskDueDate('');
    }
  }, [isOpen]);

  // Search staff for @mentions
  const searchStaff = async (query) => {
    if (query.length < 2) {
      setStaffUsers([]);
      return;
    }

    setSearchingStaff(true);
    try {
      const users = await submissionWorkflowService.searchStaff(query);
      setStaffUsers(users);
    } catch (error) {
      console.error('Failed to search staff:', error);
    } finally {
      setSearchingStaff(false);
    }
  };

  // Handle textarea change and detect @mentions
  const handleMessageChange = (e) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    
    setMessage(value);
    setCursorPosition(cursor);

    // Detect @ symbol for mention autocomplete
    const textBeforeCursor = value.substring(0, cursor);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      setShowMentions(true);
      
      // Debounce the search
      if (mentionTimeoutRef.current) {
        clearTimeout(mentionTimeoutRef.current);
      }
      mentionTimeoutRef.current = setTimeout(() => {
        searchStaff(query);
      }, 300);
    } else {
      setShowMentions(false);
      setStaffUsers([]);
    }
  };

  // Insert @mention into textarea
  const insertMention = (username) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const textBeforeCursor = message.substring(0, cursorPosition);
    const textAfterCursor = message.substring(cursorPosition);
    
    // Replace the @partial with @username
    const updatedText = textBeforeCursor.replace(/@\w*$/, `@${username} `) + textAfterCursor;
    
    setMessage(updatedText);
    setShowMentions(false);
    setStaffUsers([]);
    
    // Set cursor position after mention
    setTimeout(() => {
      const newCursorPos = textBeforeCursor.replace(/@\w*$/, `@${username} `).length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      // Get numeric submission_id from item - API requires numeric ID, not UUID
      const submissionId = item.submission_id || item.submission?.submission_id || item.submission?.id;
      
      if (!submissionId) {
        console.error('Item structure:', item);
        toast.error('Unable to find submission ID');
        setSending(false);
        return;
      }

      const data = {
        message: message.trim(),
        subject: subject.trim() || undefined,
        category,
        priority,
        visibility,
        resource_id: item.id,
        is_task: isTask,
        task_assignee: isTask && taskAssignee ? taskAssignee : undefined,
        task_due_date: isTask && taskDueDate ? taskDueDate : undefined,
      };

      await submissionWorkflowService.createCommunication(submissionId, data);
      
      toast.success('Message sent successfully');
      
      if (onMessageSent) {
        onMessageSent();
      }
      
      toggle();
    } catch (error) {
      toast.error(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (!item) return null;

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="lg" className="staff-messaging-modal">
      <ModalHeader toggle={toggle}>
        <FaComment className="me-2" />
        Staff Message - {item.title}
      </ModalHeader>
      
      <Form onSubmit={handleSubmit}>
        <ModalBody>
          <Alert color="info" className="mb-3">
            <small>
              <strong>Tip:</strong> Use <code>@username</code> to mention staff members. 
              Messages are visible to all staff by default.
            </small>
          </Alert>

          {/* Subject (optional) */}
          <FormGroup>
            <Label for="subject">Subject (optional)</Label>
            <Input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief subject line"
            />
          </FormGroup>

          {/* Message */}
          <FormGroup className="position-relative">
            <Label for="message">
              Message <span className="text-danger">*</span>
            </Label>
            <Input
              id="message"
              type="textarea"
              innerRef={textareaRef}
              value={message}
              onChange={handleMessageChange}
              rows={6}
              placeholder="Type your message here... Use @username to mention staff"
              required
            />
            
            {/* @Mention Autocomplete Dropdown */}
            {showMentions && (
              <div className="mention-dropdown">
                {searchingStaff ? (
                  <div className="mention-loading">
                    <Spinner size="sm" /> Searching...
                  </div>
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
            {/* Category */}
            <div className="col-md-4">
              <FormGroup>
                <Label for="category">Category</Label>
                <Input
                  id="category"
                  type="select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
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

            {/* Priority */}
            <div className="col-md-4">
              <FormGroup>
                <Label for="priority">Priority</Label>
                <Input
                  id="priority"
                  type="select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Input>
              </FormGroup>
            </div>

            {/* Visibility */}
            <div className="col-md-4">
              <FormGroup>
                <Label for="visibility">Visibility</Label>
                <Input
                  id="visibility"
                  type="select"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                >
                  <option value="staff_only">Staff</option>
                  <option value="faculty_visible">Faculty</option>
                  <option value="assigned_only">Assignee</option>
                </Input>
              </FormGroup>
            </div>
          </div>

          {/* Task Options */}
          <FormGroup check className="mb-3">
            <Input
              id="isTask"
              type="checkbox"
              checked={isTask}
              onChange={(e) => setIsTask(e.target.checked)}
            />
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
                    <Input
                      id="taskAssignee"
                      type="text"
                      value={taskAssignee}
                      onChange={(e) => setTaskAssignee(e.target.value)}
                      placeholder="username"
                    />
                  </FormGroup>
                </div>
                <div className="col-md-6">
                  <FormGroup>
                    <Label for="taskDueDate">Due Date</Label>
                    <Input
                      id="taskDueDate"
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </FormGroup>
                </div>
              </div>
            </div>
          )}

          {/* Item Context */}
          <div className="item-context border-top pt-3">
            <small className="text-muted">
              <strong>Item:</strong> {item.title}<br />
              <strong>Course:</strong> {item.submission?.course_code} - {item.submission?.course_title}<br />
              <strong>Faculty:</strong> {item.submission?.faculty_display_name}
            </small>
          </div>
        </ModalBody>
        
        <ModalFooter>
          <Button color="secondary" onClick={toggle} disabled={sending}>
            <FaTimes className="me-1" />
            Cancel
          </Button>
          <Button color="primary" type="submit" disabled={sending}>
            {sending ? (
              <>
                <Spinner size="sm" className="me-1" />
                Sending...
              </>
            ) : (
              <>
                <FaPaperPlane className="me-1" />
                Send Message
              </>
            )}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
};

StaffMessagingModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  item: PropTypes.object,
  onMessageSent: PropTypes.func
};

export default StaffMessagingModal;
