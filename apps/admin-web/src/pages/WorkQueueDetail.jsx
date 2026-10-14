/**
 * @file WorkQueueDetail - Dedicated page for managing work queue items
 * @module WorkQueueDetail
 * @description Three-panel Slack-like interface for comprehensive item management
 */
import { Alert, Badge, Button, Container, Spinner } from 'reactstrap';
import { FaArrowLeft } from 'react-icons/fa';
import { toast } from 'react-toastify';
import useWorkQueueDetail from '../hooks/admin/useWorkQueueDetail';
import WorkQueueSidebar from '../components/page-sections/admin/work-queue/WorkQueueSidebar';
import WorkQueueChannelContent from '../components/page-sections/admin/work-queue/WorkQueueChannelContent';
import WorkQueueThreadPanel from '../components/page-sections/admin/work-queue/WorkQueueThreadPanel';
import WorkQueueModals from '../components/page-sections/admin/work-queue/WorkQueueModals';
import { getCompletionReturnPath } from '../util/workQueueDetail';
import './WorkQueueDetail.css';

export {
  buildWorkQueueProcessingAction,
  findSelectedWorkQueueItem,
  getCompletionReturnPath
} from '../util/workQueueDetail';

function WorkQueueDetail() {
  const state = useWorkQueueDetail();
  const {
    navigate,
    loading,
    error,
    clearError,
    fetchClaimedItems,
    formattedItems,
    selectedItem,
    selectedChannel,
    setSelectedChannel,
    selectedThread,
    setSelectedThread,
    channelCounts,
    messagesRef,
    processingAction,
    handleStatusChange,
    handleReplyAdded,
    handleSendMessage,
    staffMessageModal,
    setStaffMessageModal,
    facultyMessageModal,
    setFacultyMessageModal,
    noteModal,
    setNoteModal
  } = state;

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
      <div className="work-queue-header">
        <Container fluid>
          <div className="d-flex align-items-center justify-content-between py-3">
            <div className="d-flex align-items-center gap-3">
              <Button color="link" className="text-decoration-none" onClick={() => navigate(getCompletionReturnPath())}>
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
      <div className="work-queue-panels">
        <WorkQueueSidebar
          selectedItem={selectedItem}
          selectedChannel={selectedChannel}
          onChannelChange={setSelectedChannel}
          channelCounts={channelCounts}
          onStatusChange={handleStatusChange}
        />
        <WorkQueueChannelContent
          item={selectedItem}
          channel={selectedChannel}
          selectedThread={selectedThread}
          processingAction={processingAction}
          navigate={navigate}
          onOpenStaffMessage={() => setStaffMessageModal({ isOpen: true, item: selectedItem })}
          onOpenFacultyMessage={() => setFacultyMessageModal({ isOpen: true, item: selectedItem })}
          onOpenNote={() => setNoteModal({ isOpen: true, item: selectedItem })}
          onComplete={() => {
            toast.success('Item completed!');
            fetchClaimedItems();
            navigate(getCompletionReturnPath());
          }}
          messagesRef={messagesRef}
          onThreadClick={setSelectedThread}
        />
        <WorkQueueThreadPanel
          thread={selectedThread}
          onClose={() => setSelectedThread(null)}
          onReplyAdded={handleReplyAdded}
        />
      </div>
      <WorkQueueModals
        staffMessageModal={staffMessageModal}
        setStaffMessageModal={setStaffMessageModal}
        facultyMessageModal={facultyMessageModal}
        setFacultyMessageModal={setFacultyMessageModal}
        noteModal={noteModal}
        setNoteModal={setNoteModal}
        onMessageSent={handleSendMessage}
      />
    </div>
  );
}

export default WorkQueueDetail;
