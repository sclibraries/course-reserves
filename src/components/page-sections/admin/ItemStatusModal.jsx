/**
 * @file ItemStatusModal.jsx
 * @description Modal for updating item status and notes during submission workflow processing
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
  Alert
} from 'reactstrap';
import useSubmissionWorkflowStore from '../../../store/submissionWorkflowStore';

/**
 * Modal component for updating individual item status
 */
function ItemStatusModal({ isOpen, toggle, item }) {
  const { updateItem } = useSubmissionWorkflowStore();
  
  const [formData, setFormData] = useState({
    item_status: '',
    staff_notes: '',
    priority: '',
    faculty_notes: ''
  });
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Initialize form data when item changes
  useEffect(() => {
    if (item) {
      setFormData({
        item_status: item.status || 'pending',
        staff_notes: item.staffNotes || '',
        priority: item.priority || 'medium',
        faculty_notes: item.facultyNotes || ''
      });
    }
  }, [item]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      // Only send fields that have changed
      const updates = {};
      
      if (formData.item_status !== item.status) {
        updates.item_status = formData.item_status;
      }
      if (formData.staff_notes !== (item.staffNotes || '')) {
        updates.staff_notes = formData.staff_notes;
      }
      if (formData.priority !== (item.priority || 'medium')) {
        updates.priority = formData.priority;
      }
      if (formData.faculty_notes !== (item.facultyNotes || '')) {
        updates.faculty_notes = formData.faculty_notes;
      }

      // Check if there are any updates
      if (Object.keys(updates).length === 0) {
        setError('No changes detected');
        setSaving(false);
        return;
      }

      const result = await updateItem(item.id, updates);
      
      if (result.success) {
        setSuccess(true);
        // Close modal after a brief delay to show success message
        setTimeout(() => {
          toggle();
        }, 1500);
      } else {
        setError(result.error || 'Failed to update item');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while updating the item');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="lg">
      <ModalHeader toggle={toggle}>
        Update Item Status
      </ModalHeader>
      
      <ModalBody>
        {error && (
          <Alert color="danger" className="mb-3">
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert color="success" className="mb-3">
            Item updated successfully!
          </Alert>
        )}

        {/* Item Information */}
        <div className="mb-4 p-3 bg-light rounded">
          <h6 className="mb-2">{item.title}</h6>
          {item.authors && (
            <p className="text-muted small mb-1">{item.authors}</p>
          )}
          {item.callNumber && (
            <p className="text-muted small mb-0">Call Number: {item.callNumber}</p>
          )}
        </div>

        <Form onSubmit={handleSubmit}>
          {/* Item Status */}
          <FormGroup>
            <Label for="item_status">
              Status <span className="text-danger">*</span>
            </Label>
            <Input
              type="select"
              name="item_status"
              id="item_status"
              value={formData.item_status}
              onChange={handleChange}
              disabled={saving}
              required
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
              <option value="unavailable">Unavailable</option>
            </Input>
            <small className="form-text text-muted">
              Current workflow status of this item
            </small>
          </FormGroup>

          {/* Priority */}
          <FormGroup>
            <Label for="priority">Priority</Label>
            <Input
              type="select"
              name="priority"
              id="priority"
              value={formData.priority}
              onChange={handleChange}
              disabled={saving}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Input>
          </FormGroup>

          {/* Staff Notes */}
          <FormGroup>
            <Label for="staff_notes">Staff Notes (Internal)</Label>
            <Input
              type="textarea"
              name="staff_notes"
              id="staff_notes"
              rows="4"
              value={formData.staff_notes}
              onChange={handleChange}
              placeholder="Internal notes about location, condition, processing status..."
              disabled={saving}
            />
            <small className="form-text text-muted">
              These notes are only visible to staff members
            </small>
          </FormGroup>

          {/* Faculty Notes */}
          <FormGroup>
            <Label for="faculty_notes">Faculty Notes</Label>
            <Input
              type="textarea"
              name="faculty_notes"
              id="faculty_notes"
              rows="3"
              value={formData.faculty_notes}
              onChange={handleChange}
              placeholder="Notes visible to the faculty member..."
              disabled={saving}
            />
            <small className="form-text text-muted">
              These notes will be visible to the faculty member who submitted this request
            </small>
          </FormGroup>
        </Form>
      </ModalBody>
      
      <ModalFooter>
        <Button color="secondary" onClick={toggle} disabled={saving}>
          Cancel
        </Button>
        <Button 
          color="primary" 
          onClick={handleSubmit} 
          disabled={saving || success}
        >
          {saving ? 'Saving...' : success ? 'Saved!' : 'Save Changes'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

ItemStatusModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  item: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string.isRequired,
    authors: PropTypes.string,
    callNumber: PropTypes.string,
    status: PropTypes.string,
    staffNotes: PropTypes.string,
    priority: PropTypes.string,
    facultyNotes: PropTypes.string
  })
};

ItemStatusModal.defaultProps = {
  item: null
};

export default ItemStatusModal;
