import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { notify } from '../../services/notify';
import useSubmissionWorkflowStore from '../../store/submissionWorkflowStore';
import { submissionWorkflowService } from '../../services/admin/submissionWorkflowService';
import { matchesCommunicationChannel } from '../../util/messageChannels';
import {
  buildWorkQueueProcessingAction,
  findSelectedWorkQueueItem
} from '../../util/workQueueDetail';

export default function useWorkQueueDetail() {
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
  const [channelCounts, setChannelCounts] = useState({ faculty: 0, staff: 0, notes: 0 });
  const [staffMessageModal, setStaffMessageModal] = useState({ isOpen: false, item: null });
  const [facultyMessageModal, setFacultyMessageModal] = useState({ isOpen: false, item: null });
  const [noteModal, setNoteModal] = useState({ isOpen: false, item: null });
  const [selectedChannel, setSelectedChannel] = useState('checklist');
  const [selectedThread, setSelectedThread] = useState(null);

  useEffect(() => {
    fetchClaimedItems();
  }, [fetchClaimedItems]);

  const formattedItems = useMemo(() => {
    if (!claimedItems) return [];

    return claimedItems.map(item => {
      let resourceData = {};
      try {
        resourceData = item.resource_data ? JSON.parse(item.resource_data) : {};
      } catch (err) {
        console.warn('Failed to parse resource_data:', err);
      }

      return {
        ...item,
        title: resourceData.title || item.title || 'Untitled',
        authors: resourceData.authors || '',
        course_code: item.course_code || 'N/A',
        course_title: item.course_title || '',
        instructor_name: item.instructor_name || 'N/A',
        materialTypeName: item.materialType?.name || resourceData.materialType || 'Unknown',
        barcode: item.source_barcode || resourceData.barcode,
        callNumber: item.source_call_number || resourceData.callNumber,
        url: resourceData.url
      };
    });
  }, [claimedItems]);

  useEffect(() => {
    if (itemId && formattedItems && formattedItems.length > 0) {
      const item = findSelectedWorkQueueItem(formattedItems, itemId);
      if (item) {
        setSelectedItem(item);
      } else {
        notify.warning('Item not found in your work queue');
        navigate('/admin?tab=my-work');
      }
    } else if (!itemId && formattedItems && formattedItems.length > 0) {
      navigate(`/admin/work-queue/${formattedItems[0].id}`, { replace: true });
    }
  }, [itemId, formattedItems, navigate]);

  const handleStatusChange = async (changedItemId, newStatus) => {
    try {
      const result = await updateItemStatus(changedItemId, newStatus);
      if (!result?.success) {
        notify.fromError(result?.error, "Couldn't update the item status");
        return;
      }
      notify.success('Status updated');
      await fetchClaimedItems();
    } catch (error) {
      notify.fromError(error, "Couldn't update the item status");
    }
  };

  const loadChannelCounts = async (item) => {
    if (!item || !item.submission_id) return;

    try {
      const allMessages = await submissionWorkflowService.getSubmissionCommunications(
        parseInt(item.submission_id)
      );
      const resourceId = parseInt(item.resource_id || item.id);
      const filtered = resourceId
        ? allMessages.filter(comm => comm.resource_id == resourceId)
        : allMessages;
      const counts = {
        faculty: filtered.filter(message => matchesCommunicationChannel(message, 'faculty')).length,
        staff: filtered.filter(message => matchesCommunicationChannel(message, 'staff')).length,
        notes: filtered.filter(message => matchesCommunicationChannel(message, 'notes')).length
      };
      setChannelCounts(counts);
    } catch (err) {
      console.error('Error loading channel counts:', err);
      setChannelCounts({ faculty: 0, staff: 0, notes: 0 });
    }
  };

  useEffect(() => {
    if (selectedItem) loadChannelCounts(selectedItem);
  }, [selectedItem]);

  const handleSendMessage = () => {
    setStaffMessageModal({ isOpen: false, item: null });
    setFacultyMessageModal({ isOpen: false, item: null });
    setNoteModal({ isOpen: false, item: null });
    if (messagesRef.current?.refresh) messagesRef.current.refresh();
    fetchClaimedItems();
    if (selectedItem) loadChannelCounts(selectedItem);
  };

  const handleReplyAdded = (newReply) => {
    if (selectedThread && newReply) {
      setSelectedThread({
        ...selectedThread,
        replies: [...(selectedThread.replies || []), newReply]
      });
    }
    if (messagesRef.current) messagesRef.current.refresh();
  };

  const processingAction = selectedItem ? buildWorkQueueProcessingAction(selectedItem) : null;

  return {
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
    handleSendMessage,
    handleReplyAdded,
    staffMessageModal,
    setStaffMessageModal,
    facultyMessageModal,
    setFacultyMessageModal,
    noteModal,
    setNoteModal
  };
}
