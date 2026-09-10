import PropTypes from 'prop-types';
import { Card, CardBody, Button, Alert } from 'reactstrap';
import { FaLock, FaUnlock } from 'react-icons/fa';
import StatusBadge from './shared/StatusBadge';

const SubmissionHeader = ({ submission, onLock, onUnlock }) => {
  return (
    <Card className="submission-header mb-4">
      <CardBody>
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h1 className="h3 mb-2">
              {submission.courseCode}
              {submission.section && ` - ${submission.section}`}: {submission.courseTitle}
            </h1>
            <div className="submission-meta">
              <span>
                <strong>Faculty:</strong> {submission.facultyName}
              </span>
              <span>
                <strong>Term:</strong> {submission.term}
              </span>
              <span>
                <strong>Submitted:</strong>{' '}
                {new Date(submission.submittedAt).toLocaleDateString()}
              </span>
              <span>
                <strong>Status:</strong> <StatusBadge status={submission.status} />
              </span>
            </div>
          </div>
        </div>

        {/* Lock Status */}
        {submission.isLocked && (
          <Alert color="warning" className="mb-3">
            <FaLock className="me-2" />
            This submission is currently locked
            {submission.lockedBy && ` by ${submission.lockedBy}`}
            {submission.lockedAt && 
              ` on ${new Date(submission.lockedAt).toLocaleString()}`}
            {submission.lockReason && (
              <div className="mt-1">
                <small>Reason: {submission.lockReason}</small>
              </div>
            )}
          </Alert>
        )}

        {/* Actions */}
        <div className="submission-actions">
          {!submission.isLocked ? (
            <Button color="warning" onClick={onLock}>
              <FaLock className="me-2" />
              Lock & Process
            </Button>
          ) : (
            <Button color="success" onClick={onUnlock}>
              <FaUnlock className="me-2" />
              Unlock
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

SubmissionHeader.propTypes = {
  submission: PropTypes.object.isRequired,
  onLock: PropTypes.func.isRequired,
  onUnlock: PropTypes.func.isRequired
};

export default SubmissionHeader;