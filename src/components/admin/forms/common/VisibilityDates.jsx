import PropTypes from 'prop-types';
import { Row, Col, FormGroup, Label, Input } from 'reactstrap';

/**
 * VisibilityDates - Component for setting resource visibility dates
 */
export const VisibilityDates = ({ 
  startDate, 
  endDate, 
  handleChange, 
  materialTypeId,
  useVisibilityDates,
  onVisibilityToggle 
}) => {
  // Check if this is a video material type (ID = 3)
  const isVideoMaterialType = materialTypeId === '3' || materialTypeId === 3;
  
  // Determine if visibility dates should be shown
  const shouldShowDates = useVisibilityDates || isVideoMaterialType;

  return (
    <div>
      {/* Visibility Toggle - only show if not video type (video type is always enabled) */}
      {!isVideoMaterialType && (
        <Row className="mb-3">
          <Col md={12}>
            <FormGroup check>
              <Input
                id="use_visibility_dates"
                name="use_visibility_dates"
                type="checkbox"
                checked={useVisibilityDates}
                onChange={onVisibilityToggle}
              />
              <Label check for="use_visibility_dates">
                Enable visibility date restrictions
              </Label>
              <small className="text-muted d-block">
                Check this box to set specific dates when this resource should be visible to students
              </small>
            </FormGroup>
          </Col>
        </Row>
      )}

      {/* Show automatic message for video types */}
      {isVideoMaterialType && (
        <Row className="mb-3">
          <Col md={12}>
            <div className="alert alert-info mb-3">
              <small>
                <strong>Note:</strong> Visibility dates are automatically enabled for Audio/Video Media resources.
              </small>
            </div>
          </Col>
        </Row>
      )}
      
      {/* Date Fields - only show when visibility is enabled */}
      {shouldShowDates && (
        <Row>
          <Col md={6}>
            <FormGroup>
              <Label for="start_visibility">Visibility Start Date</Label>
              <Input
                id="start_visibility"
                name="start_visibility"
                type="date"
                value={startDate || ''}
                onChange={handleChange}
              />
              <small className="text-muted">
                When the resource becomes visible to students
              </small>
            </FormGroup>
          </Col>
          
          <Col md={6}>
            <FormGroup>
              <Label for="end_visibility">Visibility End Date</Label>
              <Input
                id="end_visibility"
                name="end_visibility"
                type="date"
                value={endDate || ''}
                onChange={handleChange}
              />
              <small className="text-muted">
                When the resource stops being visible to students
              </small>
            </FormGroup>
          </Col>
        </Row>
      )}
    </div>
  );
};

VisibilityDates.propTypes = {
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  handleChange: PropTypes.func.isRequired,
  materialTypeId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]),
  useVisibilityDates: PropTypes.bool,
  onVisibilityToggle: PropTypes.func.isRequired
};

export default VisibilityDates;
