/**
 * @file FacultyMessageModal.jsx
 * @description Modal for sending messages to faculty (always faculty_visible)
 */

import { useState, useEffect } from 'react';
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
  Spinner,
  Alert
} from 'reactstrap';
import { FaEnvelope, FaPaperPlane, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';

const FacultyMessageModal = ({ isOpen, toggle, item, onMessageSent }) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSubject('');
      setMessage('');
    }
  }, [isOpen]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (!subject.trim()) {
      toast.error('Please enter a subject');
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
        subject: subject.trim(),
        category: 'update',
        priority: 'normal',
        visibility: 'faculty_visible',
        resource_id: item.id,
      };

      await submissionWorkflowService.createCommunication(submissionId, data);
      
      toast.success('Message sent to faculty');
      
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
    <Modal isOpen={isOpen} toggle={toggle} size="lg">
      <ModalHeader toggle={toggle}>
        <FaEnvelope className="me-2" />
        Message Faculty - {item.title}
      </ModalHeader>
      
      <Form onSubmit={handleSubmit}>
        <ModalBody>
          <Alert color="info" className="mb-3">
            <small>
              <strong>Note:</strong> This message will be visible to the faculty member who submitted this course reserve request.
            </small>
          </Alert>

          {/* Faculty Info */}
          <div className="border-bottom pb-3 mb-3">
            <small className="text-muted">
              <strong>To:</strong> {item.submission?.faculty_display_name} ({item.submission?.faculty_email})<br />
              <strong>Course:</strong> {item.submission?.course_code} - {item.submission?.course_title}
            </small>
          </div>

          {/* Subject */}
          <FormGroup>
            <Label for="subject">
              Subject <span className="text-danger">*</span>
            </Label>
            <Input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject line"
              required
            />
          </FormGroup>

          {/* Message */}
          <FormGroup>
            <Label for="message">
              Message <span className="text-danger">*</span>
            </Label>
            <Input
              id="message"
              type="textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              placeholder="Type your message to the faculty member..."
              required
            />
          </FormGroup>

          {/* Item Context */}
          <div className="border-top pt-3">
            <small className="text-muted">
              <strong>Item:</strong> {item.title}
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
                Send to Faculty
              </>
            )}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
};

FacultyMessageModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  item: PropTypes.object,
  onMessageSent: PropTypes.func
};

export default FacultyMessageModal;
