import { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardBody,
  CardTitle,
  CardText,
  Accordion,
  AccordionBody,
  AccordionHeader,
  AccordionItem,
  Badge,
  Table,
  Button
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faBook } from '@fortawesome/free-solid-svg-icons';
import { trackingService } from '../../../services/trackingService';

/**
 * RecordCard component
 * 
 * @component
 * @description Renders a detailed card for a course record item, showing resource metadata,
 * availability information, and access options based on whether it's electronic or print.
 * 
 * @param {Object} props - Component properties
 * @param {Object} props.recordItem - Record data to display
 * @param {Object} props.availability - Availability information keyed by instance ID
 * @param {Object} props.openAccordions - State of open/closed accordions
 * @param {Function} props.toggleAccordion - Function to toggle accordion open state
 * @param {Object} props.customization - UI customization settings
 * @param {boolean} props.isGrouped - Whether the record is part of a grouped display
 * @param {Object} props.courseInfo - Information about the associated course
 * @param {string} props.collegeParam - College parameter for tracking
 * @returns {JSX.Element|null} The record card or null if visibility conditions aren't met
 */
const RecordCard = ({
  recordItem,
  availability,
  openAccordions,
  toggleAccordion,
  customization,
  isGrouped = false,
  courseInfo,
  collegeParam,
}) => {
  // Destructure customization settings with fallback values for safety
  const {
    recordsCardTitleTextColor = '#000000',
    recordsCardTextColor = '#212529',
    recordsDiscoverLinkText = 'View in Catalog',
    recordsDiscoverLinkBgColor = '#0d6efd',
    recordsDiscoverLinkBaseUrl = '',
    accordionHeaderBgColor = '#f8f9fa',
    accordionHeaderTextColor = '#212529',
  } = customization || {};

  const textStyle = useMemo(
    () => ({ color: recordsCardTextColor }),
    [recordsCardTextColor]
  );
  
  const titleStyle = useMemo(
    () => ({ color: recordsCardTitleTextColor }),
    [recordsCardTitleTextColor]
  );
  
  const accordionHeaderStyle = useMemo(
    () => ({
      backgroundColor: accordionHeaderBgColor,
      color: accordionHeaderTextColor,
    }),
    [accordionHeaderBgColor, accordionHeaderTextColor]
  );


  /**
   * Format publication info into readable string
   * 
   * @function
   * @param {Array} pubEntry - Publication information array
   * @returns {string} Formatted publication text
   */
  const formatPublication = useCallback((pubEntry) => {
    if (!pubEntry || !Array.isArray(pubEntry)) return 'N/A';
    
    return pubEntry
      .map((pub) => {
        const parts = [];
        if (pub.publisher) parts.push(pub.publisher);
        if (pub.place) parts.push(pub.place);
        if (pub.dateOfPublication) parts.push(pub.dateOfPublication);
        return parts.join('; ');
      })
      .join(' / ');
  }, []);

  /**
   * Build the discover URL for print items
   * 
   * @function
   * @param {string} id - Instance ID
   * @returns {string|null} Discover URL or null if unable to build
   */
  const getDiscoverUrl = useCallback(
    (id) => {
      if (!id || !recordsDiscoverLinkBaseUrl) return null;
      const edsLink = id.replace(/-/g, '.');
      return `${recordsDiscoverLinkBaseUrl}${edsLink}`;
    },
    [recordsDiscoverLinkBaseUrl]
  );

  // Extract course info with fallbacks for missing data
  const { 
    name: courseName = 'N/A', 
    courseNumber = 'N/A', 
    courseListingObject = {},
    courseListingId = 'N/A'
  } = courseInfo || {};
  
  const termName = courseListingObject?.termObject?.name ?? 'N/A';
  const instructors = courseListingObject?.instructorObjects?.map((i) => i.name) || [];
  
  // Extract record data with null checks
  if (!recordItem || !recordItem.copiedItem) {
    console.error('Invalid record item data:', recordItem);
    return null;
  }
  
  const { copiedItem, isElectronic, resource } = recordItem;
  const { instanceId, title, contributors, publication } = copiedItem;

  // Determine resource type styling
  const resourceTypeStyles = isElectronic ? {
    borderLeft: '4px solid #1976D2', // Blue for electronic resources
    borderLeftColor: '#1976D2'
  } : {
    borderLeft: '4px solid #388E3C', // Green for print resources
    borderLeftColor: '#388E3C'
  };


  /**
   * Check visibility window for electronic resources
   * @returns {boolean} Whether the resource should be visible
   */
  const isVisibleResource = () => {
    if (isElectronic && resource) {
      const now = new Date();
      const startVisibility = resource.start_visibility
        ? new Date(resource.start_visibility)
        : null;
      const endVisibility = resource.end_visibility
        ? new Date(resource.end_visibility)
        : null;

      // If current time is before the start or after the end of the visibility window, don't render
      if ((startVisibility && now < startVisibility) || (endVisibility && now > endVisibility)) {
        return false;
      }
    }
    return true;
  };

  // Don't render if resource should be hidden based on visibility window
  if (!isVisibleResource()) {
    return null;
  }

  const discoverUrl = !isElectronic ? getDiscoverUrl(instanceId) : null;

  // Availability data for print items
  const availabilityData = availability[instanceId] || {};
  const holdings = availabilityData.holdings || [];

  /**
   * Track a link click event and open the URL in a new tab
   * 
   * @async
   * @function
   * @param {Event} e - Click event object
   * @param {string} eventType - Type of event for tracking
   * @param {string} url - URL to open
   * @param {Object} extraMetadata - Additional metadata for tracking
   */
  const handleExternalLinkClick = (e, eventType, url, extraMetadata = {}) => {
    if (!url) {
      console.warn('Attempted to open external link with empty URL');
      return;
    }
    
    e.preventDefault();
    
    try {
      trackingService.trackEvent({
        college: collegeParam || 'Unknown',
        event_type: eventType,
        course_id: courseListingId,
        term: termName,
        course_name: courseName,
        course_code: courseNumber,
        instructor: instructors.map((inst) => ({ name: inst })),
        metadata: {
          record_title: recordItem.copiedItem?.title || 'N/A',
          instanceId: recordItem.copiedItem?.instanceId || 'N/A',
          target_url: url,
          ...extraMetadata,
        },
      }).finally(() => {
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    } catch (error) {
      console.error('Error tracking event:', error);
      // Still open the URL if tracking fails
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };
  
  // Render the "Holdings" section (for print items)
  const renderHoldingsSection = () => {
    if (isElectronic || !instanceId) return null;

    const reserves = holdings.filter((h) => h.location.includes('Reserve'));
    const otherHoldings = holdings.filter((h) => !h.location.includes('Reserve'));

    return (
      <div className="mt-3">
        <h3 className="h6 mb-2">Availability Details</h3>
        <Accordion
          flush
          open={openAccordions[instanceId]}
          toggle={(accordionId) => toggleAccordion(instanceId, accordionId)}
        >
          {reserves.length > 0 && (
            <AccordionItem>
              <AccordionHeader
                targetId={`reserves-${instanceId}`}
                style={accordionHeaderStyle}
                role="button"
                aria-expanded={openAccordions[instanceId] === `reserves-${instanceId}`}
              >
                {reserves.length === 1
                  ? `1 Copy on Reserve`
                  : `${reserves.length} Copies on Reserve`}
              </AccordionHeader>
              <AccordionBody accordionId={`reserves-${instanceId}`}>
                {renderHoldingItems(reserves, 'temporary')}
              </AccordionBody>
            </AccordionItem>
          )}

          {otherHoldings.length > 0 && (
            <AccordionItem>
              <AccordionHeader
                targetId={`holdings-${instanceId}`}
                style={accordionHeaderStyle}
                aria-expanded={openAccordions[instanceId] === `holdings-${instanceId}`}
              >
                Other Holdings ({otherHoldings.length})
              </AccordionHeader>
              <AccordionBody accordionId={`holdings-${instanceId}`}>
                {renderHoldingItems(otherHoldings, 'permanent')}
              </AccordionBody>
            </AccordionItem>
          )}
        </Accordion>

        {holdings.length === 0 && (
          <div className="text-muted small">No availability data found</div>
        )}
      </div>
    );
  };

  // Render details inside each holdings accordion
  const renderHoldingItems = (holdings, loanType) => {
    // Helper to determine the URL for each holding
    const getHoldingUrl = (holding) => {
      if (holding.uri || holding.url) {
        return holding.uri || holding.url;
      }
      // If the holding's barcode matches the copiedItem's barcode
      if (holding.barcode === copiedItem.barcode) {
        return copiedItem.uri || copiedItem.url;
      }
      return '';
    };

    const showLocation = holdings.some((h) => h.location);
    const showLibrary = holdings.some((h) => h.library && h.library.name);
    const showStatus = holdings.some((h) => h.status);
    const showLoanType = holdings.some((h) => h[`${loanType}LoanType`]);
    const showCallNumber = holdings.some((h) => h.callNumber);
    const showBarcode = holdings.some((h) => h.barcode);
    const showVolume = holdings.some((h) => h.volume);
    const showAccess = holdings.some((h) => getHoldingUrl(h));

    return (
      <div className="table-responsive">
        <Table striped className="table mb-0">
          <caption className="visually-hidden">List of holdings and availability details</caption>
          <thead>
            <tr>
              {showLocation && <th scope="col">Location</th>}
              {showLibrary && <th scope="col">Library</th>}
              {showStatus && <th scope="col">Status</th>}
              {showLoanType && <th scope="col">Loan Type</th>}
              {showCallNumber && <th scope="col">Call Number</th>}
              {showBarcode && <th scope="col">Barcode</th>}
              {showVolume && <th scope="col">Volume</th>}
              {showAccess && <th scope="col">Access</th>}
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => {
              const resourceUrl = getHoldingUrl(holding);
              return (
                <tr key={holding.id}>
                  {showLocation && <td>{holding.location}</td>}
                  {showLibrary && <td>{holding.library?.name}</td>}
                  {showStatus && (
                    <td>
                      <Badge
                        color={holding.status === 'Available' ? 'success' : 'danger'}
                        style={{
                          backgroundColor: holding.status === 'Available' ? '#198754' : '#dc3545',
                          color: '#ffffff',
                          padding: '4px 8px',
                        }}
                      >
                        {holding.status}
                      </Badge>
                    </td>
                  )}
                  {showLoanType && <td>{holding[`${loanType}LoanType`]}</td>}
                  {showCallNumber && <td>{holding.callNumber}</td>}
                  {showBarcode && <td>{holding.barcode}</td>}
                  {showVolume && <td>{holding.volume || ''}</td>}
                  {showAccess && (
                    <td>
                      {resourceUrl && (
                        <Button
                          size="sm"
                          color="success"
                          style={{
                            backgroundColor: recordsDiscoverLinkBgColor,
                            color: '#fff',
                          }}
                          onClick={(e) =>
                            handleExternalLinkClick(e, 'resource_click', resourceUrl, {
                              location: holding.location,
                              library: holding.library?.name,
                              holdingId: holding.id,
                              isReserve: holding.location?.includes('Reserve') || false,
                            })
                          }
                          aria-label={`Access resource for ${title} (opens in a new tab)`}
                        >
                          Access <FontAwesomeIcon icon={faExternalLinkAlt} aria-hidden="true" />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    );
  };

  // For electronic items, render relevant info
  const renderElectronicResource = () => {
    if (!isElectronic || !resource) return null;
    
    // Track the "Access Resource" link click
    const handleElectronicClick = (e) => {
      if (!resource.item_url) return;
      handleExternalLinkClick(e, 'resource_click', resource.item_url, {
        resourceId: resource.resource_id || 'N/A',
        name: resource.name || 'Unknown Resource',
      });
    };

    // Handle additional link click with tracking
    const handleAdditionalLinkClick = (e, link) => {
      handleExternalLinkClick(e, 'resource_link_click', link.url, {
        resourceId: resource.resource_id || 'N/A',
        linkId: link.link_id || 'N/A',
        linkTitle: link.title || 'Unknown Link',
      });
    };

    // Check if resource has additional links
    const hasAdditionalLinks = resource.links && resource.links.length > 0;

    return (
      <div className="mt-3">
        {resource.item_url && (
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

        {resource.external_note && (
          <div className="alert alert-info small mb-2" role="alert">
            {resource.external_note}
          </div>
        )}

        {resource.description && (
          <CardText style={textStyle}>
            <strong>Description:</strong> {resource.description}
          </CardText>
        )}

        {/* Display additional links if available */}
        {hasAdditionalLinks && (
          <div className="additional-links mt-3">
            <h3 className="h6 fw-bold mb-2">Additional Resources</h3>
            <div className="list-group">
              {resource.links.map((link, index) => (
                <div key={link.link_id || index} className="list-group-item list-group-item-action">
                  <div className="d-flex w-100 justify-content-between">
                    <h4 className="h6 mb-1">{link.title || 'Additional Resource'}</h4>
                    {link.use_proxy === "1" && (
                      <Badge color="secondary">Proxy Enabled</Badge>
                    )}
                  </div>
                  <a 
                    href={link.url}
                    onClick={(e) => handleAdditionalLinkClick(e, link)}
                    className="text-primary d-block mb-1"
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`Access ${link.title || 'additional resource'} (opens in new tab)`}
                  >
                    <span className="text-truncate d-inline-block" style={{ maxWidth: "100%" }}>
                      {link.url}
                    </span>
                    <FontAwesomeIcon icon={faExternalLinkAlt} className="ms-2" aria-hidden="true" />
                  </a>
                  {link.description && (
                    <p className="mb-1 small text-muted">{link.description}</p>
                  )}
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

  // For print items, show authors, publication, and discover link
  const renderPrintDetails = () => {
    if (isElectronic) return null;

    // Track the "Discover" link click
    const handleDiscoverClick = (e) => {
      if (!discoverUrl) return;
      handleExternalLinkClick(e, 'record_discover_link', discoverUrl, {
        authors: contributors?.map((c) => c.name) || [],
      });
    };

    return (
      <>
        {contributors?.length > 0 && (
          <CardText style={textStyle}>
            <strong>Authors:</strong> {contributors.map((c) => c.name).join(', ')}
          </CardText>
        )}

        {publication?.length > 0 && (
          <CardText style={textStyle}>
            <strong>Publication:</strong> {formatPublication(publication)}
          </CardText>
        )}

        {discoverUrl && (
          <Button
            color="primary"
            onClick={handleDiscoverClick}
            className="mb-3 d-inline-flex align-items-center"
            style={{
              backgroundColor: recordsDiscoverLinkBgColor,
              borderColor: recordsDiscoverLinkBgColor,
            }}
            aria-label={`View ${title} in library catalog (opens in a new tab)`}
          >
            {recordsDiscoverLinkText} <FontAwesomeIcon icon={faExternalLinkAlt} className="ms-2" aria-hidden="true" />
          </Button>
        )}
      </>
    );
  };

  // Main render
  return (
    <Card
      className={`shadow-sm mb-4 bg-body-tertiary ${
        isGrouped ? 'ms-4 border-start border-3 border-secondary-color-rgb' : ''
      }`}
      style={{
        ...resourceTypeStyles,
        transition: 'all 0.2s ease-in-out'
      }}
    >
      <CardBody>
        {/* Resource type badge */}
        <Badge 
          color={isElectronic ? "primary" : "success"}
          className="resource-badge"
          pill
        >
          {isElectronic ? "Electronic Resource" : "Physical Resource"}
        </Badge>

        {/* Card heading - use appropriate heading level for accessibility */}
        <CardTitle tag="h2" style={titleStyle} className="h3 mb-3 mt-4">
          {title}
        </CardTitle>

        {renderPrintDetails()}
        {renderElectronicResource()}
        {renderHoldingsSection()}
      </CardBody>
    </Card>
  );
};

RecordCard.propTypes = {
  /**
   * Record item data containing all necessary information
   */
  recordItem: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    copiedItem: PropTypes.shape({
      instanceId: PropTypes.string,
      title: PropTypes.string,
      barcode: PropTypes.string,
      url: PropTypes.string,
      uri: PropTypes.string,
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
    }).isRequired,
    isElectronic: PropTypes.bool,
    resource: PropTypes.object,
  }).isRequired,
  /**
   * Whether the record is displayed as part of a group
   */
  isGrouped: PropTypes.bool,
  /**
   * Availability information keyed by instance ID
   */
  availability: PropTypes.objectOf(
    PropTypes.shape({
      holdings: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          location: PropTypes.string,
          status: PropTypes.string,
          temporaryLoanType: PropTypes.string,
          permanentLoanType: PropTypes.string,
          library: PropTypes.shape({
            name: PropTypes.string,
          }),
        })
      ),
    })
  ).isRequired,
  /**
   * Map of which accordions are open, keyed by ID
   */
  openAccordions: PropTypes.object.isRequired,
  /**
   * Function to toggle accordion open state
   */
  toggleAccordion: PropTypes.func.isRequired,
  /**
   * UI customization settings
   */
  customization: PropTypes.shape({
    recordsCardTitleTextColor: PropTypes.string,
    recordsCardTextColor: PropTypes.string,
    recordsDiscoverLinkText: PropTypes.string,
    recordsDiscoverLinkBgColor: PropTypes.string,
    recordsDiscoverLinkBaseUrl: PropTypes.string,
    accordionHeaderBgColor: PropTypes.string,
    accordionHeaderTextColor: PropTypes.string,
  }).isRequired,
  /**
   * Course information for tracking and display
   */
  courseInfo: PropTypes.shape({
    name: PropTypes.string,
    courseNumber: PropTypes.string,
    courseListingId: PropTypes.string,
    courseListingObject: PropTypes.shape({
      termObject: PropTypes.shape({
        name: PropTypes.string,
      }),
      instructorObjects: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
        })
      ),
    }),
  }),
  /**
   * College parameter for tracking
   */
  collegeParam: PropTypes.string,
};

// Default props
RecordCard.defaultProps = {
  isGrouped: false,
  courseInfo: {},
  collegeParam: 'Unknown'
};

export default RecordCard;
