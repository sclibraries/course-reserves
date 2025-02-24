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

const RecordCard = ({
  recordItem,
  availability,
  openAccordions,
  toggleAccordion,
  customization,
  isGrouped = false,
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

  const { copiedItem, isElectronic, resource } = recordItem;
  const { instanceId, title, contributors, publication} = copiedItem;

  // Memoized style objects
  const textStyle = useMemo(() => ({ color: recordsCardTextColor }), [recordsCardTextColor]);
  const titleStyle = useMemo(() => ({ color: recordsCardTitleTextColor }), [recordsCardTitleTextColor]);
  const accordionHeaderStyle = useMemo(() => ({
    backgroundColor: accordionHeaderBgColor,
    color: accordionHeaderTextColor
  }), [accordionHeaderBgColor, accordionHeaderTextColor]);

  // Helper functions
  const formatPublication = useCallback((pubEntry) => {
    return pubEntry.map(pub => {
      const parts = [];
      if (pub.publisher) parts.push(pub.publisher);
      if (pub.place) parts.push(pub.place);
      if (pub.dateOfPublication) parts.push(pub.dateOfPublication);
      return parts.join('; ');
    }).join(' / ');
  }, []);

  const getDiscoverUrl = useCallback((instanceId) => {
    if (!instanceId) return null;
    const edsLink = instanceId.replace(/-/g, '.');
    return `${recordsDiscoverLinkBaseUrl}${edsLink}`;
  }, [recordsDiscoverLinkBaseUrl]);

  // Derived values
  const discoverUrl = !isElectronic ? getDiscoverUrl(instanceId) : null;
  const availabilityData = availability[instanceId] || {};
  const holdings = availabilityData.holdings || [];

  const renderHoldingsSection = () => {
    if (isElectronic || !instanceId) return null;
    
    const reserves = holdings.filter(h => h.location.includes('Reserve'));
    const otherHoldings = holdings.filter(h => !h.location.includes('Reserve'));

    console.log('reserves:', reserves);

    return (
      <div className="mt-3">
        <p className="mb-2">Availability Details</p>
        <Accordion
          flush
          open={openAccordions[instanceId]}
          toggle={accordionId => toggleAccordion(instanceId, accordionId)}
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

  const renderHoldingItems = (holdings, loanType) => (
    <div className="table-responsive">
      <Table striped className="table mb-0">
        <caption className="sr-only">List of holdings and availability details</caption>
        <thead>
          <tr>
            <th scope="col">Location</th>
            <th scope="col">Library</th>
            <th scope="col">Status</th>
            <th scope="col">Loan Type</th>
            <th scope="col">Call Number</th>
            <th scope="col">Barcode</th>
            <th scope="col">Volume</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map(holding => (
            <tr key={holding.id}>
              <td>{holding.location}</td>
              <td>{holding.library?.name}</td>
              <td>
                <Badge
                  color={holding.status === "Available" ? "success" : "danger"}
                  style={{
                    backgroundColor: holding.status === "Available" ? "#198754" : "#dc3545",
                    color: "#ffffff", // Ensures contrast
                    padding: "4px 8px",
                  }}
                  aria-label={holding.status === "Available" ? "Available copy" : "Checked out copy"}
                >
                  {holding.status}
                </Badge>
              </td>
              <td>{holding[`${loanType}LoanType`]}</td>
              <td>{holding.callNumber}</td>
              <td>{holding.barcode}</td>
              <td>{holding?.volume || ''}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );

  const renderElectronicResource = () => {
    if (!isElectronic || !resource) return null;

    return (
      <div className="mt-3">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Badge color="info" style={{color: 'black'}}>Electronic Resource</Badge>
          {resource.item_url && (
            <a
              href={resource.item_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-success"
            >
              Access Resource <FontAwesomeIcon icon={faExternalLinkAlt} />
            </a>
          )}
        </div>

        {resource.external_note && (
          <div className="alert alert-info small mb-2">
            {resource.external_note}
          </div>
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

  const renderPrintDetails = () => {
    if (isElectronic) return null;

    return (
      <>
        {contributors?.length > 0 && (
          <CardText style={textStyle}>
            <strong>Authors:</strong> {contributors.map(c => c.name).join(', ')}
          </CardText>
        )}

        {publication?.length > 0 && (
          <CardText style={textStyle}>
            <strong>Publication:</strong> {formatPublication(publication)}
          </CardText>
        )}

        {discoverUrl && (
          <a
            href={discoverUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn mb-3"
            style={{
              backgroundColor: recordsDiscoverLinkBgColor,
              color: '#fff',
            }}
            aria-label="View this record in the discovery system (opens in a new tab)"
          >
            {recordsDiscoverLinkText} <FontAwesomeIcon icon={faExternalLinkAlt} />
          </a>

        )}
      </>
    );
  };

  return (
    <Card 
      className={`shadow p-3 mb-5 bg-body-tertiary ${isGrouped ? 'ms-4 border-start border-3 border-secondary-color-rgb' : ''}`}
      style={{
        backgroundColor: isGrouped ? '#f8f9fa' : 'inherit',
        borderLeft: isGrouped ? '3px solid #0d6efd' : 'inherit'
      }}
    >
      <CardBody>
      {isGrouped && (
          <div className="position-absolute top-0 start-0 translate-middle" >
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
              <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a2 2 0 0 1 .342-1.31zm6.339-1.577A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707z"/>
            </svg>
          </div>
        )}
        <CardTitle tag="h2" style={titleStyle} className="h5 mb-3">
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
};

export default RecordCard;
