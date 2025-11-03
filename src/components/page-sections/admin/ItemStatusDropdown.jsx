/**
 * @file ItemStatusDropdown.jsx
 * @description Quick status change dropdown for submission items
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem
} from 'reactstrap';
import { FaClock, FaCog, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'secondary',
    icon: FaClock,
    description: 'Not started'
  },
  in_progress: {
    label: 'In Progress',
    color: 'warning',
    icon: FaCog,
    description: 'Currently working'
  },
  complete: {
    label: 'Complete',
    color: 'success',
    icon: FaCheckCircle,
    description: 'Finished'
  },
  unavailable: {
    label: 'Unavailable',
    color: 'danger',
    icon: FaTimesCircle,
    description: 'Cannot fulfill'
  }
};

/**
 * Dropdown component for quick status changes
 */
function ItemStatusDropdown({ currentStatus, onStatusChange, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  const toggle = () => !disabled && !isChanging && setIsOpen(!isOpen);

  const handleStatusChange = async (newStatus) => {
    if (newStatus === currentStatus) {
      setIsOpen(false);
      return;
    }

    setIsChanging(true);
    try {
      await onStatusChange(newStatus);
      setIsOpen(false);
    } catch (error) {
      console.error('Error changing status:', error);
      // Keep dropdown open on error so user can try again
    } finally {
      setIsChanging(false);
    }
  };

  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <Dropdown isOpen={isOpen} toggle={toggle} className="item-status-dropdown">
      <DropdownToggle 
        caret 
        color={config.color}
        size="sm"
        disabled={disabled || isChanging}
        className="d-flex align-items-center gap-2"
      >
        <Icon />
        {isChanging ? 'Updating...' : config.label}
      </DropdownToggle>
      
      <DropdownMenu style={{ position: 'fixed', zIndex: 1050 }}>
        {Object.entries(STATUS_CONFIG).map(([status, statusConfig]) => {
          const StatusIcon = statusConfig.icon;
          const isCurrent = status === currentStatus;
          
          return (
            <DropdownItem
              key={status}
              onClick={() => handleStatusChange(status)}
              active={isCurrent}
              disabled={isCurrent}
            >
              <div className="d-flex align-items-center gap-2">
                <StatusIcon className={`text-${statusConfig.color}`} />
                <div>
                  <div className="fw-bold">{statusConfig.label}</div>
                  <small className="text-muted">{statusConfig.description}</small>
                </div>
              </div>
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </Dropdown>
  );
}

ItemStatusDropdown.propTypes = {
  currentStatus: PropTypes.oneOf(['pending', 'in_progress', 'complete', 'unavailable']).isRequired,
  onStatusChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool
};

export default ItemStatusDropdown;
