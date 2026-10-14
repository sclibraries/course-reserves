import PropTypes from 'prop-types';
import { Alert, Button, Card, CardBody } from 'reactstrap';
import {
  FaComment,
  FaEnvelope,
  FaExternalLinkAlt,
  FaStickyNote
} from 'react-icons/fa';
import ItemChecklistView from '../ItemChecklistView';
import ChannelMessagesPanel from '../ChannelMessagesPanel';

function WorkQueueChannelContent({
  item,
  channel,
  selectedThread,
  processingAction,
  navigate,
  onOpenStaffMessage,
  onOpenFacultyMessage,
  onOpenNote,
  onComplete,
  messagesRef,
  onThreadClick
}) {
  return (
    <div className="panel panel-right">
      <div className="panel-header">
        <div className="d-flex align-items-center justify-content-between w-100 flex-column gap-2">
          <div className="d-flex align-items-center justify-content-between w-100">
            <h6 className="mb-0">
              {channel === 'details' && 'Item Details'}
              {channel === 'checklist' && 'Checklist'}
              {channel === 'faculty' && 'Faculty Communication'}
              {channel === 'staff' && 'Staff Communication'}
              {channel === 'notes' && 'Internal Notes'}
            </h6>
          </div>
          {!selectedThread && item && (
            <div className="d-flex gap-2 w-100 pt-2 border-top">
              <Button
                color="primary"
                size="sm"
                disabled={!processingAction?.handoff}
                onClick={() => navigate(processingAction.handoff.pathname, { state: processingAction.handoff.state })}
                title={processingAction?.blockingReason || undefined}
              >
                <FaExternalLinkAlt className="me-1" />
                Open Processing
              </Button>
              {channel === 'staff' && (
                <Button color="primary" size="sm" onClick={onOpenStaffMessage}>
                  <FaComment className="me-1" />
                  Staff Message
                </Button>
              )}
              {channel === 'faculty' && (
                <Button color="info" size="sm" onClick={onOpenFacultyMessage}>
                  <FaEnvelope className="me-1" />
                  Faculty Message
                </Button>
              )}
              {channel === 'notes' && (
                <Button color="secondary" size="sm" onClick={onOpenNote}>
                  <FaStickyNote className="me-1" />
                  Quick Note
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="panel-content">
        {item ? (
          channel === 'details' ? (
            <Card>
              <CardBody>
                <div className="mb-3">
                  <small className="text-muted d-block">Course Code</small>
                  <strong>{item.course_code || 'N/A'}</strong>
                </div>
                {item.course_title && (
                  <div className="mb-3">
                    <small className="text-muted d-block">Course Title</small>
                    <strong>{item.course_title}</strong>
                  </div>
                )}
                <div className="mb-3">
                  <small className="text-muted d-block">Instructor</small>
                  <strong>{item.instructor_name || item.faculty_name || 'N/A'}</strong>
                </div>
                {item.title && (
                  <div className="mb-3">
                    <small className="text-muted d-block">Item Title</small>
                    <strong>{item.title}</strong>
                  </div>
                )}
                {item.authors && (
                  <div className="mb-3">
                    <small className="text-muted d-block">Author(s)</small>
                    <div>{item.authors}</div>
                  </div>
                )}
                {item.materialTypeName && (
                  <div className="mb-3">
                    <small className="text-muted d-block">Material Type</small>
                    <div>{item.materialTypeName}</div>
                  </div>
                )}
                {item.barcode && (
                  <div className="mb-3">
                    <small className="text-muted d-block">Barcode</small>
                    <div>{item.barcode}</div>
                  </div>
                )}
                {item.callNumber && (
                  <div className="mb-3">
                    <small className="text-muted d-block">Call Number</small>
                    <div>{item.callNumber}</div>
                  </div>
                )}
                {item.url && (
                  <div className="mb-3">
                    <small className="text-muted d-block">URL</small>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a>
                  </div>
                )}
                {item.submission_id && (
                  <div className="mb-3">
                    <small className="text-muted d-block">Submission ID</small>
                    <div>{item.submission_id}</div>
                  </div>
                )}
                {item.resource_id && (
                  <div className="mb-3">
                    <small className="text-muted d-block">Resource ID</small>
                    <div>{item.resource_id}</div>
                  </div>
                )}
                {item.notes && (
                  <div className="mb-3">
                    <small className="text-muted d-block">Notes</small>
                    <p className="mb-0">{item.notes}</p>
                  </div>
                )}
                {processingAction?.blockingReason && (
                  <Alert color="warning" className="mb-0">{processingAction.blockingReason}</Alert>
                )}
              </CardBody>
            </Card>
          ) : channel === 'checklist' ? (
            <ItemChecklistView itemId={parseInt(item.id)} onComplete={onComplete} />
          ) : channel === 'faculty' || channel === 'staff' || channel === 'notes' ? (
            <ChannelMessagesPanel
              ref={messagesRef}
              submissionId={parseInt(item.submission_id)}
              resourceId={parseInt(item.resource_id || item.id)}
              channel={channel}
              onThreadClick={onThreadClick}
            />
          ) : (
            <Alert color="info" className="mb-0">Select a channel</Alert>
          )
        ) : (
          <Alert color="info" className="mb-0">Select an item</Alert>
        )}
      </div>
    </div>
  );
}

WorkQueueChannelContent.propTypes = {
  item: PropTypes.object,
  channel: PropTypes.string.isRequired,
  selectedThread: PropTypes.object,
  processingAction: PropTypes.object,
  navigate: PropTypes.func.isRequired,
  onOpenStaffMessage: PropTypes.func.isRequired,
  onOpenFacultyMessage: PropTypes.func.isRequired,
  onOpenNote: PropTypes.func.isRequired,
  onComplete: PropTypes.func.isRequired,
  messagesRef: PropTypes.object.isRequired,
  onThreadClick: PropTypes.func.isRequired
};

export default WorkQueueChannelContent;
