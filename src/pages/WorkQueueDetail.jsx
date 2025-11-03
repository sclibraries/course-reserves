/**
 * @file WorkQueueDetail - Dedicated page for managing work queue items
 * @module WorkQueueDetail
 * @description Three-panel Slack-like interface for comprehensive item management
 */
import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Card,
  CardBody,
  Button,
  Badge,
  Spinner,
  Alert
} from 'reactstrap';
import {
  FaArrowLeft,
  FaEnvelope,
  FaComment,
  FaStickyNote,
  FaShoppingCart,
  FaBook,
  FaTimes,
  FaUser,
  FaUsers,
  FaTasks
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import useSubmissionWorkflowStore from '../store/submissionWorkflowStore';
import { submissionWorkflowService } from '../services/admin/submissionWorkflowService';
import ItemStatusDropdown from '../components/page-sections/admin/ItemStatusDropdown';
import StaffMessagingModal from '../components/page-sections/admin/StaffMessagingModal';
import FacultyMessageModal from '../components/page-sections/admin/FacultyMessageModal';
import QuickNoteModal from '../components/page-sections/admin/QuickNoteModal';
import ChannelMessagesPanel from '../components/page-sections/admin/ChannelMessagesPanel';
import ThreadViewPanel from '../components/page-sections/admin/ThreadViewPanel';
import WorkflowPanel from '../components/page-sections/admin/WorkflowPanel';
import './WorkQueueDetail.css';

/**
 * WorkQueueDetail - Full-page work queue item management
 * Three-panel layout:
 * - Left: Queue items list (sidebar)
 * - Center: Item details + actions
 * - Right: Communications thread
 */
const WorkQueueDetail = () => {
  const navigate = useNavigate();
  const { itemId } = useParams();
  
  const {
    claimedItems,
    loading,
    error,
    fetchClaimedItems,
    updateItemStatus,
    clearError
  } = useSubmissionWorkflowStore();

  const [selectedItem, setSelectedItem] = useState(null);
  const messagesRef = useRef(null);
  
  // Communication counts per channel
  const [channelCounts, setChannelCounts] = useState({
    faculty: 0,
    staff: 0,
    notes: 0
  });
  
  // Modal states
  const [staffMessageModal, setStaffMessageModal] = useState({ isOpen: false, item: null });
  const [facultyMessageModal, setFacultyMessageModal] = useState({ isOpen: false, item: null });
  const [noteModal, setNoteModal] = useState({ isOpen: false, item: null });
  
  // Channel selection (Slack-like)
  const [selectedChannel, setSelectedChannel] = useState('details'); // 'details', 'workflow', 'faculty', 'staff', or 'notes'
  
  // Thread view state
  const [selectedThread, setSelectedThread] = useState(null);

  // Fetch items claimed by current user
  useEffect(() => {
    fetchClaimedItems();
  }, [fetchClaimedItems]);

  // Format items with parsed resource_data - MEMOIZED to prevent infinite loop
  const formattedItems = useMemo(() => {
    if (!claimedItems) return [];
    
    return claimedItems.map(item => {
      let resourceData = {};
      try {
        resourceData = item.resource_data ? JSON.parse(item.resource_data) : {};
      } catch (e) {
        console.warn('Failed to parse resource_data:', e);
      }
      
      return {
        ...item,
        title: resourceData.title || item.title || 'Untitled',
        authors: resourceData.authors || '',
        course_code: item.submission?.course_code || item.course_code || 'N/A',
        course_title: item.submission?.course_title || item.course_title || '',
        instructor_name: item.submission?.faculty_display_name || item.instructor_name || item.faculty_name || 'N/A',
        materialTypeName: item.materialType?.name || resourceData.materialType || 'Unknown',
        barcode: item.source_barcode || resourceData.barcode,
        callNumber: item.source_call_number || resourceData.callNumber,
        url: resourceData.url
      };
    });
  }, [claimedItems]);

  // Select item based on URL parameter
  useEffect(() => {
    if (itemId && formattedItems && formattedItems.length > 0) {
      const item = formattedItems.find(i => 
        String(i.id) === String(itemId) ||
        String(i.submission_id) === String(itemId) ||
        String(i.resource_id) === String(itemId)
      );
      
      if (item) {
        setSelectedItem(item);
      } else {
        // Item not found, redirect back to work queue
        toast.warning('Item not found in your work queue');
        navigate('/admin?tab=my-work');
      }
    } else if (!itemId && formattedItems && formattedItems.length > 0) {
      // No item selected, auto-select first item
      const firstItem = formattedItems[0];
      navigate(`/admin/work-queue/${firstItem.id}`, { replace: true });
    }
  }, [itemId, formattedItems, navigate]);

  // Handle status change
  const handleStatusChange = async (itemId, newStatus) => {
    try {
      await updateItemStatus(itemId, newStatus);
      toast.success('Status updated successfully');
      
      // Refresh the item data
      await fetchClaimedItems();
    } catch {
      toast.error('Failed to update status');
    }
  };

  // Message modal handlers
  const handleSendMessage = () => {
    setStaffMessageModal({ isOpen: false, item: null });
    setFacultyMessageModal({ isOpen: false, item: null });
    setNoteModal({ isOpen: false, item: null });
    
    // Trigger messages refresh using the ref
    if (messagesRef.current?.refresh) {
      messagesRef.current.refresh();
    }
    
    // Also refresh the items list to update any counts
    fetchClaimedItems();
    
    // Refresh channel counts
    if (selectedItem) {
      loadChannelCounts(selectedItem);
    }
  };

  // Load message counts for each channel
  const loadChannelCounts = async (item) => {
    if (!item || !item.submission_id) return;
    
    try {
      const allMessages = await submissionWorkflowService.getSubmissionCommunications(
        parseInt(item.submission_id)
      );
      
      // Filter by resource if provided
      const resourceId = parseInt(item.resource_id || item.id);
      const filtered = resourceId 
        ? allMessages.filter(comm => comm.resource_id == resourceId)
        : allMessages;
      
      // Count by channel using same logic as ChannelMessagesPanel
      const counts = {
        faculty: filtered.filter(msg => 
          msg.sender_type === 'faculty' || 
          msg.communication_type === 'faculty_to_staff' ||
          msg.visibility === 'faculty_visible'
        ).length,
        staff: filtered.filter(msg => {
          // Exclude notes from staff channel
          const isNote = msg.category === 'note' || 
                        msg.communication_type === 'note' ||
                        msg.communication_type === 'internal_note';
          
          return !isNote && (
            msg.sender_type === 'staff' || 
            msg.communication_type === 'staff_to_staff' ||
            (msg.visibility && msg.visibility !== 'faculty_visible')
          );
        }).length,
        notes: filtered.filter(msg => 
          msg.category === 'note' ||
          msg.communication_type === 'note' ||
          msg.communication_type === 'internal_note'
        ).length
      };
      
      setChannelCounts(counts);
    } catch (err) {
      console.error('Error loading channel counts:', err);
      setChannelCounts({ faculty: 0, staff: 0, notes: 0 });
    }
  };

  // Load channel counts when item changes
  useEffect(() => {
    if (selectedItem) {
      loadChannelCounts(selectedItem);
    }
  }, [selectedItem]);

  // Get item type badge
  const getItemTypeBadge = (item) => {
    const type = item.item_type || 'unknown';
    const typeConfig = {
      submission: { color: 'primary', icon: FaEnvelope, label: 'Submission' },
      purchase_request: { color: 'success', icon: FaShoppingCart, label: 'Purchase Request' },
      resource: { color: 'info', icon: FaBook, label: 'Resource' }
    };
    
    const config = typeConfig[type] || typeConfig.submission;
    const Icon = config.icon;
    
    return (
      <Badge color={config.color} className="me-2">
        <Icon className="me-1" />
        {config.label}
      </Badge>
    );
  };

  // Get priority badge
  const getPriorityBadge = (priority) => {
    const colors = {
      high: 'danger',
      medium: 'warning',
      low: 'secondary'
    };
    
    return priority ? (
      <Badge color={colors[priority] || 'secondary'}>
        {priority.toUpperCase()}
      </Badge>
    ) : null;
  };

  if (loading) {
    return (
      <Container fluid className="py-4">
        <div className="text-center">
          <Spinner color="primary" />
          <p className="mt-3">Loading work queue...</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container fluid className="py-4">
        <Alert color="danger">
          Error loading work queue: {error}
          <Button color="link" onClick={clearError}>Dismiss</Button>
        </Alert>
      </Container>
    );
  }

  if (!formattedItems || formattedItems.length === 0) {
    return (
      <Container fluid className="py-4">
        <Alert color="info">
          <h5>No items in your work queue</h5>
          <p>Claim items from the submissions queue to get started.</p>
          <Button color="primary" onClick={() => navigate('/admin?tab=submissions')}>
            Go to Submissions
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <div className="work-queue-detail">
      {/* Header */}
      <div className="work-queue-header">
        <Container fluid>
          <div className="d-flex align-items-center justify-content-between py-3">
            <div className="d-flex align-items-center gap-3">
              <Button
                color="link"
                className="text-decoration-none"
                onClick={() => navigate('/admin?tab=my-work')}
              >
                <FaArrowLeft className="me-2" />
                Back to Queue
              </Button>
              <h4 className="mb-0">My Work Queue</h4>
              <Badge color="primary" pill>
                {formattedItems.length} {formattedItems.length === 1 ? 'item' : 'items'}
              </Badge>
            </div>
          </div>
        </Container>
      </div>

      {/* Three-panel layout (with optional 4th for threads) */}
      <div className="work-queue-panels">
        {/* COLUMN 1 - Course Information */}
        <div className="panel panel-left">
          {selectedItem ? (
            <>
              <div className="panel-header">
                <h6 className="mb-0">Course Information</h6>
              </div>

              <div className="panel-content">
                <Card>
                  <CardBody>
                    <div className="mb-3">
                      <small className="text-muted d-block">Course Code</small>
                      <h5 className="mb-0">
                        {selectedItem.course_code || 'N/A'}
                      </h5>
                    </div>

                    <div className="mb-3">
                      <small className="text-muted d-block">Instructor</small>
                      <strong>{selectedItem.instructor_name || selectedItem.faculty_name || 'No instructor'}</strong>
                    </div>

                    {selectedItem.course_title && (
                      <div className="mb-3">
                        <small className="text-muted d-block">Course Title</small>
                        <div>{selectedItem.course_title}</div>
                      </div>
                    )}

                    <div className="mb-3">
                      <small className="text-muted d-block">Item Type</small>
                      <div>{getItemTypeBadge(selectedItem)}</div>
                    </div>

                    <div className="mb-3">
                      <small className="text-muted d-block">Status</small>
                      <ItemStatusDropdown
                        currentStatus={selectedItem.status}
                        itemId={selectedItem.id}
                        onStatusChange={handleStatusChange}
                      />
                    </div>

                    <div className="mb-3">
                      <small className="text-muted d-block">Priority</small>
                      {getPriorityBadge(selectedItem.priority) || <span className="text-muted">Not set</span>}
                    </div>
                  </CardBody>
                </Card>
              </div>
            </>
          ) : (
            <div className="panel-content">
              <Alert color="info">Select an item to view details</Alert>
            </div>
          )}
        </div>

        {/* COLUMN 2 - Channels */}
        <div className="panel panel-center">
          <div className="panel-header">
            <h6 className="mb-0">Channels</h6>
          </div>
          <div className="panel-content">
            {selectedItem ? (
              <>
                {/* Item Details Channel */}
                <div
                  className={`channel-item ${selectedChannel === 'details' ? 'active' : ''}`}
                  onClick={() => setSelectedChannel('details')}
                >
                  <div className="d-flex align-items-center gap-2">
                    <FaBook className="text-primary" />
                    <span className="channel-name">Item Details</span>
                  </div>
                </div>

                {/* Workflow Channel */}
                <div
                  className={`channel-item ${selectedChannel === 'workflow' ? 'active' : ''}`}
                  onClick={() => setSelectedChannel('workflow')}
                >
                  <div className="d-flex align-items-center justify-content-between w-100">
                    <div className="d-flex align-items-center gap-2">
                      <FaTasks className="text-success" />
                      <span className="channel-name">Workflow</span>
                    </div>
                    {/* TODO: Add workflow progress badge */}
                  </div>
                </div>

                {/* Faculty Communication Channel */}
                <div
                  className={`channel-item ${selectedChannel === 'faculty' ? 'active' : ''}`}
                  onClick={() => setSelectedChannel('faculty')}
                >
                  <div className="d-flex align-items-center justify-content-between w-100">
                    <div className="d-flex align-items-center gap-2">
                      <FaUser className="text-info" />
                      <span className="channel-name">Faculty Communication</span>
                    </div>
                    {channelCounts.faculty > 0 && (
                      <Badge color="secondary" pill>{channelCounts.faculty}</Badge>
                    )}
                  </div>
                </div>

                {/* Staff Communication Channel */}
                <div
                  className={`channel-item ${selectedChannel === 'staff' ? 'active' : ''}`}
                  onClick={() => setSelectedChannel('staff')}
                >
                  <div className="d-flex align-items-center justify-content-between w-100">
                    <div className="d-flex align-items-center gap-2">
                      <FaUsers className="text-secondary" />
                      <span className="channel-name">Staff Communication</span>
                    </div>
                    {channelCounts.staff > 0 && (
                      <Badge color="secondary" pill>{channelCounts.staff}</Badge>
                    )}
                  </div>
                </div>

                {/* Internal Notes Channel */}
                <div
                  className={`channel-item ${selectedChannel === 'notes' ? 'active' : ''}`}
                  onClick={() => setSelectedChannel('notes')}
                >
                  <div className="d-flex align-items-center justify-content-between w-100">
                    <div className="d-flex align-items-center gap-2">
                      <FaStickyNote className="text-warning" />
                      <span className="channel-name">Internal Notes</span>
                    </div>
                    {channelCounts.notes > 0 && (
                      <Badge color="secondary" pill>{channelCounts.notes}</Badge>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <Alert color="info" className="mb-0">
                Select an item
              </Alert>
            )}
          </div>
        </div>

        {/* COLUMN 3 - Channel Content */}
        <div className="panel panel-right">
          <div className="panel-header">
            <div className="d-flex align-items-center justify-content-between w-100 flex-column gap-2">
              <div className="d-flex align-items-center justify-content-between w-100">
                <h6 className="mb-0">
                  {selectedChannel === 'details' && 'Item Details'}
                  {selectedChannel === 'workflow' && 'Workflow'}
                  {selectedChannel === 'faculty' && 'Faculty Communication'}
                  {selectedChannel === 'staff' && 'Staff Communication'}
                  {selectedChannel === 'notes' && 'Internal Notes'}
                </h6>
              </div>
              
              {/* Action buttons - show only for the matching channel */}
              {!selectedThread && selectedItem && (
                <div className="d-flex gap-2 w-100 pt-2 border-top">
                  {selectedChannel === 'staff' && (
                    <Button
                      color="primary"
                      size="sm"
                      onClick={() => setStaffMessageModal({ isOpen: true, item: selectedItem })}
                    >
                      <FaComment className="me-1" />
                      Staff Message
                    </Button>
                  )}
                  {selectedChannel === 'faculty' && (
                    <Button
                      color="info"
                      size="sm"
                      onClick={() => setFacultyMessageModal({ isOpen: true, item: selectedItem })}
                    >
                      <FaEnvelope className="me-1" />
                      Faculty Message
                    </Button>
                  )}
                  {selectedChannel === 'notes' && (
                    <Button
                      color="secondary"
                      size="sm"
                      onClick={() => setNoteModal({ isOpen: true, item: selectedItem })}
                    >
                      <FaStickyNote className="me-1" />
                      Quick Note
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="panel-content">
            {selectedItem ? (
              selectedChannel === 'details' ? (
                // Item Details View
                <Card>
                  <CardBody>
                    <div className="mb-3">
                      <small className="text-muted d-block">Course Code</small>
                      <strong>{selectedItem.course_code || 'N/A'}</strong>
                    </div>
                    {selectedItem.course_title && (
                      <div className="mb-3">
                        <small className="text-muted d-block">Course Title</small>
                        <strong>{selectedItem.course_title}</strong>
                      </div>
                    )}
                    <div className="mb-3">
                      <small className="text-muted d-block">Instructor</small>
                      <strong>{selectedItem.instructor_name || selectedItem.faculty_name || 'N/A'}</strong>
                    </div>
                    {selectedItem.title && (
                      <div className="mb-3">
                        <small className="text-muted d-block">Item Title</small>
                        <strong>{selectedItem.title}</strong>
                      </div>
                    )}
                    {selectedItem.authors && (
                      <div className="mb-3">
                        <small className="text-muted d-block">Author(s)</small>
                        <div>{selectedItem.authors}</div>
                      </div>
                    )}
                    {selectedItem.materialTypeName && (
                      <div className="mb-3">
                        <small className="text-muted d-block">Material Type</small>
                        <div>{selectedItem.materialTypeName}</div>
                      </div>
                    )}
                    {selectedItem.barcode && (
                      <div className="mb-3">
                        <small className="text-muted d-block">Barcode</small>
                        <div>{selectedItem.barcode}</div>
                      </div>
                    )}
                    {selectedItem.callNumber && (
                      <div className="mb-3">
                        <small className="text-muted d-block">Call Number</small>
                        <div>{selectedItem.callNumber}</div>
                      </div>
                    )}
                    {selectedItem.url && (
                      <div className="mb-3">
                        <small className="text-muted d-block">URL</small>
                        <a href={selectedItem.url} target="_blank" rel="noopener noreferrer">
                          {selectedItem.url}
                        </a>
                      </div>
                    )}
                    {selectedItem.submission_id && (
                      <div className="mb-3">
                        <small className="text-muted d-block">Submission ID</small>
                        <div>{selectedItem.submission_id}</div>
                      </div>
                    )}
                    {selectedItem.resource_id && (
                      <div className="mb-3">
                        <small className="text-muted d-block">Resource ID</small>
                        <div>{selectedItem.resource_id}</div>
                      </div>
                    )}
                    {selectedItem.notes && (
                      <div className="mb-3">
                        <small className="text-muted d-block">Notes</small>
                        <p className="mb-0">{selectedItem.notes}</p>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ) : selectedChannel === 'workflow' ? (
                // Workflow View
                <WorkflowPanel
                  submissionId={parseInt(selectedItem.submission_id)}
                  resourceId={parseInt(selectedItem.resource_id || selectedItem.id)}
                  item={selectedItem}
                />
              ) : selectedChannel === 'faculty' || selectedChannel === 'staff' || selectedChannel === 'notes' ? (
                // Messages View (faculty, staff, notes channels only)
                <ChannelMessagesPanel
                  ref={messagesRef}
                  submissionId={parseInt(selectedItem.submission_id)}
                  resourceId={parseInt(selectedItem.resource_id || selectedItem.id)}
                  channel={selectedChannel}
                  onThreadClick={(message) => setSelectedThread(message)}
                />
              ) : (
                <Alert color="info" className="mb-0">
                  Select a channel
                </Alert>
              )
            ) : (
              <Alert color="info" className="mb-0">
                Select an item
              </Alert>
            )}
          </div>
        </div>

        {/* COLUMN 4 - Thread View (only when thread selected) */}
        {selectedThread && (
          <div className="panel panel-thread">
            <div className="panel-header">
              <div className="d-flex align-items-center justify-content-between w-100">
                <h6 className="mb-0">
                  <Button
                    color="link"
                    size="sm"
                    className="p-0 me-2"
                    onClick={() => setSelectedThread(null)}
                  >
                    <FaArrowLeft />
                  </Button>
                  Thread
                </h6>
                <Button
                  color="link"
                  size="sm"
                  className="p-0"
                  onClick={() => setSelectedThread(null)}
                >
                  <FaTimes />
                </Button>
              </div>
            </div>
            <div className="panel-content">
              <ThreadViewPanel
                thread={selectedThread}
                onClose={() => setSelectedThread(null)}
                onReplyAdded={(newReply) => {
                  // Update the thread with the new reply
                  if (selectedThread && newReply) {
                    const updatedThread = {
                      ...selectedThread,
                      replies: [...(selectedThread.replies || []), newReply]
                    };
                    setSelectedThread(updatedThread);
                  }
                  
                  // Refresh messages list
                  if (messagesRef.current) {
                    messagesRef.current.refresh();
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <StaffMessagingModal
        isOpen={staffMessageModal.isOpen}
        toggle={() => setStaffMessageModal({ isOpen: false, item: null })}
        item={staffMessageModal.item}
        onMessageSent={handleSendMessage}
      />

      <FacultyMessageModal
        isOpen={facultyMessageModal.isOpen}
        toggle={() => setFacultyMessageModal({ isOpen: false, item: null })}
        item={facultyMessageModal.item}
        onMessageSent={handleSendMessage}
      />

      <QuickNoteModal
        isOpen={noteModal.isOpen}
        toggle={() => setNoteModal({ isOpen: false, item: null })}
        item={noteModal.item}
        onNoteSaved={handleSendMessage}
      />
    </div>
  );
};

export default WorkQueueDetail;
