import { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  Button, 
  Collapse, 
  Badge, 
  Modal, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Table,
  Card,
  CardBody 
} from 'reactstrap';
import { formatMetadataByEventType, safeParseJSON } from '../utils/metadataUtils';
import { 
  formatMetadataForDisplay, 
  getMetadataSummary,
  extractUrlFromMetadata 
} from '../utils/metadataDisplayUtils';

/**
 * Component for displaying event metadata with collapse functionality
 */
const MetadataDisplay = ({ 
  metadata, 
  eventType, 
  event = null,
  showInline = false, 
  maxInlineLength = 50,
  enhanced = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Parse metadata if it's a string
  const parsedData = safeParseJSON(metadata);
  
  // Handle case when metadata is missing or invalid
  if (!parsedData) {
    return <span className="text-muted">No data</span>;
  }

  // Enhanced metadata formatting if available
  const enhancedMetadata = enhanced ? formatMetadataForDisplay(eventType, parsedData) : null;
  const summary = enhanced ? getMetadataSummary(eventType, parsedData) : formatMetadataByEventType(eventType, parsedData);
  const url = enhanced ? extractUrlFromMetadata(parsedData) : null;

  // For inline display in tables
  if (showInline) {
    const truncatedSummary = summary.length > maxInlineLength 
      ? `${summary.substring(0, maxInlineLength)}...` 
      : summary;

    return (
      <div>
        <span 
          className="text-primary" 
          style={{ cursor: 'pointer' }}
          onClick={() => setIsModalOpen(true)}
          title="Click to view details"
        >
          {truncatedSummary}
        </span>
        
        <Modal isOpen={isModalOpen} toggle={() => setIsModalOpen(false)} size="lg">
          <ModalHeader toggle={() => setIsModalOpen(false)}>
            Event Details - {eventType}
          </ModalHeader>
          <ModalBody>
            <EnhancedMetadataView 
              event={event}
              eventType={eventType}
              metadata={parsedData}
              enhancedMetadata={enhancedMetadata}
              url={url}
            />
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onClick={() => setIsModalOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    );
  }

  // Enhanced card display
  if (enhanced && event) {
    return (
      <Card className="mb-2">
        <CardBody className="p-3">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <Badge color="info" className="me-2">{enhancedMetadata?.type || eventType}</Badge>
              <small className="text-muted">
                {event.created_at && new Date(event.created_at).toLocaleDateString()} at{' '}
                {event.created_at && new Date(event.created_at).toLocaleTimeString()}
              </small>
            </div>
            <Button
              color="link"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="p-0"
            >
              {isOpen ? 'Less' : 'More'} Details
            </Button>
          </div>

          <h6 className="mb-2">{enhancedMetadata?.title || summary}</h6>
          
          {url && (
            <div className="mb-2">
              <small className="text-muted">Resource URL:</small>{' '}
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-break small"
              >
                {url.length > 80 ? `${url.substring(0, 80)}...` : url}
              </a>
            </div>
          )}

          <Collapse isOpen={isOpen}>
            <EnhancedMetadataView 
              event={event}
              eventType={eventType}
              metadata={parsedData}
              enhancedMetadata={enhancedMetadata}
              url={url}
              compact={true}
            />
          </Collapse>
        </CardBody>
      </Card>
    );
  }

  // Original display format for backward compatibility
  return (
    <div>
      <Button 
        color="link" 
        onClick={() => setIsOpen(!isOpen)} 
        className="p-0 text-decoration-none"
        size="sm"
      >
        {summary.label || summary}
        {summary.badge && (
          <Badge color={summary.badge.color} pill className="ms-1" size="sm">
            {summary.badge.text}
          </Badge>
        )}
      </Button>
      <Collapse isOpen={isOpen}>
        <div className="mt-2 p-2 border rounded bg-light">
          <pre className="mb-0" style={{fontSize: '0.75rem', maxHeight: '300px', overflow: 'auto'}}>
            {JSON.stringify(parsedData, null, 2)}
          </pre>
        </div>
      </Collapse>
    </div>
  );
};

/**
 * Enhanced metadata view component
 */
const EnhancedMetadataView = ({ 
  event, 
  eventType,
  metadata, 
  enhancedMetadata, 
  url, 
  compact = false 
}) => (
  <div>
    {!compact && (
      <div className="mb-3">
        <h5>{enhancedMetadata?.title}</h5>
        <div className="mb-2">
          <Badge color="primary" className="me-2">{eventType}</Badge>
          <Badge color="secondary">{enhancedMetadata?.type}</Badge>
        </div>
        {event?.created_at && (
          <small className="text-muted">
            Occurred on {new Date(event.created_at).toLocaleDateString()} at{' '}
            {new Date(event.created_at).toLocaleTimeString()}
          </small>
        )}
      </div>
    )}

    {url && (
      <div className="mb-3">
        <strong>Resource URL:</strong>
        <br />
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-break"
        >
          {url}
        </a>
      </div>
    )}

    {enhancedMetadata?.additionalInfo && 
     Object.keys(enhancedMetadata.additionalInfo).length > 0 && (
      <div className="mb-3">
        <strong>Additional Information:</strong>
        <Table size="sm" className="mt-2">
          <tbody>
            {Object.entries(enhancedMetadata.additionalInfo).map(([key, value]) => (
              value && (
                <tr key={key}>
                  <td className="fw-bold" style={{ width: '30%' }}>{key}:</td>
                  <td className="text-break">
                    {typeof value === 'string' && value.startsWith('http') ? (
                      <a href={value} target="_blank" rel="noopener noreferrer">
                        {value}
                      </a>
                    ) : (
                      String(value)
                    )}
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </Table>
      </div>
    )}

    <details className="mt-3">
      <summary className="text-muted small" style={{ cursor: 'pointer' }}>
        View Raw Metadata
      </summary>
      <pre className="bg-light p-2 mt-2 small text-wrap">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    </details>
  </div>
);

MetadataDisplay.propTypes = {
  /**
   * Event metadata - can be a JSON string or an object
   */
  metadata: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object
  ]),
  
  /**
   * Type of event - used to determine how to display the metadata
   */
  eventType: PropTypes.string,
  
  /**
   * Complete event object (for enhanced display)
   */
  event: PropTypes.object,
  
  /**
   * Show inline format for tables
   */
  showInline: PropTypes.bool,
  
  /**
   * Maximum length for inline display
   */
  maxInlineLength: PropTypes.number,
  
  /**
   * Use enhanced metadata formatting
   */
  enhanced: PropTypes.bool
};

EnhancedMetadataView.propTypes = {
  event: PropTypes.object,
  eventType: PropTypes.string.isRequired,
  metadata: PropTypes.object,
  enhancedMetadata: PropTypes.object,
  url: PropTypes.string,
  compact: PropTypes.bool
};

export default MetadataDisplay;