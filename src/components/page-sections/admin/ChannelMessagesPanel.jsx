/**
 * @file ChannelMessagesPanel.jsx
 * @description Display messages for a specific channel (faculty or staff) with threading
 */

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Spinner,
  Alert
} from 'reactstrap';
import { 
  FaComment, 
  FaStickyNote, 
  FaExclamationCircle,
  FaCheckCircle
} from 'react-icons/fa';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';
import './CommunicationsPanel.css';

const ChannelMessagesPanel = forwardRef(({ submissionId, resourceId, channel, onThreadClick }, ref) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Expose refresh method to parent via ref
  useImperativeHandle(ref, () => ({
    refresh: loadMessages
  }));

  const loadMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const allMessages = await submissionWorkflowService.getSubmissionCommunications(submissionId);
      
      // Filter by resource if provided
      const filtered = resourceId 
        ? allMessages.filter(comm => comm.resource_id == resourceId)
        : allMessages;
      
      // Filter by channel
      const channelMessages = filtered.filter(msg => {
        if (channel === 'faculty') {
          return msg.sender_type === 'faculty' || 
                 msg.communication_type === 'faculty_to_staff' ||
                 msg.visibility === 'faculty_visible';
        } else if (channel === 'notes') {
          return msg.category === 'note' ||
                 msg.communication_type === 'note' ||
                 msg.communication_type === 'internal_note';
        } else { // staff channel
          // Exclude notes from staff channel
          const isNote = msg.category === 'note' || 
                        msg.communication_type === 'note' ||
                        msg.communication_type === 'internal_note';
          
          return !isNote && (
            msg.sender_type === 'staff' || 
            msg.communication_type === 'staff_to_staff' ||
            (msg.visibility && msg.visibility !== 'faculty_visible')
          );
        }
      });
      
      // Sort by date (newest first)
      const sorted = channelMessages.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      setMessages(sorted);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (submissionId) {
      loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, resourceId, channel]);

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

  // Separate top-level messages from replies
  const topLevelMessages = messages.filter(msg => !msg.parent_message_id);

  // Helper to render a single message
  const renderMessage = (msg) => {
    const hasReplies = msg.replies && msg.replies.length > 0;

    return (
      <div 
        key={msg.id} 
        className="communication-item clickable-message" 
        onClick={() => onThreadClick && onThreadClick(msg)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onThreadClick && onThreadClick(msg);
          }
        }}
      >
        <div className="communication-header">
          {getIcon(msg)}
          <div className="communication-meta">
            <div className="author-line">
              <strong>{msg.sender_name || 'Unknown'}</strong>
              <span className="text-muted ms-2 small">
                {new Date(msg.created_at).toLocaleString()}
              </span>
            </div>
            <div className="badge-line">
              <Badge color={getBadgeColor(msg.communication_type)} size="sm">
                {msg.communication_type?.replace(/_/g, ' ') || 'message'}
              </Badge>
              {msg.priority && (
                <Badge color="danger" size="sm">{msg.priority}</Badge>
              )}
              {msg.visibility && (
                <Badge color="info" size="sm">{msg.visibility}</Badge>
              )}
              {hasReplies && (
                <Badge color="secondary" size="sm">{msg.replies.length} replies</Badge>
              )}
            </div>
          </div>
        </div>

        {msg.subject && (
          <div className="communication-subject">{msg.subject}</div>
        )}

        <div className="communication-message">{msg.message}</div>

        {msg.has_task && msg.task_description && (
          <div className="task-details">
            <small className="text-muted">Task:</small> {msg.task_description}
          </div>
        )}

        {/* Quick action: Click anywhere to view thread */}
        {hasReplies && (
          <div className="thread-hint text-muted small mt-2">
            <FaComment className="me-1" />
            Click to view {msg.replies.length} {msg.replies.length === 1 ? 'reply' : 'replies'}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <Spinner color="primary" />
        <p className="mt-2">Loading messages...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert color="danger">
        <strong>Error:</strong> {error}
      </Alert>
    );
  }

  return (
    <div className="communications-panel">
      <Card className="h-100">
        <CardHeader className="d-flex justify-content-between align-items-center">
          <strong>
            {channel === 'faculty' && `Faculty Messages (${topLevelMessages.length})`}
            {channel === 'staff' && `Staff Messages (${topLevelMessages.length})`}
            {channel === 'notes' && `Internal Notes (${topLevelMessages.length})`}
          </strong>
        </CardHeader>
        <CardBody className="communications-list">
          {topLevelMessages.length === 0 ? (
            <Alert color="info" className="mb-0">
              No {channel === 'notes' ? 'internal notes' : `${channel} messages`} yet.
            </Alert>
          ) : (
            topLevelMessages.map(msg => renderMessage(msg))
          )}
        </CardBody>
      </Card>
    </div>
  );
});

ChannelMessagesPanel.displayName = 'ChannelMessagesPanel';

ChannelMessagesPanel.propTypes = {
  submissionId: PropTypes.number.isRequired,
  resourceId: PropTypes.number,
  channel: PropTypes.oneOf(['faculty', 'staff', 'notes']).isRequired,
  onThreadClick: PropTypes.func
};

export default ChannelMessagesPanel;
