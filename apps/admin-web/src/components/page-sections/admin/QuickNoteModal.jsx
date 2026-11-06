/**
 * @file QuickNoteModal.jsx
 * @description Modal for adding quick staff-only notes
 */

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Loader2, Save, StickyNote } from 'lucide-react';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { notify } from '../../../services/notify';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';

const QuickNoteModal = ({ isOpen, toggle, item, onNoteSaved }) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setNote('');
  }, [isOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!note.trim()) {
      notify.error('Please enter a note');
      return;
    }

    setSaving(true);
    try {
      const submissionId = item.submission_id;

      if (!submissionId) {
        console.error('Item structure:', item);
        notify.error('Unable to find submission ID');
        return;
      }

      await submissionWorkflowService.createCommunication(submissionId, {
        message: note.trim(),
        category: 'note',
        communication_type: 'internal_note',
        priority: 'normal',
        visibility: 'staff_only',
        resource_id: item.id,
      });

      notify.success('Note saved');
      onNoteSaved?.();
      toggle();
    } catch (error) {
      notify.fromError(error, "Couldn't save the note");
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) toggle(); }}>
      <DialogContent className="tw-w-[calc(100vw-2rem)] tw-max-h-[90vh] tw-overflow-y-auto">
        <DialogHeader className="tw-pr-10 tw-text-left">
          <DialogTitle className="tw-flex tw-items-center tw-gap-2 tw-break-words">
            <StickyNote aria-hidden="true" className="tw-size-5 tw-shrink-0" />
            Quick Note - {item.title}
          </DialogTitle>
          <DialogDescription>
            Add a staff-only note about this reserve request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="tw-space-y-4">
          <div className="tw-space-y-2">
            <Label htmlFor="quick-note-body">
              Note <span className="tw-text-destructive">*</span>
              <span className="tw-ml-2 tw-text-muted-foreground">(Staff only - not visible to faculty)</span>
            </Label>
            <Textarea
              id="quick-note-body"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={6}
              placeholder="Add a quick note about this item..."
              required
            />
          </div>

          <div className="tw-border-t tw-pt-3 tw-text-sm tw-text-muted-foreground tw-break-words">
            <p><strong>Item:</strong> {item.title}</p>
            <p><strong>Course:</strong> {item.submission?.course_code}</p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving} aria-busy={saving}>
              {saving ? <Loader2 aria-hidden="true" className="tw-size-4 tw-animate-spin" /> : <Save aria-hidden="true" />}
              {saving ? 'Saving...' : 'Save Note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

QuickNoteModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  item: PropTypes.object,
  onNoteSaved: PropTypes.func,
};

export default QuickNoteModal;
