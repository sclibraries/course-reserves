import PropTypes from 'prop-types';
import { Collapse } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { containsHtml, sanitizeHtml } from '../../../../util/htmlUtils';
import { formatVisibilityDate } from '../../../../util/resourceVisibility';
import { isProxyEnabled } from '../recordDisplayUtils';

const RecordTableAdditionalLinks = ({
  links,
  item,
  isExpanded,
  totalColumns,
  recordTableText,
  canBypassVisibility,
  customization,
  handleExternalLinkClick,
}) => (
  <tr className="bg-light">
    <td colSpan={totalColumns} className="p-0">
      <Collapse isOpen={isExpanded}>
        <div className="p-3">
          <h6 className="mb-2">{recordTableText.additionalLinks}</h6>
          <ul className="list-group">
            {links.map((link, idx) => (
              <li key={link.link_id || idx} className="list-group-item">
                <div className="d-flex justify-content-between align-items-top">
                  <div>
                    <strong>{link.title || `Link ${idx + 1}`}</strong>
                    <div>
                      <a
                        href={link.url}
                        onClick={(e) => handleExternalLinkClick(
                          e,
                          'resource_link_click',
                          link.url,
                          item,
                          {
                            linkId: link.link_id,
                            linkTitle: link.title,
                          }
                        )}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{ color: customization.buttonPrimaryColor }}
                      >
                        {link.url}
                        <FontAwesomeIcon icon={faExternalLinkAlt} className="ms-1" />
                      </a>
                    </div>
                    {link.description && (
                      <div className="text-muted small mt-1">
                        {containsHtml(link.description) ? (
                          <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(link.description) }} />
                        ) : (
                          link.description
                        )}
                      </div>
                    )}
                    {/* Show link visibility dates for users authorized to bypass visibility */}
                    {canBypassVisibility && link.use_link_visibility && (link.start_visibility || link.end_visibility) && (
                      <div className="small text-muted mt-1">
                        <strong>Link Visibility:</strong>{' '}
                        {link.start_visibility ? `From ${formatVisibilityDate(link.start_visibility)}` : 'No start date'}{' '}
                        {link.end_visibility ? `until ${formatVisibilityDate(link.end_visibility, 'end')}` : 'No end date'}
                      </div>
                    )}
                  </div>
                  {isProxyEnabled(link) && (
                    <span className="badge bg-light text-dark">Proxy Enabled</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Collapse>
    </td>
  </tr>
);

RecordTableAdditionalLinks.propTypes = {
  links: PropTypes.array.isRequired,
  item: PropTypes.object.isRequired,
  isExpanded: PropTypes.bool,
  totalColumns: PropTypes.number,
  recordTableText: PropTypes.object.isRequired,
  canBypassVisibility: PropTypes.bool,
  customization: PropTypes.object.isRequired,
  handleExternalLinkClick: PropTypes.func.isRequired,
};

export default RecordTableAdditionalLinks;
