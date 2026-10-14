import PropTypes from 'prop-types';
import {
  Accordion,
  AccordionBody,
  AccordionHeader,
  AccordionItem,
  Badge,
  Button,
  Table,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { getHoldingUrl, sortHoldings } from '../recordDisplayUtils';

const RecordCardHoldings = ({
  isElectronic,
  instanceId,
  holdings,
  allHoldings,
  openAccordions,
  toggleAccordion,
  accordionHeaderStyle,
  copiedItem,
  title,
  recordsDiscoverLinkBgColor,
  handleExternalLinkClick,
}) => {
  if (isElectronic || !instanceId) return null;

  const reserves = holdings;
  const otherHoldings = allHoldings.filter((holding) => (
    !(reserves || []).some((reserve) => (
      reserve.barcode && holding.barcode && reserve.barcode === holding.barcode
    ))
  ));

  const renderHoldingItems = (items, loanType) => {
    const sortedHoldings = sortHoldings(items);
    const showLocation = sortedHoldings.some((holding) => holding.location);
    const showLibrary = sortedHoldings.some((holding) => holding.library && holding.library.name);
    const showStatus = sortedHoldings.some((holding) => holding.status);
    const showLoanType = sortedHoldings.some((holding) => holding[`${loanType}LoanType`]);
    const showCallNumber = sortedHoldings.some((holding) => holding.callNumber);
    const showBarcode = sortedHoldings.some((holding) => holding.barcode);
    const showVolume = sortedHoldings.some((holding) => holding.volume);
    const showCopyNumber = sortedHoldings.some((holding) => holding.itemCopyNumber);
    const showAccess = sortedHoldings.some((holding) => getHoldingUrl(holding, copiedItem));

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
              {showCopyNumber && <th scope="col">Item Copy Number</th>}
              {showAccess && <th scope="col">Access</th>}
            </tr>
          </thead>
          <tbody>
            {sortedHoldings.map((holding) => {
              const resourceUrl = getHoldingUrl(holding, copiedItem);
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
                  {showCopyNumber && <td>{holding.itemCopyNumber || ''}</td>}
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
                          onClick={(event) => handleExternalLinkClick(event, 'resource_click', resourceUrl, {
                            location: holding.location,
                            library: holding.library?.name,
                            holdingId: holding.id,
                            isReserve: holding.location?.includes('Reserve') || false,
                          })}
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
              {reserves.length === 1 ? '1 Copy on Reserve' : `${reserves.length} Copies on Reserve`}
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

RecordCardHoldings.propTypes = {
  isElectronic: PropTypes.bool.isRequired,
  instanceId: PropTypes.string,
  holdings: PropTypes.array.isRequired,
  allHoldings: PropTypes.array.isRequired,
  openAccordions: PropTypes.object.isRequired,
  toggleAccordion: PropTypes.func.isRequired,
  accordionHeaderStyle: PropTypes.object.isRequired,
  copiedItem: PropTypes.object.isRequired,
  title: PropTypes.string,
  recordsDiscoverLinkBgColor: PropTypes.string.isRequired,
  handleExternalLinkClick: PropTypes.func.isRequired,
};

export default RecordCardHoldings;
