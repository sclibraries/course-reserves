import PropTypes from 'prop-types';
import { Alert, Row, Col } from 'reactstrap';
import { FaEye, FaCalendarAlt, FaLink, FaInfoCircle } from 'react-icons/fa';

/**
 * VisibilitySummary - Shows a summary of current visibility settings
 * 
 * This component provides a clear overview of what visibility settings
 * are currently active for the resource and its links.
 */
export const VisibilitySummary = ({ 
  resourceStartDate,
  resourceEndDate,
  useResourceVisibility,
  usePrimaryLinkVisibility,
  primaryLinkStartDate,
  primaryLinkEndDate,
  hasPrimaryLink,
  links,
  materialTypeId,
  cascadeVisibilityToLinks
}) => {
  // Check if this is a video material type (ID = 3)
  const isVideoMaterialType = materialTypeId === '3' || materialTypeId === 3;
  
  // Count links with individual visibility settings
  const linksWithVisibility = links.filter(link => link.use_link_visibility).length;
  
  // Determine if resource visibility is active
  const resourceVisibilityActive = useResourceVisibility || isVideoMaterialType;
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Invalid date';
    }
  };

  // If no visibility settings are active, show simplified message
  if (!resourceVisibilityActive && !usePrimaryLinkVisibility && linksWithVisibility === 0) {
    return (
      <Alert color="light" className="mb-3">
        <FaInfoCircle className="me-2" />
        <small>
          <strong>No visibility restrictions:</strong> This resource and all its links will be visible to students at all times.
        </small>
      </Alert>
    );
  }

  return (
    <Alert color="info" className="mb-3">
      <div className="d-flex align-items-center mb-2">
        <FaEye className="me-2" />
        <strong>Current Visibility Settings</strong>
      </div>
      
      <Row className="g-3">
        {/* Resource Visibility */}
        {resourceVisibilityActive && (
          <Col md={6}>
            <div className="d-flex align-items-start">
              <FaCalendarAlt className="me-2 mt-1 text-primary" size={14} />
              <div>
                <strong className="d-block">Resource Visibility</strong>
                <small className="text-muted">
                  {formatDate(resourceStartDate)} to {formatDate(resourceEndDate)}
                  {isVideoMaterialType && (
                    <span className="badge bg-warning ms-2">Auto-enabled (Video)</span>
                  )}
                </small>
              </div>
            </div>
          </Col>
        )}
        
        {/* Primary Link Visibility */}
        {hasPrimaryLink && (
          <Col md={6}>
            <div className="d-flex align-items-start">
              <FaLink className="me-2 mt-1 text-secondary" size={14} />
              <div>
                <strong className="d-block">Primary Link</strong>
                <small className="text-muted">
                  {usePrimaryLinkVisibility ? (
                    <>
                      {formatDate(primaryLinkStartDate)} to {formatDate(primaryLinkEndDate)}
                      <span className="badge bg-primary ms-2">Custom dates</span>
                    </>
                  ) : cascadeVisibilityToLinks && resourceVisibilityActive ? (
                    <>
                      Using resource dates
                      <span className="badge bg-secondary ms-2">Cascaded</span>
                    </>
                  ) : (
                    <>
                      Always visible
                      <span className="badge bg-success ms-2">No restrictions</span>
                    </>
                  )}
                </small>
              </div>
            </div>
          </Col>
        )}
        
        {/* Additional Links Summary */}
        {links.length > 0 && (
          <Col md={12}>
            <div className="d-flex align-items-start">
              <FaLink className="me-2 mt-1 text-secondary" size={14} />
              <div>
                <strong className="d-block">Additional Links ({links.length})</strong>
                <small className="text-muted">
                  {cascadeVisibilityToLinks && resourceVisibilityActive ? (
                    <>
                      All using resource dates
                      <span className="badge bg-secondary ms-2">Cascaded</span>
                    </>
                  ) : linksWithVisibility > 0 ? (
                    <>
                      {linksWithVisibility} with custom dates, {links.length - linksWithVisibility} always visible
                      <span className="badge bg-info ms-2">Mixed settings</span>
                    </>
                  ) : (
                    <>
                      All always visible
                      <span className="badge bg-success ms-2">No restrictions</span>
                    </>
                  )}
                </small>
              </div>
            </div>
          </Col>
        )}
      </Row>
    </Alert>
  );
};

VisibilitySummary.propTypes = {
  resourceStartDate: PropTypes.string,
  resourceEndDate: PropTypes.string,
  useResourceVisibility: PropTypes.bool,
  usePrimaryLinkVisibility: PropTypes.bool,
  primaryLinkStartDate: PropTypes.string,
  primaryLinkEndDate: PropTypes.string,
  hasPrimaryLink: PropTypes.bool,
  links: PropTypes.arrayOf(PropTypes.shape({
    use_link_visibility: PropTypes.bool,
    start_visibility: PropTypes.string,
    end_visibility: PropTypes.string
  })),
  materialTypeId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]),
  cascadeVisibilityToLinks: PropTypes.bool
};

VisibilitySummary.defaultProps = {
  links: [],
  hasPrimaryLink: false,
  cascadeVisibilityToLinks: false
};

export default VisibilitySummary;
