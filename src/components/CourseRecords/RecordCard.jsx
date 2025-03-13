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
  Table
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { trackingService } from '../../services/trackingService';

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
  const {
    recordsCardTitleTextColor,
    recordsCardTextColor,
    recordsDiscoverLinkText,
    recordsDiscoverLinkBgColor,
    recordsDiscoverLinkBaseUrl,
    accordionHeaderBgColor,
    accordionHeaderTextColor,
  } = customization;

  const { name: courseName, courseNumber, courseListingObject } = courseInfo || {};
  const termName = courseListingObject?.termObject?.name ?? 'N/A';
  const instructors = courseListingObject?.instructorObjects?.map((i) => i.name) || [];
  const { copiedItem, isElectronic, resource } = recordItem;
  const { instanceId, title, contributors, publication } = copiedItem;

  // Memoized style objects
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

    // Only perform the visibility check if the resource is electronic.
    if (isElectronic && resource) {
      const now = new Date();
      const startVisibility = resource.start_visibility
        ? new Date(resource.start_visibility)
        : null;
      const endVisibility = resource.end_visibility
        ? new Date(resource.end_visibility)
        : null;
  
      // If current time is before the start or after the end of the visibility window, don't render.
      if ((startVisibility && now < startVisibility) || (endVisibility && now > endVisibility)) {
        return null;
      }
    }

  // Helper to format publication info
  const formatPublication = useCallback((pubEntry) => {
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

  // Derive discover URL for print items
  const getDiscoverUrl = useCallback(
    (id) => {
      if (!id) return null;
      const edsLink = id.replace(/-/g, '.');
      return `${recordsDiscoverLinkBaseUrl}${edsLink}`;
    },
    [recordsDiscoverLinkBaseUrl]
  );

  const discoverUrl = !isElectronic ? getDiscoverUrl(instanceId) : null;

  // Availability data for print items
  const availabilityData = availability[instanceId] || {};
  const holdings = availabilityData.holdings || [];

console.log(resource)
  

  // ——————————————————————————————————————————
  // Tracking link clicks before opening them
  // ——————————————————————————————————————————

  // Generic helper to track a link click, then open in a new tab
  const handleExternalLinkClick = (e, eventType, url, extraMetadata = {}) => {
    e.preventDefault();
    trackingService.trackEvent({
      // Use collegeParam or fallback
      college: collegeParam || 'Unknown',

      event_type: eventType,
      course_id: courseInfo?.courseListingId ?? 'N/A',
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
  };
  // Render the “Holdings” section (for print items)
  const renderHoldingsSection = () => {
    if (isElectronic || !instanceId) return null;

    const reserves = holdings.filter((h) => h.location.includes('Reserve'));
    const otherHoldings = holdings.filter((h) => !h.location.includes('Reserve'));

    return (
      <div className="mt-3">
        <p className="mb-2">Availability Details</p>
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
          <caption className="sr-only">List of holdings and availability details</caption>
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
                        aria-label={
                          holding.status === 'Available'
                            ? 'Available copy'
                            : 'Checked out copy'
                        }
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
                        <button
                          className="btn btn-sm btn-success"
                          style={{
                            backgroundColor: recordsDiscoverLinkBgColor,
                            color: '#fff',
                          }}
                          aria-label="View this record in another library platform (opens in a new tab)"
                          onClick={(e) =>
                            handleExternalLinkClick(e, 'resource_click', resourceUrl, {
                              location: holding.location,
                              library: holding.library?.name,
                              holdingId: holding.id,
                              isReserve: holding.location?.includes('Reserve') || false,
                            })
                          }
                        >
                          Link to resource <FontAwesomeIcon icon={faExternalLinkAlt} />
                        </button>
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
    // We track the "Access Resource" link click
    const handleElectronicClick = (e) => {
      if (!resource.item_url) return;
      handleExternalLinkClick(e, 'resource_click', resource.item_url, {
        resourceId: resource.resource_id || 'N/A',
        name: resource.name || 'Unknown Resource',
      });
    };

    return (
      <div className="mt-3">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Badge color="info" style={{ color: 'black' }}>
            Electronic Resource
          </Badge>
          {resource.item_url && (
            <button
              onClick={handleElectronicClick}
              className="btn btn-sm btn-success"
            >
              Access Resource <FontAwesomeIcon icon={faExternalLinkAlt} />
            </button>
          )}
        </div>

        {resource.external_note && (
          <div className="alert alert-info small mb-2">{resource.external_note}</div>
        )}

        {resource.description && (
          <CardText style={textStyle}>
            <strong>Description:</strong> {resource.description}
          </CardText>
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

    // Track the “Discover” link click
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
          <button
            onClick={handleDiscoverClick}
            className="btn mb-3"
            style={{
              backgroundColor: recordsDiscoverLinkBgColor,
              color: '#fff',
            }}
            aria-label="View this record in the discovery system (opens in a new tab)"
          >
            {recordsDiscoverLinkText} <FontAwesomeIcon icon={faExternalLinkAlt} />
          </button>
        )}
      </>
    );
  };

  return (
    <Card
      className={`shadow p-3 mb-5 bg-body-tertiary ${
        isGrouped ? 'ms-4 border-start border-3 border-secondary-color-rgb' : ''
      }`}
      style={{
        backgroundColor: isGrouped ? '#f8f9fa' : 'inherit',
        borderLeft: isGrouped ? '3px solid #0d6efd' : 'inherit',
      }}
    >
      <CardBody>
        {isGrouped && (
          <div className="position-absolute top-0 start-0 translate-middle">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="#CCCDCE"
              className="bi bi-folder"
              viewBox="0 0 16 16"
              role="img"
              aria-label="Grouped records icon"
            >
              <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a2 2 0 0 1 .342-1.31zm6.339-1.577A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707z" />
            </svg>
          </div>
        )}
        <CardTitle tag="h2" style={titleStyle} className="h3 mb-3">
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
  isGrouped: PropTypes.bool,
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
  openAccordions: PropTypes.object.isRequired,
  toggleAccordion: PropTypes.func.isRequired,
  customization: PropTypes.shape({
    recordsCardTitleTextColor: PropTypes.string,
    recordsCardTextColor: PropTypes.string,
    recordsDiscoverLinkText: PropTypes.string,
    recordsDiscoverLinkBgColor: PropTypes.string,
    recordsDiscoverLinkBaseUrl: PropTypes.string,
    accordionHeaderBgColor: PropTypes.string,
    accordionHeaderTextColor: PropTypes.string,
  }).isRequired,
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
  collegeParam: PropTypes.string,

};

export default RecordCard;
