import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Table, Popover, PopoverBody, Button, Collapse } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
// Import tracking service
import { trackingService } from '../../../services/trackingService';

/**
 * RecordTable component
 * 
 * @component
 * @description Displays course records in a tabular format with expandable sections
 * for item details, availability information, and resource links.
 * 
 * @param {Object} props - Component props
 * @param {Array} props.combinedResults - Array of record items or record groups
 * @param {Object} props.availability - Mapping of instance IDs to availability data
 * @param {Object} props.customization - UI customization settings
 * @param {boolean} props.hasElectronicReserves - Whether electronic reserves are enabled
 * @param {Object} props.courseInfo - Information about the current course
 * @param {string} props.collegeParam - College identifier for tracking
 * @returns {JSX.Element} A table of course records with interactive elements
 */
const RecordTable = ({
  combinedResults,
  availability,
  customization,
  hasElectronicReserves,
  courseInfo,
  collegeParam,
}) => {
  const [activePopover, setActivePopover] = useState(null);
  const [expandedLinkItems, setExpandedLinkItems] = useState({});

  // Calculate total columns for table layout - define before use
  const totalColumns = (hasElectronicReserves ? 1 : 0) + 7 + 2; // Base columns + conditional folder column

  /**
   * Toggle the active popover
   * 
   * @function
   * @param {string|number} itemId - The ID of the item to toggle popover for
   */
  const togglePopover = (itemId) => {
    setActivePopover(activePopover === itemId ? null : itemId);
  };

  /**
   * Toggle expanded state for item links
   * 
   * @function
   * @param {string|number} itemId - The ID of the item to toggle links for
   */
  const toggleLinksExpand = (itemId) => {
    setExpandedLinkItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  /**
   * Generate discover link URL from instance ID
   * 
   * @function
   * @param {string} instanceId - The instance ID to generate link for
   * @returns {string|null} The discover link URL or null if inputs are invalid
   */
  const getDiscoverLink = (instanceId) => {
    if (!instanceId || !customization?.recordsDiscoverLinkBaseUrl) return null;
    return `${customization.recordsDiscoverLinkBaseUrl}${instanceId.replace(/-/g, '.')}`;
  };

  /**
   * Format publication information into readable string
   * 
   * @function
   * @param {Array} publication - Publication information array
   * @returns {string} Formatted publication string
   */
  const formatPublication = (publication) => {
    if (!publication?.length) return 'N/A';
    return publication
      .map(pub => {
        const parts = [];
        if (pub.publisher) parts.push(pub.publisher);
        if (pub.place) parts.push(pub.place);
        if (pub.dateOfPublication) parts.push(pub.dateOfPublication);
        return parts.join('; ');
      })
      .join(' / ');
  };

  // Extract course information with fallbacks for missing data
  const {
    name: courseName = 'N/A',
    courseNumber = 'N/A',
    courseListingId = 'N/A',
    courseListingObject = {}
  } = courseInfo || {};

  const termName = courseListingObject?.termObject?.name ?? 'N/A';
  const instructors = courseListingObject?.instructorObjects?.map(i => i.name) || [];

  /**
   * Handle external link click with tracking
   * 
   * @async
   * @function
   * @param {Event} e - Click event
   * @param {string} eventType - Type of event for tracking
   * @param {string} url - URL to open
   * @param {Object} recordItem - Record item being accessed
   * @param {Object} extraMetadata - Additional metadata for tracking
   */
  const handleExternalLinkClick = (e, eventType, url, recordItem, extraMetadata = {}) => {
    if (!url) {
      console.warn('Attempted to open external link with empty URL');
      return;
    }
    
    e.preventDefault();
    
    const { copiedItem } = recordItem || {};
    const { title: recordTitle, instanceId } = copiedItem || {};

    const trackingPayload = {
      college: collegeParam || 'Unknown',
      event_type: eventType,
      course_id: courseListingId,
      term: termName,
      course_name: courseName,
      course_code: courseNumber,
      instructor: instructors.map(name => ({ name })),

      metadata: {
        record_title: recordTitle || 'N/A',
        instanceId: instanceId || 'N/A',
        target_url: url,
        ...extraMetadata,
      },
    };

    try {
      trackingService.trackEvent(trackingPayload).finally(() => {
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    } catch (error) {
      console.error('Failed to track event:', error);
      // Still open the URL even if tracking fails
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  /**
   * Render an individual record row with its data
   * 
   * @function
   * @param {Object} item - Record item data
   * @returns {JSX.Element} Table row(s) for the record
   */
  const renderRecordRow = (item) => {
    if (!item || !item.copiedItem) {
      console.warn('Invalid record item data:', item);
      return null;
    }
    
    const instanceId = item.copiedItem?.instanceId;
    const holdings = availability[instanceId]?.holdings || [];
    const reserveCount = holdings.filter(h => h.location?.includes('Reserve')).length;
    const popoverId = `holdings-${item.id}`;

    const discoverUrl = !item.isElectronic ? getDiscoverLink(instanceId) : null;

    const resourceUrl = item.isElectronic && item.resource 
      ? item.resource.item_url 
      : item.copiedItem?.uri || item.copiedItem?.url || null;

    const hasAdditionalLinks = item.isElectronic && 
                              item.resource && 
                              Array.isArray(item.resource.links) && 
                              item.resource.links.length > 0;
    
    const isExpanded = expandedLinkItems[item.id] || false;

    return (
      <React.Fragment key={item.id}>
        <tr>
          {hasElectronicReserves && (
            <td>{item.folder_name || 'N/A'}</td>
          )}
          <td>{item.copiedItem.title}</td>
          <td>{item.copiedItem.contributors?.map(c => c.name).join(', ') || 'N/A'}</td>
          <td>
            {holdings.length > 0 && holdings[0].materialType?.name
              ? holdings[0].materialType.name
              : (item.isElectronic ? 'Electronic' : 'Print')}
          </td>
          <td>{item.copiedItem.callNumber || 'N/A'}</td>
          <td>{formatPublication(item.copiedItem.publication)}</td>
          <td>
            <span
              id={popoverId}
              className="text-primary cursor-pointer"
              onMouseEnter={() => togglePopover(item.id)}
              onMouseLeave={() => togglePopover(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  togglePopover(item.id);
                }
              }}
              tabIndex="0"
              role="button"
              aria-haspopup="true"
              aria-expanded={activePopover === item.id}
            >
              {item.isElectronic
                ? 'Electronic'
                : `${holdings.length} items (${reserveCount} Reserve)`}
            </span>
            {!item.isElectronic && (
              <Popover
                placement="auto"
                isOpen={activePopover === item.id}
                target={popoverId}
                trigger="hover"
              >
                <PopoverBody>
                  <h6 className="mb-2">Item Availability Details</h6>
                  {holdings.map((holding) => (
                    <div key={holding.id} className="mb-2 small">
                      <div><strong>Location:</strong> {holding.location}</div>
                      <div><strong>Library:</strong> {holding.library?.name || 'Unknown'}</div>
                      <div><strong>Status:</strong> {holding.status}</div>
                      <div>
                        <strong>Loan Type:</strong> {holding.temporaryLoanType || holding.permanentLoanType}
                      </div>
                    </div>
                  ))}
                </PopoverBody>
              </Popover>
            )}
          </td>
          
          <td>
            {!item.isElectronic && discoverUrl ? (
              <button
                onClick={(e) =>
                  handleExternalLinkClick(e, 'record_discover_link', discoverUrl, item)
                }
                className="btn btn-link p-0"
                style={{ textDecoration: 'underline' }}
              >
                {customization.recordsDiscoverLinkText || 'View in Catalog'}
              </button>
            ) : 'N/A'}
          </td>

          <td>
            {/* Resource access links section */}
            {resourceUrl ? (
              <div>
                <button
                  onClick={(e) =>
                    handleExternalLinkClick(e, 'resource_click', resourceUrl, item, {
                      isElectronic: item.isElectronic,
                    })
                  }
                  className="btn btn-link p-0"
                  style={{ textDecoration: 'underline' }}
                  aria-label="Access resource (opens in a new tab)"
                >
                  Access Resource <FontAwesomeIcon icon={faExternalLinkAlt} />
                </button>
                
                {hasAdditionalLinks && (
                  <div className="mt-2">
                    <Button 
                      color="link" 
                      size="sm" 
                      className="p-0"
                      onClick={() => toggleLinksExpand(item.id)}
                      aria-expanded={isExpanded}
                    >
                      <span className="badge bg-primary">
                        {item.resource.links.length} additional {item.resource.links.length === 1 ? 'link' : 'links'}
                      </span>
                      <FontAwesomeIcon 
                        icon={isExpanded ? faChevronUp : faChevronDown} 
                        className="ms-1" 
                      />
                    </Button>
                  </div>
                )}
              </div>
            ) : hasAdditionalLinks ? (
              <Button 
                color="link" 
                size="sm" 
                className="p-0"
                onClick={() => toggleLinksExpand(item.id)}
                aria-expanded={isExpanded}
              >
                <span className="badge bg-primary">
                  {item.resource.links.length} {item.resource.links.length === 1 ? 'link' : 'links'} available
                </span>
                <FontAwesomeIcon 
                  icon={isExpanded ? faChevronUp : faChevronDown} 
                  className="ms-1" 
                />
              </Button>
            ) : 'N/A'}
          </td>
        </tr>

        {/* Additional links row (collapsible) */}
        {hasAdditionalLinks && (
          <tr className="bg-light">
            <td colSpan={totalColumns} className="p-0">
              <Collapse isOpen={isExpanded}>
                <div className="p-3">
                  <h6 className="mb-2">Additional Links</h6>
                  <ul className="list-group">
                    {item.resource.links.map((link, idx) => (
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
                                    linkTitle: link.title
                                  }
                                )}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-primary"
                              >
                                {link.url}
                                <FontAwesomeIcon icon={faExternalLinkAlt} className="ms-1" />
                              </a>
                            </div>
                            {link.description && (
                              <div className="text-muted small mt-1">{link.description}</div>
                            )}
                          </div>
                          {link.use_proxy === "1" && (
                            <span className="badge bg-secondary">Proxy Enabled</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </Collapse>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <Table bordered responsive className="align-middle">
      <caption className="sr-only">
        List of available records, their types, holdings, and access links
      </caption>
      <thead className="table-light">
        <tr>
          {hasElectronicReserves && <th scope="col">Folder</th>}
          <th scope="col">Title</th>
          <th scope="col">Authors</th>
          <th scope="col">Type</th>
          <th scope="col">Call Number</th>
          <th scope="col">Publication</th>
          <th scope="col">Holdings</th>
          <th scope="col">Discover</th>
          <th scope="col">Resource</th>
        </tr>
      </thead>
      <tbody>
        {combinedResults.length > 0 ? (
          combinedResults.map((result) => {
            if (result.folder) {
              return (
                <React.Fragment key={`group-${result.folder}`}>
                  <tr className="table-group-divider">
                    <td colSpan={totalColumns} className="bg-dark text-white p-2">
                      {result.folder}
                    </td>
                  </tr>
                  {result.items.map(item => renderRecordRow(item))}
                </React.Fragment>
              );
            } else {
              return renderRecordRow(result);
            }
          })
        ) : (
          <tr>
            <td colSpan={totalColumns} className="text-center p-3">
              No records found
            </td>
          </tr>
        )}
      </tbody>
    </Table>
  );
};

RecordTable.propTypes = {
  /**
   * Combined results data containing either individual items or grouped items with folder
   */
  combinedResults: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.shape({
        folder: PropTypes.string.isRequired,
        items: PropTypes.array.isRequired,
      }),
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        copiedItem: PropTypes.shape({
          instanceId: PropTypes.string,
          title: PropTypes.string,
          contributors: PropTypes.arrayOf(
            PropTypes.shape({
              name: PropTypes.string,
            })
          ),
          publication: PropTypes.arrayOf(
            PropTypes.shape({
              publisher: PropTypes.string,
              place: PropTypes.string,
              dateOfPublication: PropTypes.string,
            })
          ),
          callNumber: PropTypes.string,
          uri: PropTypes.string,
          url: PropTypes.string,
        }).isRequired,
        isElectronic: PropTypes.bool,
        resource: PropTypes.shape({
          resource_id: PropTypes.string,
          name: PropTypes.string,
          item_url: PropTypes.string,
          description: PropTypes.string,
          external_note: PropTypes.string,
          internal_note: PropTypes.string,
          links: PropTypes.arrayOf(
            PropTypes.shape({
              link_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
              url: PropTypes.string,
              title: PropTypes.string,
              description: PropTypes.string,
              use_proxy: PropTypes.string
            })
          )
        }),
        folder_name: PropTypes.string,
      }),
    ])
  ).isRequired,
  /**
   * Availability data keyed by instance ID
   */
  availability: PropTypes.object.isRequired,
  /**
   * Whether electronic reserves feature is enabled
   */
  hasElectronicReserves: PropTypes.bool,
  /**
   * UI customization settings
   */
  customization: PropTypes.shape({
    recordsDiscoverLinkBaseUrl: PropTypes.string,
    recordsDiscoverLinkText: PropTypes.string,
  }).isRequired,
  /**
   * Course information for tracking and display
   */
  courseInfo: PropTypes.object,
  /**
   * College parameter for tracking
   */
  collegeParam: PropTypes.string,
};

RecordTable.defaultProps = {
  hasElectronicReserves: false,
  courseInfo: {},
  collegeParam: 'Unknown',
};

export default RecordTable;
