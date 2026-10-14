import PropTypes from 'prop-types';
import { Badge, Button, CardText } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { containsHtml, sanitizeHtml } from '../../../../util/htmlUtils';
import {
  formatVisibilityDate,
  getVisibleLinks,
  isPrimaryLinkVisible,
} from '../../../../util/resourceVisibility';
import { isProxyEnabled } from '../recordDisplayUtils';

const RecordCardElectronicResource = ({
  resource,
  title,
  canBypassVisibility,
  visibilityInfo,
  showVisibilityDates,
  recordsDiscoverLinkBgColor,
  textStyle,
  handleExternalLinkClick,
}) => {
  if (!resource) return null;

  const handleElectronicClick = (event) => {
    if (!resource.item_url) return;
    handleExternalLinkClick(event, 'resource_click', resource.item_url, {
      resourceId: resource.resource_id || 'N/A',
      name: resource.name || 'Unknown Resource',
    });
  };

  const handleAdditionalLinkClick = (event, link) => {
    handleExternalLinkClick(event, 'resource_link_click', link.url, {
      resourceId: resource.resource_id || 'N/A',
      linkId: link.link_id || 'N/A',
      linkTitle: link.title || 'Unknown Link',
    });
  };

  const visibleAdditionalLinks = getVisibleLinks(resource.links, canBypassVisibility);
  const isPrimaryLinkVisibleCheck = isPrimaryLinkVisible(resource, canBypassVisibility);

  return (
    <div className="mt-3">
      {resource.item_url && isPrimaryLinkVisibleCheck && (
        <Button
          color="primary"
          onClick={handleElectronicClick}
          className="mb-3 d-inline-flex align-items-center"
          style={{
            backgroundColor: recordsDiscoverLinkBgColor,
            borderColor: recordsDiscoverLinkBgColor,
          }}
          aria-label={`Access electronic resource for ${title} (opens in a new tab)`}
        >
          <FontAwesomeIcon icon={faBook} className="me-2" aria-hidden="true" />
          Access Resource
          <FontAwesomeIcon icon={faExternalLinkAlt} className="ms-2" aria-hidden="true" />
        </Button>
      )}

      {showVisibilityDates && (
        <div className="alert alert-info small mb-2" role="alert">
          <strong>Visibility Window:</strong>{' '}
          {visibilityInfo.startDate ? `From ${formatVisibilityDate(visibilityInfo.startDate)}` : 'No start date'}{' '}
          {visibilityInfo.endDate ? `until ${formatVisibilityDate(visibilityInfo.endDate, 'end')}` : 'No end date'}
        </div>
      )}

      {resource.external_note && (
        <div className="alert alert-info small mb-2" role="alert">
          {containsHtml(resource.external_note) ? (
            <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(resource.external_note) }} />
          ) : (
            resource.external_note
          )}
        </div>
      )}

      {resource.description && (
        <CardText style={textStyle}>
          <strong>Description:</strong>{' '}
          {containsHtml(resource.description) ? (
            <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(resource.description) }} />
          ) : (
            resource.description
          )}
        </CardText>
      )}

      {visibleAdditionalLinks.length > 0 && (
        <div className="additional-links mt-3">
          <h3 className="h6 fw-bold mb-2">Additional Resources</h3>
          <div className="list-group">
            {visibleAdditionalLinks.map((link, index) => (
              <div key={link.link_id || index} className="list-group-item list-group-item-action">
                <div className="d-flex w-100 justify-content-between">
                  <h4 className="h6 mb-1">{link.title || 'Additional Resource'}</h4>
                  <div>
                    {isProxyEnabled(link) && (
                      <Badge color="secondary" className="me-1">Proxy Enabled</Badge>
                    )}
                  </div>
                </div>

                {link.description && <p className="mb-2">{link.description}</p>}

                {canBypassVisibility && link.use_link_visibility && (link.start_visibility || link.end_visibility) && (
                  <div className="small text-muted mb-2">
                    <strong>Link Visibility:</strong>{' '}
                    <strong>Link Visibility:</strong>{' '}
                    {link.start_visibility ? `From ${formatVisibilityDate(link.start_visibility)}` : 'No start date'}{' '}
                    {link.end_visibility ? `until ${formatVisibilityDate(link.end_visibility, 'end')}` : 'No end date'}
                  </div>
                )}

                <a
                  href={link.url}
                  onClick={(event) => handleAdditionalLinkClick(event, link)}
                  className="text-primary d-block mb-1"
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`Access ${link.title || 'additional resource'} (opens in new tab)`}
                >
                  <span className="text-truncate d-inline-block" style={{ maxWidth: '100%' }}>
                    {link.url}
                  </span>
                  <FontAwesomeIcon icon={faExternalLinkAlt} className="ms-2" aria-hidden="true" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {resource.metadata?.map((meta, index) => (
        <CardText key={index} style={textStyle} className="small">
          <strong>{meta.field_name}:</strong> {meta.field_value}
        </CardText>
      ))}
    </div>
  );
};

RecordCardElectronicResource.propTypes = {
  resource: PropTypes.object,
  title: PropTypes.string,
  canBypassVisibility: PropTypes.bool.isRequired,
  visibilityInfo: PropTypes.object.isRequired,
  showVisibilityDates: PropTypes.bool,
  recordsDiscoverLinkBgColor: PropTypes.string.isRequired,
  textStyle: PropTypes.object.isRequired,
  handleExternalLinkClick: PropTypes.func.isRequired,
};

export default RecordCardElectronicResource;
