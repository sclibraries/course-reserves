import PropTypes from 'prop-types';
import { Row, Col, FormGroup, Label, Input, Card, CardBody, Alert } from 'reactstrap';
import { FaEye, FaEyeSlash, FaClock, FaLink, FaInfoCircle } from 'react-icons/fa';
import VisibilitySummary from './VisibilitySummary';
import '../../../../css/UnifiedVisibilityControl.css';

/**
 * UnifiedVisibilityControl - Centralized visibility management component
 * 
 * This component provides a unified interface for managing all visibility settings:
 * - Resource-level visibility dates
 * - Primary link visibility dates  
 * - Additional link visibility dates
 * - Cascading visibility settings
 * 
 * Features:
 * - Clear visual hierarchy of visibility controls
 * - Cascading settings from resource to links
 * - Smart defaults based on material type
 * - Intuitive UI with clear explanations
 */
export const UnifiedVisibilityControl = ({ 
  // Resource-level visibility
  resourceStartDate, 
  resourceEndDate,
  useResourceVisibility,
  onResourceVisibilityToggle,
  onResourceDateChange,
  
  // Primary link visibility
  primaryLinkStartDate,
  primaryLinkEndDate,
  usePrimaryLinkVisibility,
  onPrimaryLinkVisibilityToggle,
  onPrimaryLinkDateChange,
  hasPrimaryLink,
  primaryUrl,
  
  // Additional links visibility
  links,
  onLinkVisibilityChange,
  onLinkDateChange,
  
  // General settings
  materialTypeId,
  cascadeVisibilityToLinks,
  onCascadeToggle
}) => {
  // Check if this is a video material type (ID = 3)
  const isVideoMaterialType = materialTypeId === '3' || materialTypeId === 3;
  
  // Check if this is a Hitchcock video URL that requires automatic visibility
  const isHitchcockVideo = primaryUrl && primaryUrl.startsWith('https://ereserves.smith.edu/hitchcock/videos/');
  
  // Determine if resource visibility should be shown (only when manually enabled)
  const shouldShowResourceVisibility = useResourceVisibility;
  
  // Handle cascade toggle
  const handleCascadeToggle = (enabled) => {
    onCascadeToggle(enabled);
    
    if (enabled && shouldShowResourceVisibility) {
      // Apply resource dates to primary link
      if (hasPrimaryLink && !usePrimaryLinkVisibility) {
        onPrimaryLinkVisibilityToggle(true);
        onPrimaryLinkDateChange('primary_link_start_visibility', resourceStartDate);
        onPrimaryLinkDateChange('primary_link_end_visibility', resourceEndDate);
      }
      
      // Apply resource dates to all additional links
      links.forEach((link, index) => {
        if (!link.use_link_visibility) {
          onLinkVisibilityChange(index, 'use_link_visibility', true);
          onLinkDateChange(index, 'start_visibility', resourceStartDate);
          onLinkDateChange(index, 'end_visibility', resourceEndDate);
        }
      });
    }
  };

  return (
    <Card className="visibility-control-card">
      <CardBody>
        <div className="d-flex align-items-center mb-4">
          <FaEye className="text-primary me-2" size={20} />
          <h5 className="mb-0">Visibility Settings</h5>
        </div>
        
        {/* Visibility Summary */}
        <VisibilitySummary
          resourceStartDate={resourceStartDate}
          resourceEndDate={resourceEndDate}
          useResourceVisibility={shouldShowResourceVisibility}
          usePrimaryLinkVisibility={usePrimaryLinkVisibility}
          primaryLinkStartDate={primaryLinkStartDate}
          primaryLinkEndDate={primaryLinkEndDate}
          hasPrimaryLink={hasPrimaryLink}
          links={links}
          materialTypeId={materialTypeId}
          cascadeVisibilityToLinks={cascadeVisibilityToLinks}
        />
        
        {/* Video type notification */}
        {isVideoMaterialType && !isHitchcockVideo && (
          <Alert color="info" className="mb-4">
            <FaInfoCircle className="me-2" />
            <strong>Audio/Video Media:</strong> This material type often benefits from visibility controls for time-limited access. 
            Consider enabling visibility restrictions if this content should only be available during specific dates.
          </Alert>
        )}

        {/* Resource-Level Visibility */}
        <div className="mb-4">
          <div className="d-flex align-items-center mb-3">
            <FaClock className="text-secondary me-2" />
            <h6 className="mb-0">Resource Visibility</h6>
          </div>
          
          {/* Resource visibility toggle - show for all types */}
          <FormGroup check className="mb-3">
            <Input
              id="use_resource_visibility"
              type="checkbox"
              checked={useResourceVisibility}
              onChange={(e) => onResourceVisibilityToggle(e.target.checked)}
            />
            <Label check for="use_resource_visibility">
              Enable visibility date restrictions for this resource
            </Label>
            <small className="text-muted d-block">
              Controls when the entire resource record is visible to students
            </small>
          </FormGroup>
          
          {/* Resource visibility dates */}
          {shouldShowResourceVisibility && (
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label for="resource_start_visibility">Resource Start Date</Label>
                  <Input
                    id="resource_start_visibility"
                    name="start_visibility"
                    type="date"
                    value={resourceStartDate || ''}
                    onChange={onResourceDateChange}
                  />
                  <small className="text-muted">
                    When the resource becomes visible
                  </small>
                </FormGroup>
              </Col>
              
              <Col md={6}>
                <FormGroup>
                  <Label for="resource_end_visibility">Resource End Date</Label>
                  <Input
                    id="resource_end_visibility"
                    name="end_visibility"
                    type="date"
                    value={resourceEndDate || ''}
                    onChange={onResourceDateChange}
                  />
                  <small className="text-muted">
                    When the resource stops being visible
                  </small>
                </FormGroup>
              </Col>
            </Row>
          )}
        </div>

        {/* Cascade Settings */}
        {shouldShowResourceVisibility && (hasPrimaryLink || links.length > 0) && (
          <div className="mb-4 p-3 bg-light rounded">
            <FormGroup check className="mb-2">
              <Input
                id="cascade_visibility"
                type="checkbox"
                checked={cascadeVisibilityToLinks}
                onChange={(e) => handleCascadeToggle(e.target.checked)}
              />
              <Label check for="cascade_visibility">
                <strong>Apply resource visibility dates to all links</strong>
              </Label>
              <small className="text-muted d-block">
                When enabled, all links will use the same visibility dates as the resource. 
                You can still override individual links if needed.
              </small>
            </FormGroup>
          </div>
        )}

        {/* Primary Link Visibility */}
        {hasPrimaryLink && (
          <div className="mb-4 border-top pt-4">
            <div className="d-flex align-items-center mb-3">
              <FaLink className="text-secondary me-2" />
              <h6 className="mb-0">Primary Link Visibility</h6>
            </div>
            
            {/* Primary link visibility toggle */}
            <FormGroup check className="mb-3">
              <Input
                id="use_primary_link_visibility"
                type="checkbox"
                checked={usePrimaryLinkVisibility}
                onChange={(e) => onPrimaryLinkVisibilityToggle(e.target.checked)}
                disabled={cascadeVisibilityToLinks && shouldShowResourceVisibility}
              />
              <Label check for="use_primary_link_visibility">
                Set separate visibility dates for primary link
              </Label>
              <small className="text-muted d-block">
                {cascadeVisibilityToLinks && shouldShowResourceVisibility
                  ? "Disabled because cascade is enabled - using resource dates"
                  : "Override resource visibility dates for the primary link only"
                }
              </small>
            </FormGroup>
            
            {/* Primary link visibility dates */}
            {usePrimaryLinkVisibility && !(cascadeVisibilityToLinks && shouldShowResourceVisibility) && (
              <Row>
                <Col md={6}>
                  <FormGroup>
                    <Label for="primary_link_start_visibility">
                      Primary Link Start Date
                    </Label>
                    <Input
                      id="primary_link_start_visibility"
                      name="primary_link_start_visibility"
                      type="date"
                      value={primaryLinkStartDate || ''}
                      onChange={onPrimaryLinkDateChange}
                    />
                    <small className="text-muted">
                      When the primary link becomes visible
                    </small>
                  </FormGroup>
                </Col>
                
                <Col md={6}>
                  <FormGroup>
                    <Label for="primary_link_end_visibility">
                      Primary Link End Date
                    </Label>
                    <Input
                      id="primary_link_end_visibility"
                      name="primary_link_end_visibility"
                      type="date"
                      value={primaryLinkEndDate || ''}
                      onChange={onPrimaryLinkDateChange}
                    />
                    <small className="text-muted">
                      When the primary link stops being visible
                    </small>
                  </FormGroup>
                </Col>
              </Row>
            )}
            
            {/* Show inherited dates when cascading */}
            {cascadeVisibilityToLinks && shouldShowResourceVisibility && (
              <Alert color="light" className="mb-0">
                <small>
                  <strong>Using resource dates:</strong> {resourceStartDate || 'No start date'} to {resourceEndDate || 'No end date'}
                </small>
              </Alert>
            )}
          </div>
        )}

        {/* Additional Links Visibility */}
        {links.length > 0 && (
          <div className="border-top pt-4">
            <div className="d-flex align-items-center mb-3">
              <FaLink className="text-secondary me-2" />
              <h6 className="mb-0">Additional Links Visibility</h6>
              <small className="text-muted ms-2">({links.length} {links.length === 1 ? 'link' : 'links'})</small>
            </div>
            
            {cascadeVisibilityToLinks && shouldShowResourceVisibility ? (
              <Alert color="light">
                <small>
                  <strong>All additional links are using resource visibility dates:</strong><br />
                  {resourceStartDate || 'No start date'} to {resourceEndDate || 'No end date'}
                  <br />
                  <em>Disable cascade above to set individual link dates</em>
                </small>
              </Alert>
            ) : (
              <div className="additional-links-visibility">
                {links.map((link, index) => (
                  <Card key={index} className="mb-3 bg-light">
                    <CardBody className="py-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Link #{index + 1}</strong>
                        <small className="text-muted">
                          {link.title || link.url?.substring(0, 30) + (link.url?.length > 30 ? '...' : '') || 'Untitled link'}
                        </small>
                      </div>
                      
                      <FormGroup check className="mb-2">
                        <Input
                          id={`link_visibility_${index}`}
                          type="checkbox"
                          checked={link.use_link_visibility || false}
                          onChange={(e) => onLinkVisibilityChange(index, 'use_link_visibility', e.target.checked)}
                        />
                        <Label check for={`link_visibility_${index}`}>
                          <small>Set separate visibility dates for this link</small>
                        </Label>
                      </FormGroup>
                      
                      {link.use_link_visibility && (
                        <Row>
                          <Col md={6}>
                            <FormGroup>
                              <Input
                                type="date"
                                value={link.start_visibility || ''}
                                onChange={(e) => onLinkDateChange(index, 'start_visibility', e.target.value)}
                                size="sm"
                                placeholder="Start date"
                              />
                              <small className="text-muted">Start date</small>
                            </FormGroup>
                          </Col>
                          
                          <Col md={6}>
                            <FormGroup>
                              <Input
                                type="date"
                                value={link.end_visibility || ''}
                                onChange={(e) => onLinkDateChange(index, 'end_visibility', e.target.value)}
                                size="sm"
                                placeholder="End date"
                              />
                              <small className="text-muted">End date</small>
                            </FormGroup>
                          </Col>
                        </Row>
                      )}
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* No links message */}
        {!hasPrimaryLink && links.length === 0 && (
          <Alert color="light" className="text-center">
            <FaEyeSlash className="mb-2" size={24} />
            <p className="mb-0">
              <small>Add a primary URL or additional links to configure link-specific visibility settings.</small>
            </p>
          </Alert>
        )}
      </CardBody>
    </Card>
  );
};

UnifiedVisibilityControl.propTypes = {
  // Resource-level visibility
  resourceStartDate: PropTypes.string,
  resourceEndDate: PropTypes.string,
  useResourceVisibility: PropTypes.bool,
  onResourceVisibilityToggle: PropTypes.func.isRequired,
  onResourceDateChange: PropTypes.func.isRequired,
  
  // Primary link visibility
  primaryLinkStartDate: PropTypes.string,
  primaryLinkEndDate: PropTypes.string,
  usePrimaryLinkVisibility: PropTypes.bool,
  onPrimaryLinkVisibilityToggle: PropTypes.func.isRequired,
  onPrimaryLinkDateChange: PropTypes.func.isRequired,
  hasPrimaryLink: PropTypes.bool,
  primaryUrl: PropTypes.string,
  
  // Additional links visibility
  links: PropTypes.arrayOf(PropTypes.shape({
    url: PropTypes.string,
    title: PropTypes.string,
    use_link_visibility: PropTypes.bool,
    start_visibility: PropTypes.string,
    end_visibility: PropTypes.string
  })),
  onLinkVisibilityChange: PropTypes.func.isRequired,
  onLinkDateChange: PropTypes.func.isRequired,
  
  // General settings
  materialTypeId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]),
  cascadeVisibilityToLinks: PropTypes.bool,
  onCascadeToggle: PropTypes.func.isRequired
};

UnifiedVisibilityControl.defaultProps = {
  links: [],
  hasPrimaryLink: false,
  cascadeVisibilityToLinks: false
};

export default UnifiedVisibilityControl;
