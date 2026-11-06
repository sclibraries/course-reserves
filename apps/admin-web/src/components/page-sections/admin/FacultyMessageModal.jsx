/**
 * @file FacultyMessageModal.jsx
 * @description Modal for sending messages to faculty (always faculty_visible)
 */

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Loader2, Mail, Send } from 'lucide-react';
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
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { notify } from '../../../services/notify';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';

const FacultyMessageModal = ({ isOpen, toggle, item, onMessageSent }) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSubject('');
      setMessage('');
    }
  }, [isOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!message.trim()) {
      notify.error('Please enter a message');
      return;
    }

    if (!subject.trim()) {
      notify.error('Please enter a subject');
      return;
    }

    setSending(true);
    try {
      const submissionId = item.submission_id;

      if (!submissionId) {
        console.error('Item structure:', item);
        notify.error('Unable to find submission ID');
        return;
      }

      await submissionWorkflowService.createCommunication(submissionId, {
        message: message.trim(),
        subject: subject.trim(),
        category: 'update',
        priority: 'normal',
        visibility: 'faculty_visible',
        resource_id: item.id,
      });

      notify.success('Message sent to faculty');
      onMessageSent?.();
      toggle();
    } catch (error) {
      notify.fromError(error, "Couldn't send the message");
    } finally {
      setSending(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) toggle(); }}>
      <DialogContent className="tw-w-[calc(100vw-2rem)] tw-max-h-[90vh] tw-overflow-y-auto">
        <DialogHeader className="tw-pr-10 tw-text-left">
          <DialogTitle className="tw-flex tw-items-center tw-gap-2 tw-break-words">
            <Mail aria-hidden="true" className="tw-size-5 tw-shrink-0" />
            Message Faculty - {item.title}
          </DialogTitle>
          <DialogDescription>
            Send a faculty-visible update about this reserve request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="tw-space-y-4">
          <div className="tw-rounded-md tw-border tw-border-border tw-bg-muted tw-p-3 tw-text-sm">
            <strong>Note:</strong> This message will be visible to the faculty member who submitted this course reserve request.
          </div>

          <div className="tw-border-b tw-pb-3 tw-text-sm tw-text-muted-foreground">
            <p><strong>To:</strong> {item.submission?.faculty_display_name} ({item.submission?.faculty_email})</p>
            <p className="tw-break-words"><strong>Course:</strong> {item.submission?.course_code} - {item.submission?.course_title}</p>
          </div>

          <div className="tw-space-y-2">
            <Label htmlFor="faculty-message-subject">
              Subject <span className="tw-text-destructive">*</span>
            </Label>
            <Input
              id="faculty-message-subject"
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Enter subject line"
              required
            />
          </div>

          <div className="tw-space-y-2">
            <Label htmlFor="faculty-message-body">
              Message <span className="tw-text-destructive">*</span>
            </Label>
            <Textarea
              id="faculty-message-body"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={8}
              placeholder="Type your message to the faculty member..."
              required
            />
          </div>

          <div className="tw-border-t tw-pt-3 tw-text-sm tw-text-muted-foreground tw-break-words">
            <strong>Item:</strong> {item.title}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={sending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={sending} aria-busy={sending}>
              {sending ? <Loader2 aria-hidden="true" className="tw-size-4 tw-animate-spin" /> : <Send aria-hidden="true" />}
              {sending ? 'Sending...' : 'Send to Faculty'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

FacultyMessageModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  item: PropTypes.object,
  onMessageSent: PropTypes.func,
};

export default FacultyMessageModal;
