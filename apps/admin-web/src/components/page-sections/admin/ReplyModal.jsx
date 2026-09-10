/**
 * @file ReplyModal.jsx
 * @description Modal for replying to existing messages with threading support
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
import { FaReply, FaPaperPlane, FaTimes, FaAt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';
import './StaffMessagingModal.css'; // Reuse the same CSS

const ReplyModal = ({ isOpen, toggle, parentMessage, submissionId, onReplySent }) => {
  const [message, setMessage] = useState('');
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
      toast.error('Please enter a reply message');
      return;
    }

    setSending(true);
    try {
      const data = {
        message: message.trim(),
        parent_message_id: parentMessage.id,
        category: parentMessage.category || 'note',
        priority: parentMessage.priority || 'normal',
        visibility: parentMessage.visibility || 'all_staff',
        resource_id: parentMessage.resource_id
      };

      const response = await submissionWorkflowService.createCommunication(submissionId, data);
      
      toast.success('Reply sent successfully');
      
      if (onReplySent) {
        // Pass the created reply back for optimistic update
        // If API returns the created communication, use it; otherwise create a temp one
        const newReply = response.communication || {
          id: Date.now(), // Temporary ID
          message: data.message,
          sender_name: 'You',
          created_at: new Date().toISOString(),
          parent_message_id: data.parent_message_id,
          resource_id: data.resource_id,
          category: data.category,
          priority: data.priority,
          visibility: data.visibility,
          replies: []
        };
        onReplySent(newReply);
      }
      
      toggle();
    } catch (error) {
      toast.error(error.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  if (!parentMessage) return null;

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="lg" className="staff-messaging-modal">
      <ModalHeader toggle={toggle}>
        <FaReply className="me-2" />
        Reply to Message
      </ModalHeader>
      
      <Form onSubmit={handleSubmit}>
        <ModalBody>
          {/* Parent Message Context */}
          <Alert color="light" className="mb-3">
            <small className="text-muted">Replying to:</small>
            <div className="mt-2">
              <strong>{parentMessage.sender_name}</strong>
              {parentMessage.subject && (
                <div className="mt-1"><strong>Subject:</strong> {parentMessage.subject}</div>
              )}
              <div className="mt-2 p-2 bg-white border rounded">
                {parentMessage.message}
              </div>
            </div>
          </Alert>

          <Alert color="info" className="mb-3">
            <small>
              <strong>Tip:</strong> Use <code>@username</code> to mention staff members. 
              Your reply will inherit the visibility settings of the parent message.
            </small>
          </Alert>

          {/* Reply Message */}
          <FormGroup className="position-relative">
            <Label for="message">
              Your Reply <span className="text-danger">*</span>
            </Label>
            <Input
              id="message"
              type="textarea"
              innerRef={textareaRef}
              value={message}
              onChange={handleMessageChange}
              rows={6}
              placeholder="Type your reply here... Use @username to mention staff"
              required
              autoFocus
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

          {/* Reply Context Info */}
          <div className="border-top pt-3">
            <small className="text-muted">
              <strong>Visibility:</strong> {parentMessage.visibility.replace('_', ' ')} (same as parent)<br />
              <strong>Category:</strong> {parentMessage.category}
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
                Send Reply
              </>
            )}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
};

ReplyModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  parentMessage: PropTypes.object,
  submissionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onReplySent: PropTypes.func
};

export default ReplyModal;
