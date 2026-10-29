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
  Spinner,
} from 'reactstrap';
import { FaComment, FaPaperPlane, FaTimes } from 'react-icons/fa';
import { notify } from '../../../services/notify';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';
import StaffMessageFields from './StaffMessageFields';
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
      notify.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      // Get numeric submission_id from item - API requires numeric ID, not UUID
      const submissionId = item.submission_id;
      
      if (!submissionId) {
        console.error('Item structure:', item);
        notify.error('Unable to find submission ID');
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
      
      notify.success('Message sent');
      
      if (onMessageSent) {
        onMessageSent();
      }
      
      toggle();
    } catch (error) {
      notify.fromError(error, "Couldn't send the message");
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
          <StaffMessageFields
            item={item}
            subject={subject}
            setSubject={setSubject}
            message={message}
            onMessageChange={handleMessageChange}
            textareaRef={textareaRef}
            showMentions={showMentions}
            searchingStaff={searchingStaff}
            staffUsers={staffUsers}
            mentionQuery={mentionQuery}
            insertMention={insertMention}
            category={category}
            setCategory={setCategory}
            priority={priority}
            setPriority={setPriority}
            visibility={visibility}
            setVisibility={setVisibility}
            isTask={isTask}
            setIsTask={setIsTask}
            taskAssignee={taskAssignee}
            setTaskAssignee={setTaskAssignee}
            taskDueDate={taskDueDate}
            setTaskDueDate={setTaskDueDate}
          />
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
