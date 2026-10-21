import PropTypes from 'prop-types';
import { Alert, Badge, Card, CardBody } from 'reactstrap';
import {
  FaBook,
  FaClipboardCheck,
  FaEnvelope,
  FaStickyNote,
  FaShoppingCart,
  FaUser,
  FaUsers
} from 'react-icons/fa';
import ItemStatusDropdown from '../ItemStatusDropdown';

const itemTypeConfig = {
  submission: { color: 'primary', icon: FaEnvelope, label: 'Submission' },
  purchase_request: { color: 'success', icon: FaShoppingCart, label: 'Purchase Request' },
  resource: { color: 'info', icon: FaBook, label: 'Resource' }
};

function ItemTypeBadge({ item }) {
  const config = itemTypeConfig[item.item_type || 'unknown'] || itemTypeConfig.submission;
  const Icon = config.icon;
  return (
    <Badge color={config.color} className="me-2">
      <Icon className="me-1" />
      {config.label}
    </Badge>
  );
}

function PriorityBadge({ priority }) {
  const colors = { high: 'danger', medium: 'warning', low: 'secondary' };
  return priority ? <Badge color={colors[priority] || 'secondary'}>{priority.toUpperCase()}</Badge> : null;
}

function ChannelItem({ active, onClick, icon: Icon, iconClass, label, count }) {
  return (
    <button
      type="button"
      className={`channel-item ${active ? 'active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <div className="d-flex align-items-center justify-content-between w-100">
        <div className="d-flex align-items-center gap-2">
          <Icon className={iconClass} />
          <span className="channel-name">{label}</span>
        </div>
        {count > 0 && <Badge color="secondary" pill>{count}</Badge>}
      </div>
    </button>
  );
}

function WorkQueueSidebar({ selectedItem, selectedChannel, onChannelChange, channelCounts, onStatusChange }) {
  return (
    <>
      <div className="panel panel-left">
        {selectedItem ? (
          <>
            <div className="panel-header"><h6 className="mb-0">Course Information</h6></div>
            <div className="panel-content">
              <Card>
                <CardBody>
                  <div className="mb-3">
                    <small className="text-muted d-block">Course Code</small>
                    <h5 className="mb-0">{selectedItem.course_code || 'N/A'}</h5>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block">Instructor</small>
                    <strong>{selectedItem.instructor_name || selectedItem.faculty_name || 'No instructor'}</strong>
                  </div>
                  {selectedItem.course_title && (
                    <div className="mb-3">
                      <small className="text-muted d-block">Course Title</small>
                      <div>{selectedItem.course_title}</div>
                    </div>
                  )}
                  <div className="mb-3">
                    <small className="text-muted d-block">Item Type</small>
                    <div><ItemTypeBadge item={selectedItem} /></div>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block">Status</small>
                    <ItemStatusDropdown
                      currentStatus={selectedItem.status}
                      itemId={selectedItem.id}
                      onStatusChange={(status) => onStatusChange(selectedItem.id, status)}
                    />
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block">Priority</small>
                    <PriorityBadge priority={selectedItem.priority} />
                    {!selectedItem.priority && <span className="text-muted">Not set</span>}
                  </div>
                </CardBody>
              </Card>
            </div>
          </>
        ) : (
          <div className="panel-content"><Alert color="info">Select an item to view details</Alert></div>
        )}
      </div>

      <div className="panel panel-center">
        <div className="panel-header"><h6 className="mb-0">Channels</h6></div>
        <div className="panel-content">
          {selectedItem ? (
            <>
              <button
                type="button"
                className={`channel-item ${selectedChannel === 'details' ? 'active' : ''}`}
                aria-pressed={selectedChannel === 'details'}
                onClick={() => onChannelChange('details')}
              >
                <div className="d-flex align-items-center gap-2">
                  <FaBook className="text-primary" />
                  <span className="channel-name">Item Details</span>
                </div>
              </button>
              <button
                type="button"
                className={`channel-item ${selectedChannel === 'checklist' ? 'active' : ''}`}
                aria-pressed={selectedChannel === 'checklist'}
                onClick={() => onChannelChange('checklist')}
              >
                <div className="d-flex align-items-center justify-content-between w-100">
                  <div className="d-flex align-items-center gap-2">
                    <FaClipboardCheck className="text-success" />
                    <span className="channel-name">Checklist</span>
                  </div>
                </div>
              </button>
              <ChannelItem
                active={selectedChannel === 'faculty'}
                onClick={() => onChannelChange('faculty')}
                icon={FaUser}
                iconClass="text-info"
                label="Faculty Communication"
                count={channelCounts.faculty}
              />
              <ChannelItem
                active={selectedChannel === 'staff'}
                onClick={() => onChannelChange('staff')}
                icon={FaUsers}
                iconClass="text-secondary"
                label="Staff Communication"
                count={channelCounts.staff}
              />
              <ChannelItem
                active={selectedChannel === 'notes'}
                onClick={() => onChannelChange('notes')}
                icon={FaStickyNote}
                iconClass="text-warning"
                label="Internal Notes"
                count={channelCounts.notes}
              />
            </>
          ) : (
            <Alert color="info" className="mb-0">Select an item</Alert>
          )}
        </div>
      </div>
    </>
  );
}

ItemTypeBadge.propTypes = { item: PropTypes.object.isRequired };
PriorityBadge.propTypes = { priority: PropTypes.string };
ChannelItem.propTypes = {
  active: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  icon: PropTypes.elementType.isRequired,
  iconClass: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  count: PropTypes.number
};
WorkQueueSidebar.propTypes = {
  selectedItem: PropTypes.object,
  selectedChannel: PropTypes.string.isRequired,
  onChannelChange: PropTypes.func.isRequired,
  channelCounts: PropTypes.object.isRequired,
  onStatusChange: PropTypes.func.isRequired
};

export default WorkQueueSidebar;
