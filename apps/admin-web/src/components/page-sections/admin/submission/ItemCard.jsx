import PropTypes from 'prop-types';
import { Badge, Button } from 'reactstrap';
import { 
  FaClock, 
  FaUser, 
  FaCheckCircle, 
  FaExclamationCircle, 
  FaHandPointRight, 
  FaCog 
} from 'react-icons/fa';
import StatusBadge from './shared/StatusBadge';
import PriorityBadge from './shared/PriorityBadge';
import { getProcessingBlockReason } from '../../../../services/admin/processingHandoff';

const ItemCard = ({ 
  item, 
  displayNumber, 
  onClaim,
  onGoToWork,
  onReopen,
  currentUserId
}) => {
  const processingBlockReason = getProcessingBlockReason(item);

  return (
    <div className="item-card browse-mode">
    <div className="item-info">
      <div className="d-flex align-items-start justify-content-between gap-3 mb-2">
        <div className="d-flex align-items-start gap-3 flex-grow-1">
          <div className="display-number">
            {displayNumber}
          </div>
          <div className="flex-grow-1">
            <div className="item-title">{item.title}</div>
          </div>
        </div>
        
        {/* Claim Status - READ ONLY */}
        <div>
          {!item.claimedBy ? (
            <Badge color="secondary">
              <FaClock className="me-1" />
              Unclaimed
            </Badge>
          ) : item.claimedBy.id === currentUserId ? (
            <Badge color="success">
              <FaUser className="me-1" />
              Claimed by You
            </Badge>
          ) : (
            <Badge color="info">
              <FaUser className="me-1" />
              {item.claimedBy.display_name || item.claimedBy.username}
            </Badge>
          )}
        </div>
      </div>
      
      {item.authors && <div className="item-authors">{item.authors}</div>}
      
      <div className="item-metadata">
        {item.barcode && (
          <span>
            <strong>Barcode:</strong> {item.barcode}
          </span>
        )}
        {item.callNumber && (
          <span>
            <strong>Call Number:</strong> {item.callNumber}
          </span>
        )}
        {item.url && (
          <span>
            <strong>URL:</strong>{' '}
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              Link
            </a>
          </span>
        )}
        <span>
          <strong>Type:</strong> {item.materialType}
        </span>
        {item.isReuse && (
          <Badge color="info" pill>Reuse</Badge>
        )}
      </div>
      
      {item.staffNotes && (
        <div className="mt-2 p-2 bg-light rounded">
          <small>
            <strong>Staff Notes:</strong> {item.staffNotes}
          </small>
        </div>
      )}
      
      {item.facultyNotes && (
        <div className="mt-2">
          <small className="text-muted">
            <strong>Faculty Notes:</strong> {item.facultyNotes}
          </small>
        </div>
      )}
      
      {item.hasCommunications && (
        <div className="mt-2">
          <Badge color="primary" className="me-2">
            {item.communications.length} message{item.communications.length !== 1 ? 's' : ''}
          </Badge>
          {item.unreadCommunications > 0 && (
            <Badge color="warning">
              {item.unreadCommunications} unread
            </Badge>
          )}
          <div className="mt-2">
            {item.communications.map(comm => (
              <div key={comm.id} className="communication-preview mb-2 p-2 border-start border-3">
                <div className="d-flex justify-content-between">
                  <strong>{comm.sender_name}</strong>
                  <small className="text-muted">
                    {new Date(comm.created_at).toLocaleString()}
                  </small>
                </div>
                {comm.subject && (
                  <div className="text-muted small">{comm.subject}</div>
                )}
                <div>{comm.message}</div>
                {!comm.is_read && (
                  <Badge color="warning" size="sm">Unread</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    
    <div className="item-actions browse-mode">
      <StatusBadge status={item.status} />
      <PriorityBadge priority={item.priority} />
      
      {/* Simple action based on status and claim status */}
      <div className="mt-2">
        {item.status === 'complete' ? (
          // Item is complete - show reopen button
          <div className="d-flex flex-column gap-2">
            <Badge color="success" className="w-100 p-2">
              <FaCheckCircle className="me-1" />
              Complete
            </Badge>
            <Button 
              color="warning" 
              size="sm" 
              outline
              onClick={() => onReopen(item.id)}
              className="w-100"
            >
              <FaExclamationCircle className="me-1" />
              Reopen for Processing
            </Button>
          </div>
        ) : !item.claimedBy ? (
          // Unclaimed and not complete - show claim button
          <Button 
            color="primary" 
            size="sm" 
            onClick={() => onClaim(item.id)}
            className="w-100"
          >
            <FaHandPointRight className="me-1" />
            Claim This Item
          </Button>
        ) : item.claimedBy.id === currentUserId ? (
          // Claimed by current user - show work button
          processingBlockReason ? (
            <Badge color="warning" className="w-100 p-2">
              {processingBlockReason}
            </Badge>
          ) : (
            <Button
              color="success"
              size="sm"
              onClick={() => onGoToWork(item)}
              className="w-100"
            >
              <FaCog className="me-1" />
              Work on This
            </Button>
          )
        ) : (
          // Claimed by someone else
          <Badge color="secondary" className="w-100 p-2">
            Being handled by {item.claimedBy.display_name || item.claimedBy.username}
          </Badge>
        )}
      </div>
    </div>
    </div>
  );
};

ItemCard.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    authors: PropTypes.string,
    barcode: PropTypes.string,
    callNumber: PropTypes.string,
    url: PropTypes.string,
    materialType: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    priority: PropTypes.string.isRequired,
    facultyNotes: PropTypes.string,
    staffNotes: PropTypes.string,
    isReuse: PropTypes.bool,
    hasCommunications: PropTypes.bool,
    communications: PropTypes.array,
    unreadCommunications: PropTypes.number,
    displayOrder: PropTypes.number,
    positionInFolder: PropTypes.number,
    claimedBy: PropTypes.shape({
      id: PropTypes.number,
      username: PropTypes.string,
      display_name: PropTypes.string
    })
  }).isRequired,
  displayNumber: PropTypes.string.isRequired,
  onClaim: PropTypes.func.isRequired,
  onGoToWork: PropTypes.func.isRequired,
  onReopen: PropTypes.func.isRequired,
  currentUserId: PropTypes.number.isRequired
};

export default ItemCard;
