import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  Card,
  Badge,
  Button,
  Spinner,
  Alert,
  Table
} from 'reactstrap';
import {
  FaUser
} from 'react-icons/fa';
import useSubmissionWorkflowStore from '../../../store/submissionWorkflowStore';
import './MyWorkQueue.css';

/**
 * MyWorkQueue - Streamlined task-focused interface
 * Compact table view with expandable details for each item
 */
const MyWorkQueue = () => {
  const navigate = useNavigate();
  
  const {
    claimedItems,
    loading,
    error,
    fetchClaimedItems,
    clearError
  } = useSubmissionWorkflowStore();

  // Fetch items claimed by current user
  useEffect(() => {
    fetchClaimedItems();
  }, [fetchClaimedItems]);

  // Parse resource_data JSON for each item
  const formatItems = () => {
    if (!claimedItems) return [];
    
    console.log('MyWorkQueue - formatItems called with claimedItems:', claimedItems);
    
    return claimedItems.map(item => {
      let resourceData = {};
      try {
        resourceData = item.resource_data ? JSON.parse(item.resource_data) : {};
      } catch (e) {
        console.warn('Failed to parse resource_data:', e);
      }
      
      const formatted = {
        ...item,
        title: resourceData.title || 'Untitled',
        authors: resourceData.authors || '',
        materialTypeName: item.materialType?.name || resourceData.materialType || 'Unknown',
        barcode: item.source_barcode || resourceData.barcode,
        callNumber: item.source_call_number || resourceData.callNumber,
        url: resourceData.url
      };
      
      console.log('MyWorkQueue - Formatted item:', {
        id: formatted.id,
        submission_id: formatted.submission_id,
        resource_id: formatted.resource_id
      });
      
      return formatted;
    });
  };

  const formattedItems = formatItems();

  // Loading state
  if (loading && !claimedItems) {
    return (
      <div className="loading-container">
        <Spinner color="primary" size="lg" />
        <p>Loading your work queue...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert color="danger" toggle={clearError}>
        <h4>Error Loading Work Queue</h4>
        <p>{error}</p>
      </Alert>
    );
  }

  // Empty state
  if (!formattedItems || formattedItems.length === 0) {
    return (
      <div className="empty-state">
        <FaUser size={48} className="mb-3 text-muted" />
        <h3>No Items in Your Work Queue</h3>
        <p>You haven&apos;t claimed any items yet.</p>
        <Button color="primary" onClick={() => navigate('/admin?tab=submissions')}>
          Browse Submissions Queue
        </Button>
      </div>
    );
  }

  return (
    <div className="my-work-queue-streamlined">
      {/* Header */}
      <div className="queue-header">
        <div>
          <h2>
            <FaUser className="me-2" />
            My Work Queue
          </h2>
          <p className="text-muted mb-0">
            {formattedItems.length} {formattedItems.length === 1 ? 'item' : 'items'} in progress
          </p>
        </div>
        <div className="header-actions">
          <Button color="secondary" outline size="sm" onClick={() => fetchClaimedItems()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Compact Table View */}
      <Card style={{ overflow: 'visible' }}>
        <Table hover className="work-queue-table mb-0">
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ width: '150px' }}>Course</th>
              <th style={{ width: '120px' }}>Type</th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody style={{ overflow: 'visible' }}>
            {formattedItems.map((item) => (
              <WorkQueueRow
                key={item.id}
                item={item}
              />
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
};

/**
 * WorkQueueRow - Simple row for each item
 */
const WorkQueueRow = ({ item }) => {
  const navigate = useNavigate();
  
  return (
    <tr id={`item-row-${item.id}`} className="work-queue-row">
      {/* Item Title */}
      <td className="item-title-cell">
        <div className="item-title">{item.title}</div>
        {item.authors && (
          <div className="item-authors text-muted small">{item.authors}</div>
        )}
      </td>

      {/* Course */}
      <td>
        <div className="course-info">
          <div className="course-code">{item.submission?.course_code}</div>
          <div className="faculty-name text-muted small">
            {item.submission?.faculty_display_name}
          </div>
        </div>
      </td>

      {/* Material Type */}
      <td>
        <Badge color="secondary">{item.materialTypeName}</Badge>
      </td>

      {/* Actions */}
      <td>
        <Button
          color="primary"
          size="sm"
          onClick={() => navigate(`/admin/work-queue/${item.id}`)}
        >
          Process
        </Button>
      </td>
    </tr>
  );
};

WorkQueueRow.propTypes = {
  item: PropTypes.object.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onStatusChange: PropTypes.func.isRequired,
  onRelease: PropTypes.func.isRequired,
  onComplete: PropTypes.func.isRequired,
  onStaffMessage: PropTypes.func.isRequired,
  onFacultyMessage: PropTypes.func.isRequired,
  onAddNote: PropTypes.func.isRequired,
  refreshTrigger: PropTypes.number
};

export default MyWorkQueue;
