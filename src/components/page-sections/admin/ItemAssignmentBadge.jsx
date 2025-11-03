/**
 * @file ItemAssignmentBadge.jsx
 * @description Shows who's assigned to an item with claim/assign actions
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Button,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem
} from 'reactstrap';
import { FaUser, FaUserPlus, FaTimes, FaHandPointRight } from 'react-icons/fa';

/**
 * Badge showing item assignment with claim/assign options
 */
function ItemAssignmentBadge({ 
  item, 
  currentUserId,
  onClaim, 
  onUnclaim, 
  onAssign,
  staffUsers = []
}) {
  const [isProcessing, setIsProcessing] = useState(false);

  const isClaimedByMe = item.claimedBy?.id === currentUserId;
  const isClaimedByOther = item.claimedBy && !isClaimedByMe;
  const isUnclaimed = !item.claimedBy;

  const handleClaim = async () => {
    setIsProcessing(true);
    try {
      await onClaim(item.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnclaim = async () => {
    setIsProcessing(true);
    try {
      await onUnclaim(item.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssign = async (userId) => {
    setIsProcessing(true);
    try {
      await onAssign(item.id, userId);
    } finally {
      setIsProcessing(false);
    }
  };

  // Unclaimed - show claim button
  if (isUnclaimed) {
    return (
      <Button
        color="outline-primary"
        size="sm"
        onClick={handleClaim}
        disabled={isProcessing}
        className="d-flex align-items-center gap-1"
      >
        <FaHandPointRight />
        {isProcessing ? 'Claiming...' : 'Claim'}
      </Button>
    );
  }

  // Claimed by current user - show badge with unclaim option
  if (isClaimedByMe) {
    return (
      <div className="d-flex align-items-center gap-2">
        <Badge color="success" className="d-flex align-items-center gap-1">
          <FaUser />
          You
        </Badge>
        
        <UncontrolledDropdown>
          <DropdownToggle
            color="link"
            size="sm"
            className="p-0 text-decoration-none"
            disabled={isProcessing}
          >
            <small>⋮</small>
          </DropdownToggle>
          <DropdownMenu end>
            <DropdownItem header>Actions</DropdownItem>
            <DropdownItem onClick={handleUnclaim}>
              <FaTimes className="me-2" />
              Release Item
            </DropdownItem>
            <DropdownItem divider />
            <DropdownItem header>Assign to...</DropdownItem>
            {staffUsers
              .filter(user => user.id !== currentUserId)
              .map(user => (
                <DropdownItem 
                  key={user.id}
                  onClick={() => handleAssign(user.id)}
                >
                  <FaUserPlus className="me-2" />
                  {user.display_name || user.username}
                </DropdownItem>
              ))
            }
          </DropdownMenu>
        </UncontrolledDropdown>
      </div>
    );
  }

  // Claimed by someone else - show their name
  if (isClaimedByOther) {
    return (
      <Badge color="info" className="d-flex align-items-center gap-1">
        <FaUser />
        {item.claimedBy.display_name || item.claimedBy.username}
      </Badge>
    );
  }

  return null;
}

ItemAssignmentBadge.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    claimedBy: PropTypes.shape({
      id: PropTypes.number,
      username: PropTypes.string,
      display_name: PropTypes.string
    })
  }).isRequired,
  currentUserId: PropTypes.number.isRequired,
  onClaim: PropTypes.func.isRequired,
  onUnclaim: PropTypes.func.isRequired,
  onAssign: PropTypes.func.isRequired,
  staffUsers: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    username: PropTypes.string.isRequired,
    display_name: PropTypes.string
  }))
};

export default ItemAssignmentBadge;
