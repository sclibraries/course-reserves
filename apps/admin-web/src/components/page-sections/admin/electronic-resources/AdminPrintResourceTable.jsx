/**
 * @file AdminPrintResourceTable component - Simplified view-only version
 * @description Displays a table of print resources associated with a course.
 * This is now a view-only component that inherits sort order from the unified table.
 */

import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Table, Button, Alert } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { buildFolioVerificationUrl } from '../../../../util/urlHelpers';

/**
 * Print resource shape definition for PropTypes
 */
const printResourceShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  copiedItem: PropTypes.shape({
    title: PropTypes.string,
    instanceId: PropTypes.string,
    barcode: PropTypes.string,
    callNumber: PropTypes.string,
    copy: PropTypes.string
  }).isRequired,
  order: PropTypes.number
});

/**
 * Static print resource row component
 */
const StaticPrintResourceRow = ({ resource }) => {
  const [verificationStatus, setVerificationStatus] = useState('');

  const handleVerification = useCallback(async () => {
    setVerificationStatus('Checking...');
    try {
      const response = await fetch(buildFolioVerificationUrl(resource.copiedItem.instanceId));
      
      if (response.ok) {
        setVerificationStatus('✓ Found in FOLIO');
      } else {
        setVerificationStatus('⚠ Not found in FOLIO');
      }
    } catch (error) {
      console.error('Error verifying resource in FOLIO:', error);
      setVerificationStatus('⚠ Verification failed');
    }
    
    setTimeout(() => setVerificationStatus(''), 3000);
  }, [resource.copiedItem.instanceId]);

  return (
    <tr>
      <td className="text-break">
        <strong>{resource.copiedItem?.title || 'No title'}</strong>
      </td>
      <td>{resource.copiedItem?.callNumber || '—'}</td>
      <td>{resource.copiedItem?.barcode || '—'}</td>
      <td>{resource.copiedItem?.copy || '—'}</td>
      <td>
        <div className="d-flex gap-2 align-items-center">
          <Button
            color="info"
            size="sm"
            onClick={handleVerification}
            disabled={verificationStatus === 'Checking...'}
          >
            <FontAwesomeIcon icon="fa-solid fa-search" className="me-1" />
            {verificationStatus === 'Checking...' ? 'Checking...' : 'Verify in FOLIO'}
          </Button>
          {verificationStatus && verificationStatus !== 'Checking...' && (
            <small className={`text-${verificationStatus.includes('✓') ? 'success' : 'warning'}`}>
              {verificationStatus}
            </small>
          )}
        </div>
      </td>
    </tr>
  );
};

StaticPrintResourceRow.propTypes = {
  resource: printResourceShape.isRequired
};

/**
 * Administrative print resource table component - View only, inherits sort from unified table
 */
const AdminPrintResourceTable = ({ 
  printResources
}) => {
  const [sortedResources, setSortedResources] = useState([]);

  // Initialize sorted resources with order (inherits from unified table)
  useEffect(() => {
    if (!printResources || printResources.length === 0) {
      setSortedResources([]);
      return;
    }

    const resourcesWithOrder = printResources.map((resource, index) => ({
      ...resource,
      order: resource.order || index + 1,
    }));

    // Sort by order (inherits from unified table)
    resourcesWithOrder.sort((a, b) => a.order - b.order);
    setSortedResources(resourcesWithOrder);
  }, [printResources]);

  if (!sortedResources.length) {
    return (
      <Alert color="info">No print resources available.</Alert>
    );
  }

  return (
    <div className="admin-print-resource-table">
      <div className="mb-3">
        <small className="text-muted">
          <FontAwesomeIcon icon="fa-solid fa-info-circle" className="me-1" />
          Resource order is controlled by the unified table view. Switch to &ldquo;Unified Table&rdquo; to modify sorting.
        </small>
      </div>
      
      <Table bordered responsive hover>
        <thead>
          <tr>
            <th style={{ width: '40%', minWidth: '200px' }}>Title</th>
            <th style={{ width: '25%', minWidth: '120px' }}>Call Number</th>
            <th style={{ width: '20%', minWidth: '100px' }}>Barcode</th>
            <th style={{ width: '10%', minWidth: '60px' }}>Copy</th>
            <th style={{ width: '5%', minWidth: '60px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedResources.map((resource) => (
            <StaticPrintResourceRow
              key={resource.id}
              resource={resource}
            />
          ))}
        </tbody>
      </Table>
    </div>
  );
};

AdminPrintResourceTable.propTypes = {
  printResources: PropTypes.arrayOf(printResourceShape)
};

export default AdminPrintResourceTable;
