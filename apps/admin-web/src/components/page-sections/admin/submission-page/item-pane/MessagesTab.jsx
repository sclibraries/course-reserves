import { useState } from 'react';
import PropTypes from 'prop-types';
import { Mail, MessageSquareText, StickyNote } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import FacultyMessageModal from '../../FacultyMessageModal';
import QuickNoteModal from '../../QuickNoteModal';
import ReplyModal from '../../ReplyModal';
import StaffMessagingModal from '../../StaffMessagingModal';

function formatMessageDate(value) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString();
}

function MessagesTab({ item, submission, onChanged }) {
  const [dialog, setDialog] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const messageItem = {
    ...item,
    submission: item.submission || {
      course_code: submission?.courseCode,
      course_title: submission?.courseTitle,
      faculty_display_name: submission?.facultyName,
    },
  };
  const messages = (item.communications || []).filter((message) => !message.parent_message_id);
  const closeDialog = () => {
    setDialog('');
    setReplyTo(null);
  };

  return (
    <section aria-label={`Messages for ${item.title}`} className="tw-min-w-0 tw-space-y-4">
      <div className="tw-flex tw-flex-wrap tw-gap-2">
        <Button variant="outline" size="sm" onClick={() => setDialog('staff')}>
          <MessageSquareText aria-hidden="true" /> New Staff Message
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDialog('faculty')}>
          <Mail aria-hidden="true" /> Message Faculty
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDialog('note')}>
          <StickyNote aria-hidden="true" /> Quick Note
        </Button>
      </div>
      {!messages.length && <p className="tw-text-sm tw-text-muted-foreground">No messages or notes yet.</p>}
      <ol className="tw-min-w-0 tw-space-y-3">
        {messages.map((message) => (
          <li className="tw-min-w-0 tw-rounded-md tw-border tw-p-3" key={message.id}>
            <div className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-start tw-justify-between tw-gap-2">
              <div className="tw-min-w-0">
                <p className="tw-break-words tw-font-medium">{message.sender_name || 'Staff member'}</p>
                {message.subject && <p className="tw-mt-1 tw-break-words tw-text-sm tw-font-medium">{message.subject}</p>}
              </div>
              <time className="tw-text-xs tw-text-muted-foreground" dateTime={message.created_at || undefined}>
                {formatMessageDate(message.created_at)}
              </time>
            </div>
            <p className="tw-mt-2 tw-break-words tw-whitespace-pre-wrap tw-text-sm">{message.message}</p>
            <div className="tw-mt-2 tw-flex tw-flex-wrap tw-items-center tw-gap-2">
              {message.is_read === false && <Badge variant="secondary">Unread</Badge>}
              {message.visibility && <Badge variant="outline">{message.visibility.replace(/_/g, ' ')}</Badge>}
              {(message.replies || []).length > 0 && (
                <span className="tw-text-xs tw-text-muted-foreground">{message.replies.length} {message.replies.length === 1 ? 'reply' : 'replies'}</span>
              )}
              <Button
                variant="link"
                size="sm"
                className="tw-ml-auto tw-h-8 tw-px-1"
                aria-label={`Reply to ${message.subject || message.sender_name || 'message'}`}
                onClick={() => { setReplyTo(message); setDialog('reply'); }}
              >
                Reply
              </Button>
            </div>
            {(message.replies || []).map((reply) => (
              <div className="tw-mt-3 tw-break-words tw-border-l-2 tw-pl-3 tw-text-sm" key={reply.id}>
                <p className="tw-font-medium">{reply.sender_name || 'Staff member'}</p>
                <p className="tw-whitespace-pre-wrap">{reply.message}</p>
              </div>
            ))}
          </li>
        ))}
      </ol>

      <StaffMessagingModal isOpen={dialog === 'staff'} toggle={closeDialog} item={messageItem} onMessageSent={onChanged} />
      <FacultyMessageModal isOpen={dialog === 'faculty'} toggle={closeDialog} item={messageItem} onMessageSent={onChanged} />
      <QuickNoteModal isOpen={dialog === 'note'} toggle={closeDialog} item={messageItem} onNoteSaved={onChanged} />
      <ReplyModal
        isOpen={dialog === 'reply'}
        toggle={closeDialog}
        parentMessage={replyTo}
        submissionId={item.submission_id}
        onReplySent={onChanged}
      />
    </section>
  );
}

MessagesTab.propTypes = {
  item: PropTypes.object.isRequired,
  submission: PropTypes.object,
  onChanged: PropTypes.func.isRequired,
};

export default MessagesTab;
