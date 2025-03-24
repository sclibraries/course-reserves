import { useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Collapse, Badge } from 'reactstrap';
import { formatMetadataByEventType, safeParseJSON } from '../utils/metadataUtils';

/**
 * Component for displaying event metadata with collapse functionality
 */
const MetadataDisplay = ({ metadata, eventType }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Parse metadata if it's a string
  const parsedData = safeParseJSON(metadata);
  
  // Handle case when metadata is missing or invalid
  if (!parsedData) {
    return <span className="text-muted">No data</span>;
  }
  
  // Get formatted summary based on event type
  const summary = formatMetadataByEventType(eventType, parsedData);

  // Render the component
  return (
    <div>
      <Button 
        color="link" 
        onClick={() => setIsOpen(!isOpen)} 
        className="p-0 text-decoration-none"
        size="sm"
      >
        {summary.label}
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
  eventType: PropTypes.string
};

export default MetadataDisplay;