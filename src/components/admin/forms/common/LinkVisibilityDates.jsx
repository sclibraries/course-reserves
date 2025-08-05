import PropTypes from 'prop-types';
import { Row, Col, FormGroup, Label, Input } from 'reactstrap';

/**
 * LinkVisibilityDates - Component for setting individual link visibility dates
 * This component handles visibility dates for a single link within a resource
 */
export const LinkVisibilityDates = ({ 
  startDate, 
  endDate, 
  handleChange, 
  materialTypeId,
  useVisibilityDates,
  onVisibilityToggle,
  linkIndex,
  isLinkVisibilityEnabled 
}) => {
  // Check if this is a video material type (ID = 3)
  const isVideoMaterialType = materialTypeId === '3' || materialTypeId === 3;
  
  // Determine if visibility dates should be shown
  const shouldShowDates = useVisibilityDates || isVideoMaterialType;

  // Create unique field names for this link
  const startFieldName = `link_${linkIndex}_start_visibility`;
  const endFieldName = `link_${linkIndex}_end_visibility`;
  const toggleFieldName = `link_${linkIndex}_use_visibility_dates`;

  return (
    <div className="link-visibility-dates mt-3">
      {/* Link Visibility Toggle - only show if not video type and not globally enabled */}
      {!isVideoMaterialType && !shouldShowDates && (
        <Row className="mb-3">
          <Col md={12}>
            <FormGroup check>
              <Input
                id={toggleFieldName}
                name={toggleFieldName}
                type="checkbox"
                checked={isLinkVisibilityEnabled}
                onChange={(e) => onVisibilityToggle(linkIndex, e.target.checked)}
              />
              <Label check for={toggleFieldName}>
                <small>Enable visibility date restrictions for this link</small>
              </Label>
              <small className="text-muted d-block">
                Set specific dates when this individual link should be visible
              </small>
            </FormGroup>
          </Col>
        </Row>
      )}

      {/* Show automatic message for video types or when resource-level visibility is enabled */}
      {(isVideoMaterialType || shouldShowDates) && (
        <Row className="mb-3">
          <Col md={12}>
            <div className="alert alert-info mb-3 py-2">
              <small>
                <strong>Note:</strong> {isVideoMaterialType 
                  ? "Visibility dates are automatically enabled for Audio/Video Media links."
                  : "Resource-level visibility is enabled. You can override with link-specific dates."}
              </small>
            </div>
          </Col>
        </Row>
      )}
      
      {/* Date Fields - show when link visibility is enabled OR resource-level visibility is enabled */}
      {(shouldShowDates || isLinkVisibilityEnabled) && (
        <Row>
          <Col md={6}>
            <FormGroup>
              <Label for={startFieldName}>
                <small>Link Visibility Start Date</small>
              </Label>
              <Input
                id={startFieldName}
                name={startFieldName}
                type="date"
                value={startDate || ''}
                onChange={(e) => handleChange(linkIndex, 'start_visibility', e.target.value)}
                size="sm"
              />
              <small className="text-muted">
                When this link becomes visible
              </small>
            </FormGroup>
          </Col>
          
          <Col md={6}>
            <FormGroup>
              <Label for={endFieldName}>
                <small>Link Visibility End Date</small>
              </Label>
              <Input
                id={endFieldName}
                name={endFieldName}
                type="date"
                value={endDate || ''}
                onChange={(e) => handleChange(linkIndex, 'end_visibility', e.target.value)}
                size="sm"
              />
              <small className="text-muted">
                When this link stops being visible
              </small>
            </FormGroup>
          </Col>
        </Row>
      )}
    </div>
  );
};

LinkVisibilityDates.propTypes = {
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  handleChange: PropTypes.func.isRequired,
  materialTypeId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]),
  useVisibilityDates: PropTypes.bool,
  onVisibilityToggle: PropTypes.func.isRequired,
  linkIndex: PropTypes.number.isRequired,
  isLinkVisibilityEnabled: PropTypes.bool
};

export default LinkVisibilityDates;
