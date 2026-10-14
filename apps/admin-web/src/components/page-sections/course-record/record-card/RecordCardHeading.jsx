import PropTypes from 'prop-types';
import { Badge, CardTitle, Popover, PopoverBody } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { formatVisibilityDate } from '../../../../util/resourceVisibility';

const RecordCardHeading = ({
  recordItem,
  title,
  titleStyle,
  isElectronic,
  resource,
  resourceBadgeText,
  isVisible,
  message,
  showVisibilityMessages,
  canBypassVisibility,
  showVisibilityDates,
  visibilityInfo,
  activePopover,
  togglePopover,
}) => (
  <>
    <Badge color={isElectronic ? 'primary' : 'success'} className="resource-badge" pill>
      {resourceBadgeText}
    </Badge>

    {!isVisible && (
      <Badge color="warning" className="ms-2 resource-badge" pill>
        Not Currently Available
      </Badge>
    )}

    <CardTitle tag="h2" style={titleStyle} className="h3 mb-3 mt-4">
      {title}
      {!isVisible && showVisibilityMessages && (
        <div className="small text-warning mt-2">
          <FontAwesomeIcon icon={faClock} className="me-1" />
          {message}
        </div>
      )}
      {canBypassVisibility && isElectronic && resource && showVisibilityDates && (
        <span id={`visibility-${recordItem.id}`} className="ms-2 text-muted">
          <FontAwesomeIcon icon={faInfoCircle} className="cursor-pointer" />
        </span>
      )}
    </CardTitle>

    {canBypassVisibility && isElectronic && resource && showVisibilityDates && (
      <Popover
        placement="auto"
        isOpen={activePopover === `visibility-${recordItem.id}`}
        target={`visibility-${recordItem.id}`}
        trigger="hover"
        toggle={() => togglePopover(`visibility-${recordItem.id}`)}
      >
        <PopoverBody>
          <h6 className="mb-2">Visibility Window</h6>
          <div className="small">
            {visibilityInfo.startDate && (
              <div><strong>From:</strong> {formatVisibilityDate(visibilityInfo.startDate)}</div>
            )}
            {visibilityInfo.endDate && (
              <div><strong>Until:</strong> {formatVisibilityDate(visibilityInfo.endDate, 'end')}</div>
            )}
          </div>
        </PopoverBody>
      </Popover>
    )}
  </>
);

RecordCardHeading.propTypes = {
  recordItem: PropTypes.object.isRequired,
  title: PropTypes.string,
  titleStyle: PropTypes.object.isRequired,
  isElectronic: PropTypes.bool.isRequired,
  resource: PropTypes.object,
  resourceBadgeText: PropTypes.string.isRequired,
  isVisible: PropTypes.bool.isRequired,
  message: PropTypes.string,
  showVisibilityMessages: PropTypes.bool.isRequired,
  canBypassVisibility: PropTypes.bool.isRequired,
  showVisibilityDates: PropTypes.bool,
  visibilityInfo: PropTypes.object.isRequired,
  activePopover: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  togglePopover: PropTypes.func.isRequired,
};

export default RecordCardHeading;
