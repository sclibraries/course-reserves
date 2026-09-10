/**
 * @file MyMentions.jsx
 * @description Display all messages where the current user has been @mentioned
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Spinner,
  Alert,
  Button,
  ListGroup,
  ListGroupItem
} from 'reactstrap';
import { FaBell, FaExclamationCircle, FaCheckCircle, FaEye, FaExternalLinkAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';
import './MyMentions.css';

const MyMentions = () => {
  const navigate = useNavigate();
  const [mentions, setMentions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [markingRead, setMarkingRead] = useState({});

  const loadMentions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await submissionWorkflowService.getMyMentions();
      console.log('MyMentions - Loaded mentions:', data);
      setMentions(data.mentions || []);
    } catch (err) {
      console.error('Failed to load mentions:', err);
      setError(err.message || 'Failed to load mentions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentions();
  }, []);

  const handleMarkAsRead = async (mentionId) => {
    setMarkingRead(prev => ({ ...prev, [mentionId]: true }));
    try {
      await submissionWorkflowService.markAsRead(mentionId);
      
      // Update local state
      setMentions(prev => 
        prev.map(m => m.id === mentionId ? { ...m, is_read: true } : m)
      );
      
      toast.success('Marked as read');
    } catch (error) {
      toast.error('Failed to mark as read');
      console.error(error);
    } finally {
      setMarkingRead(prev => ({ ...prev, [mentionId]: false }));
    }
  };

  const handleViewItem = (mention) => {
    console.log('MyMentions - handleViewItem called with:', mention);
    
    // The API returns submission_id which is actually the resource_id
    // Try both fields to be safe
    const itemId = mention.resource_id || mention.submission_id;
    
    console.log('MyMentions - Navigating to item:', itemId);
    
    if (!itemId) {
      toast.error('Unable to determine item ID');
      return;
    }
    
    // Navigate to My Work Queue with the item expanded
    // The item parameter will be picked up by MyWorkQueue to auto-expand and highlight
    navigate(`/admin?tab=my-work&item=${itemId}`);
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

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'issue': return <FaExclamationCircle className="text-danger" />;
      case 'task': return <FaCheckCircle className="text-success" />;
      default: return <FaBell className="text-info" />;
    }
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
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardBody className="text-center py-5">
          <Spinner color="primary" />
          <p className="mt-3 text-muted">Loading your mentions...</p>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardBody>
          <Alert color="danger">
            <h5>Error Loading Mentions</h5>
            <p className="mb-0">{error}</p>
          </Alert>
          <Button color="primary" onClick={loadMentions}>
            Try Again
          </Button>
        </CardBody>
      </Card>
    );
  }

  const unreadMentions = mentions.filter(m => !m.is_read);
  const readMentions = mentions.filter(m => m.is_read);

  return (
    <Card className="my-mentions-card">
      <CardHeader className="d-flex justify-content-between align-items-center">
        <div>
          <FaBell className="me-2" />
          <strong>My Mentions</strong>
          {unreadMentions.length > 0 && (
            <Badge color="danger" pill className="ms-2">
              {unreadMentions.length} unread
            </Badge>
          )}
        </div>
        <Button size="sm" color="link" onClick={loadMentions}>
          Refresh
        </Button>
      </CardHeader>

      <CardBody className="p-0">
        {mentions.length === 0 ? (
          <div className="text-center py-5">
            <FaBell size={48} className="text-muted mb-3" />
            <p className="text-muted mb-0">No mentions yet</p>
            <small className="text-muted">
              When someone tags you with @yourname, it will appear here
            </small>
          </div>
        ) : (
          <>
            {/* Unread Mentions */}
            {unreadMentions.length > 0 && (
              <div className="mentions-section">
                <div className="section-header bg-light px-3 py-2 border-bottom">
                  <small className="text-uppercase fw-bold text-muted">
                    Unread ({unreadMentions.length})
                  </small>
                </div>
                <ListGroup flush>
                  {unreadMentions.map((mention) => (
                    <ListGroupItem key={mention.id} className="mention-item unread">
                      <div className="mention-header">
                        <div className="d-flex align-items-center">
                          {getCategoryIcon(mention.category)}
                          <span className="ms-2 fw-bold">{mention.sender_name}</span>
                          <span className="ms-2 text-muted small">{formatDate(mention.created_at)}</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          {mention.priority !== 'normal' && (
                            <Badge color={getPriorityColor(mention.priority)} pill>
                              {mention.priority}
                            </Badge>
                          )}
                          <Badge color="primary" pill>Unread</Badge>
                        </div>
                      </div>

                      {mention.subject && (
                        <div className="mention-subject mt-2">
                          <strong>{mention.subject}</strong>
                        </div>
                      )}

                      <div className="mention-message mt-2">
                        {mention.message}
                      </div>

                      <div className="mention-actions mt-3">
                        <Button
                          size="sm"
                          color="primary"
                          outline
                          onClick={() => handleViewItem(mention)}
                        >
                          <FaExternalLinkAlt className="me-1" />
                          View Item
                        </Button>
                        <Button
                          size="sm"
                          color="secondary"
                          outline
                          className="ms-2"
                          onClick={() => handleMarkAsRead(mention.id)}
                          disabled={markingRead[mention.id]}
                        >
                          <FaEye className="me-1" />
                          {markingRead[mention.id] ? 'Marking...' : 'Mark as Read'}
                        </Button>
                      </div>
                    </ListGroupItem>
                  ))}
                </ListGroup>
              </div>
            )}

            {/* Read Mentions */}
            {readMentions.length > 0 && (
              <div className="mentions-section">
                <div className="section-header bg-light px-3 py-2 border-bottom">
                  <small className="text-uppercase fw-bold text-muted">
                    Read ({readMentions.length})
                  </small>
                </div>
                <ListGroup flush>
                  {readMentions.map((mention) => (
                    <ListGroupItem key={mention.id} className="mention-item read">
                      <div className="mention-header">
                        <div className="d-flex align-items-center">
                          {getCategoryIcon(mention.category)}
                          <span className="ms-2 text-muted">{mention.sender_name}</span>
                          <span className="ms-2 text-muted small">{formatDate(mention.created_at)}</span>
                        </div>
                        {mention.priority !== 'normal' && (
                          <Badge color={getPriorityColor(mention.priority)} pill>
                            {mention.priority}
                          </Badge>
                        )}
                      </div>

                      {mention.subject && (
                        <div className="mention-subject mt-2 text-muted">
                          {mention.subject}
                        </div>
                      )}

                      <div className="mention-message mt-2 text-muted">
                        {mention.message}
                      </div>

                      <div className="mention-actions mt-3">
                        <Button
                          size="sm"
                          color="secondary"
                          outline
                          onClick={() => handleViewItem(mention)}
                        >
                          <FaExternalLinkAlt className="me-1" />
                          View Item
                        </Button>
                      </div>
                    </ListGroupItem>
                  ))}
                </ListGroup>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
};

export default MyMentions;
