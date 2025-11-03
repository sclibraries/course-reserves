/**
 * @file QuickNoteModal.jsx
 * @description Modal for adding quick staff-only notes
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
  Spinner
} from 'reactstrap';
import { FaStickyNote, FaSave, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';

const QuickNoteModal = ({ isOpen, toggle, item, onNoteSaved }) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setNote('');
    }
  }, [isOpen]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!note.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setSaving(true);
    try {
      // Get numeric submission_id from item - API requires numeric ID, not UUID
      const submissionId = item.submission_id || item.submission?.submission_id || item.submission?.id;
      
      if (!submissionId) {
        console.error('Item structure:', item);
        toast.error('Unable to find submission ID');
        setSaving(false);
        return;
      }

    const data = {
      message: note.trim(),
      category: 'note',
      communication_type: 'internal_note',
      priority: 'normal',
      visibility: 'staff_only',
      resource_id: item.id,
    };      await submissionWorkflowService.createCommunication(submissionId, data);
      
      toast.success('Note saved');
      
      if (onNoteSaved) {
        onNoteSaved();
      }
      
      toggle();
    } catch (error) {
      toast.error(error.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="md">
      <ModalHeader toggle={toggle}>
        <FaStickyNote className="me-2 text-warning" />
        Quick Note - {item.title}
      </ModalHeader>
      
      <Form onSubmit={handleSubmit}>
        <ModalBody>
          {/* Note */}
          <FormGroup>
            <Label for="note">
              Note <span className="text-danger">*</span>
              <small className="text-muted ms-2">(Staff only - not visible to faculty)</small>
            </Label>
            <Input
              id="note"
              type="textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={6}
              placeholder="Add a quick note about this item..."
              required
              autoFocus
            />
          </FormGroup>

          {/* Item Context */}
          <div className="border-top pt-3">
            <small className="text-muted">
              <strong>Item:</strong> {item.title}<br />
              <strong>Course:</strong> {item.submission?.course_code}
            </small>
          </div>
        </ModalBody>
        
        <ModalFooter>
          <Button color="secondary" onClick={toggle} disabled={saving}>
            <FaTimes className="me-1" />
            Cancel
          </Button>
          <Button color="success" type="submit" disabled={saving}>
            {saving ? (
              <>
                <Spinner size="sm" className="me-1" />
                Saving...
              </>
            ) : (
              <>
                <FaSave className="me-1" />
                Save Note
              </>
            )}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
};

QuickNoteModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  item: PropTypes.object,
  onNoteSaved: PropTypes.func
};

export default QuickNoteModal;
