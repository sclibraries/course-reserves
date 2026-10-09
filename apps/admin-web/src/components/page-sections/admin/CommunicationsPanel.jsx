/**
 * @file CommunicationsPanel.jsx
 * @description Display all communications/messages for an item with threading
 */

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Spinner,
  Alert,
  Button,
  UncontrolledCollapse
} from 'reactstrap';
import { 
  FaComment, 
  FaStickyNote, 
  FaExclamationCircle,
  FaCheckCircle,
  FaChevronDown,
  FaChevronRight,
  FaReply,
  FaUser,
  FaUsers
} from 'react-icons/fa';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';
import ReplyModal from './ReplyModal';
import './CommunicationsPanel.css';

const CommunicationsPanel = forwardRef(({ submissionId, resourceId }, ref) => {
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedThreads, setExpandedThreads] = useState({});
  
  // Reply modal state
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  
  // Expose refresh method to parent via ref
  useImperativeHandle(ref, () => ({
    refresh: loadCommunications
  }));

  const loadCommunications = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('CommunicationsPanel - Loading communications for:', {
        submissionId,
        resourceId
      });
      
      const messages = await submissionWorkflowService.getSubmissionCommunications(submissionId);
      
      console.log('CommunicationsPanel - Received messages:', messages);
      
      // Filter by resource if provided
      // Note: resource_id might be string or number, so use == instead of ===
      const filtered = resourceId 
        ? messages.filter(comm => comm.resource_id == resourceId)
        : messages;
      
      console.log('CommunicationsPanel - Filtered messages:', {
        total: messages.length,
        filtered: filtered.length,
        resourceId,
        resourceIdType: typeof resourceId,
        sampleResourceIds: messages.slice(0, 3).map(m => ({ id: m.resource_id, type: typeof m.resource_id }))
      });
      
      // Sort by date (newest first)
      const sorted = filtered.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      setCommunications(sorted);
    } catch (err) {
      console.error('CommunicationsPanel - Error loading:', err);
      setError(err.message || 'Failed to load communications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (submissionId) {
      loadCommunications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'note': return <FaStickyNote className="text-warning" />;
      case 'question': return <FaExclamationCircle className="text-info" />;
      case 'issue': return <FaExclamationCircle className="text-danger" />;
      case 'task': return <FaCheckCircle className="text-success" />;
      default: return <FaComment className="text-muted" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'danger';
      case 'high': return 'warning';
      case 'normal': return 'info';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getVisibilityBadge = (visibility) => {
    switch (visibility) {
      case 'faculty_visible': return <Badge color="primary">Faculty Visible</Badge>;
      case 'staff_only': return <Badge color="secondary">Staff Only</Badge>;
      case 'all_staff': return <Badge color="info">All Staff</Badge>;
      case 'assigned_only': return <Badge color="warning">Assigned Only</Badge>;
      default: return null;
    }
  };

  const toggleThread = (messageId) => {
    setExpandedThreads(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };
  
  // Handle opening reply modal
  const handleReplyClick = (message) => {
    setReplyingTo(message);
    setReplyModalOpen(true);
  };
  
  // Handle closing reply modal
  const handleReplyClose = () => {
    setReplyModalOpen(false);
    setReplyingTo(null);
  };
  
  // Handle successful reply - add optimistic update
  const handleReplySent = async (newReply) => {
    // Optimistically add the reply to the UI immediately
    if (newReply && replyingTo) {
      setCommunications(prev => {
        return prev.map(comm => {
          if (comm.id === replyingTo.id) {
            // Add the new reply to the parent message's replies array
            return {
              ...comm,
              replies: [...(comm.replies || []), newReply]
            };
          }
          return comm;
        });
      });
      
      // Auto-expand the thread to show the new reply
      setExpandedThreads(prev => ({
        ...prev,
        [replyingTo.id]: true
      }));
    }
    
    // Still reload in background to ensure consistency
    setTimeout(() => {
      loadCommunications();
    }, 500);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  };

  if (loading) {
    return (
      <Card className="communications-panel">
        <CardBody className="text-center py-4">
          <Spinner color="primary" />
          <p className="mt-2 mb-0 text-muted">Loading communications...</p>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="communications-panel">
        <CardBody>
          <Alert color="danger" className="mb-0">
            {error}
          </Alert>
        </CardBody>
      </Card>
    );
  }

  if (communications.length === 0) {
    return (
      <Card className="communications-panel">
        <CardHeader>
          <FaComment className="me-2" />
          Communications
        </CardHeader>
        <CardBody className="text-center py-4">
          <FaComment size={32} className="text-muted mb-2" />
          <p className="text-muted mb-0">No messages or notes yet</p>
        </CardBody>
      </Card>
    );
  }

  // Group messages by thread (parent_message_id)
  // NOTE: Backend now returns replies nested in parent message's 'replies' array
  const topLevelMessages = communications.filter(comm => !comm.parent_message_id);
  
  // Separate faculty and staff messages
  const facultyMessages = topLevelMessages.filter(msg => 
    msg.sender_type === 'faculty' || 
    msg.communication_type === 'faculty_to_staff' ||
    msg.visibility === 'faculty_visible'
  );
  
  const staffMessages = topLevelMessages.filter(msg => 
    msg.sender_type === 'staff' || 
    msg.communication_type === 'staff_to_staff' ||
    (msg.visibility && msg.visibility !== 'faculty_visible')
  );
  
  // Helper function to render a message
  const renderMessage = (message) => {
    const replies = message.replies || [];
    const hasReplies = replies.length > 0;
    const isExpanded = expandedThreads[message.id];

    return (
      <div key={message.id} className="communication-item">
        <div className="communication-header">
          {getCategoryIcon(message.category)}
          <div className="communication-meta">
            <div className="author-line">
              <strong>{message.sender_name}</strong>
              <span className="text-muted ms-2">{formatDate(message.created_at)}</span>
            </div>
            <div className="badge-line">
              {getVisibilityBadge(message.visibility)}
              {message.priority !== 'normal' && (
                <Badge color={getPriorityColor(message.priority)} className="ms-1">
                  {message.priority}
                </Badge>
              )}
              {message.is_task && (
                <Badge color="success" className="ms-1">
                  <FaCheckCircle className="me-1" />
                  Task
                </Badge>
              )}
              {message.category && message.category !== 'note' && (
                <Badge color="light" className="ms-1">
                  {message.category}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {message.subject && (
          <div className="communication-subject">
            {message.subject}
          </div>
        )}

        <div className="communication-message">
          {message.message}
        </div>
        
        {/* Reply Button */}
        <div className="mt-2">
          <Button
            color="link"
            size="sm"
            className="p-0 text-muted"
            onClick={() => handleReplyClick(message)}
          >
            <FaReply className="me-1" />
            Reply
          </Button>
        </div>

        {message.is_task && message.task_assignee && (
          <div className="task-details">
            <small className="text-muted">
              Assigned to: <strong>{message.task_assignee}</strong>
              {message.task_due_date && ` • Due: ${new Date(message.task_due_date).toLocaleDateString()}`}
            </small>
          </div>
        )}

        {hasReplies && (
          <div className="replies-section mt-2">
            <Button
              color="link"
              size="sm"
              className="p-0"
              id={`toggler-${message.id}`}
              onClick={() => toggleThread(message.id)}
            >
              {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </Button>

            <UncontrolledCollapse toggler={`#toggler-${message.id}`}>
              <div className="replies-list">
                {replies.map((reply) => (
                  <div key={reply.id} className="reply-item">
                    <div className="reply-header">
                      <strong>{reply.sender_name}</strong>
                      <span className="text-muted ms-2">{formatDate(reply.created_at)}</span>
                    </div>
                    <div className="reply-message">{reply.message}</div>
                    <Button
                      color="link"
                      size="sm"
                      className="p-0 text-muted mt-1"
                      onClick={() => handleReplyClick(message)}
                    >
                      <FaReply className="me-1" />
                      Reply
                    </Button>
                  </div>
                ))}
              </div>
            </UncontrolledCollapse>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="communications-panel">
      <CardHeader className="d-flex justify-content-between align-items-center">
        <div>
          <FaComment className="me-2" />
          Communications
          <Badge color="secondary" className="ms-2">{communications.length}</Badge>
        </div>
        <Button size="sm" color="link" onClick={loadCommunications}>
          Refresh
        </Button>
      </CardHeader>
      
      <CardBody className="communications-list p-0">
        {/* Faculty Messages Section */}
        {facultyMessages.length > 0 && (
          <div className="messages-section faculty-section">
            <div className="section-header bg-primary text-white px-3 py-2">
              <strong>
                <FaUser className="me-2" />
                Faculty Messages ({facultyMessages.length})
              </strong>
            </div>
            <div className="section-content p-3">
              {facultyMessages.map(renderMessage)}
            </div>
          </div>
        )}
        
        {/* Staff Messages Section */}
        {staffMessages.length > 0 && (
          <div className="messages-section staff-section">
            <div className="section-header bg-secondary text-white px-3 py-2">
              <strong>
                <FaUsers className="me-2" />
                Staff Messages ({staffMessages.length})
              </strong>
            </div>
            <div className="section-content p-3">
              {staffMessages.map(renderMessage)}
            </div>
          </div>
        )}
        
        {/* Empty state */}
        {facultyMessages.length === 0 && staffMessages.length === 0 && (
          <div className="text-center py-4">
            <FaComment size={32} className="text-muted mb-2" />
            <p className="text-muted mb-0">No messages or notes yet</p>
          </div>
        )}
      </CardBody>
      
      {/* Reply Modal */}
      <ReplyModal
        isOpen={replyModalOpen}
        toggle={handleReplyClose}
        parentMessage={replyingTo}
        submissionId={submissionId}
        onReplySent={handleReplySent}
      />
    </Card>
  );
});

CommunicationsPanel.displayName = 'CommunicationsPanel';

CommunicationsPanel.propTypes = {
  submissionId: PropTypes.string.isRequired,
  resourceId: PropTypes.number // Optional: filter to specific resource
};

export default CommunicationsPanel;
