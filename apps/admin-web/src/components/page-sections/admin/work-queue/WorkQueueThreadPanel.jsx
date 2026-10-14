import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { FaArrowLeft, FaTimes } from 'react-icons/fa';
import ThreadViewPanel from '../ThreadViewPanel';

function WorkQueueThreadPanel({ thread, onClose, onReplyAdded }) {
  if (!thread) return null;

  return (
    <div className="panel panel-thread">
      <div className="panel-header">
        <div className="d-flex align-items-center justify-content-between w-100">
          <h6 className="mb-0">
            <Button color="link" size="sm" className="p-0 me-2" onClick={onClose}>
              <FaArrowLeft />
            </Button>
            Thread
          </h6>
          <Button color="link" size="sm" className="p-0" onClick={onClose}>
            <FaTimes />
          </Button>
        </div>
      </div>
      <div className="panel-content">
        <ThreadViewPanel thread={thread} onClose={onClose} onReplyAdded={onReplyAdded} />
      </div>
    </div>
  );
}

WorkQueueThreadPanel.propTypes = {
  thread: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onReplyAdded: PropTypes.func.isRequired
};

export default WorkQueueThreadPanel;
