/**
 * @file ThreadViewPanel.jsx
 * @description Display a single message thread with all replies (Slack-like)
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Button,
  Input,
  FormGroup
} from 'reactstrap';
import { 
  FaComment, 
  FaStickyNote, 
  FaExclamationCircle,
  FaCheckCircle,
  FaTimes,
  FaPaperPlane
} from 'react-icons/fa';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';
import { toast } from 'react-toastify';
import './CommunicationsPanel.css';

const ThreadViewPanel = ({ thread, onClose, onReplyAdded }) => {
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!thread) {
    return null;
  }

  // Get icon based on communication type
  const getIcon = (comm) => {
    if (comm.has_task) return <FaCheckCircle className="text-success" />;
    if (comm.priority === 'high') return <FaExclamationCircle className="text-danger" />;
    if (comm.communication_type === 'note') return <FaStickyNote className="text-secondary" />;
    return <FaComment className="text-primary" />;
  };

  // Get badge color based on type
  const getBadgeColor = (type) => {
    const colors = {
      'faculty_to_staff': 'info',
      'staff_to_staff': 'secondary',
      'note': 'warning'
    };
    return colors[type] || 'secondary';
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim()) {
      toast.warning('Please enter a reply');
      return;
    }

    setSubmitting(true);
    try {
      // Get submission_id from thread
      const submissionId = thread.submission_id;
      if (!submissionId) {
        throw new Error('Missing submission_id in thread data');
      }

      const replyData = {
        parent_message_id: thread.id,
        message: replyText,
        category: 'reply',
        visibility: thread.visibility || 'staff_only',
        communication_type: thread.communication_type || 'staff_to_staff',
        resource_id: thread.resource_id || null
      };

      const result = await submissionWorkflowService.createCommunication(submissionId, replyData);
      
      if (result) {
        toast.success('Reply added');
        setReplyText('');
        
        // Fetch the full communication data including the new reply
        const updatedComms = await submissionWorkflowService.getSubmissionCommunications(submissionId);
        
        // Find the parent message with updated replies
        const updatedThread = updatedComms.find(msg => msg.id === thread.id);
        
        if (updatedThread && updatedThread.replies && updatedThread.replies.length > 0) {
          // Get the newly added reply (should be the last one with matching ID)
          const newReply = updatedThread.replies.find(r => r.id === result.id) || 
                          updatedThread.replies[updatedThread.replies.length - 1];
          
          if (onReplyAdded && newReply) {
            onReplyAdded(newReply);
          }
        }
      }
    } catch (error) {
      console.error('Error submitting reply:', error);
      toast.error('Failed to add reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmitReply();
    }
  };

  return (
    <div className="thread-view-panel">
      <Card className="h-100">
        <CardHeader className="d-flex justify-content-between align-items-center">
          <strong>Thread</strong>
          <Button
            close
            onClick={onClose}
            aria-label="Close"
          >
            <FaTimes />
          </Button>
        </CardHeader>
        <CardBody className="thread-content">
          {/* Parent Message */}
          <div className="communication-item parent-message">
            <div className="communication-header">
              {getIcon(thread)}
              <div className="communication-meta">
                <div className="author-line">
                  <strong>{thread.sender_name || 'Unknown'}</strong>
                  <span className="text-muted ms-2 small">
                    {new Date(thread.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="badge-line">
                  <Badge color={getBadgeColor(thread.communication_type)} size="sm">
                    {thread.communication_type?.replace(/_/g, ' ') || 'message'}
                  </Badge>
                  {thread.priority && (
                    <Badge color="danger" size="sm">{thread.priority}</Badge>
                  )}
                  {thread.visibility && (
                    <Badge color="info" size="sm">{thread.visibility}</Badge>
                  )}
                </div>
              </div>
            </div>

            {thread.subject && (
              <div className="communication-subject">{thread.subject}</div>
            )}

            <div className="communication-message">{thread.message}</div>

            {thread.has_task && thread.task_description && (
              <div className="task-details">
                <small className="text-muted">Task:</small> {thread.task_description}
              </div>
            )}
          </div>

          {/* Replies */}
          {thread.replies && thread.replies.length > 0 && (
            <div className="replies-section mt-3">
              <h6 className="text-muted mb-3">
                {thread.replies.length} {thread.replies.length === 1 ? 'Reply' : 'Replies'}
              </h6>
              <div className="replies-list-thread">
                {thread.replies.map(reply => (
                  <div key={reply.id} className="reply-item">
                    <div className="reply-header">
                      <strong>{reply.sender_name || 'Unknown'}</strong>
                      <span className="text-muted ms-2 small">
                        {new Date(reply.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="reply-message">{reply.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Reply Input */}
          <div className="quick-reply-section mt-3 pt-3 border-top">
            <FormGroup>
              <div className="d-flex gap-2">
                <Input
                  type="textarea"
                  rows="3"
                  placeholder="Type a reply... (Cmd/Ctrl + Enter to send)"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={submitting}
                />
                <Button
                  color="primary"
                  onClick={handleSubmitReply}
                  disabled={submitting || !replyText.trim()}
                  style={{ height: 'fit-content' }}
                >
                  <FaPaperPlane />
                </Button>
              </div>
              <small className="text-muted">Press Cmd/Ctrl + Enter to send</small>
            </FormGroup>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

ThreadViewPanel.propTypes = {
  thread: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onReplyAdded: PropTypes.func
};

export default ThreadViewPanel;
