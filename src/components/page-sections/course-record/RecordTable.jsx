import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Table, Popover, PopoverBody } from 'reactstrap';
// Import your tracking service
import { trackingService } from '../../../services/trackingService';

const RecordTable = ({
  combinedResults,
  availability,
  customization,
  hasElectronicReserves,

  // NEW PROPS
  courseInfo,
  collegeParam,
}) => {
  const [activePopover, setActivePopover] = useState(null);

  const togglePopover = (itemId) => {
    setActivePopover(activePopover === itemId ? null : itemId);
  };

  const getDiscoverLink = (instanceId) => {
    if (!instanceId || !customization.recordsDiscoverLinkBaseUrl) return null;
    return `${customization.recordsDiscoverLinkBaseUrl}${instanceId.replace(/-/g, '.')}`;
  };

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

  // Extract course details for tracking
  const {
    name: courseName,
    courseNumber,
    courseListingId,
    courseListingObject
  } = courseInfo || {};

  const termName = courseListingObject?.termObject?.name || 'N/A';
  const instructors = courseListingObject?.instructorObjects?.map(i => i.name) || [];

  // Helper to track link clicks before opening them
  const handleExternalLinkClick = (e, eventType, url, recordItem, extraMetadata = {}) => {
    e.preventDefault();
    const { copiedItem } = recordItem || {};
    const { title: recordTitle, instanceId } = copiedItem || {};

    const trackingPayload = {
      college: collegeParam || 'Unknown',
      event_type: eventType, // e.g. "record_discover_link" or "resource_click"
      course_id: courseListingId || 'N/A',
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

    trackingService.trackEvent(trackingPayload).finally(() => {
      // Open the link in a new tab after tracking completes or fails
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  };

  // Render a table row for an individual record
  const renderRecordRow = (item) => {
    const instanceId = item.copiedItem?.instanceId;
    const holdings = availability[instanceId]?.holdings || [];
    const reserveCount = holdings.filter(h => h.location?.includes('Reserve')).length;
    const popoverId = `holdings-${item.id}`;

    // 1) Build the discover URL for print items
    const discoverUrl = !item.isElectronic ? getDiscoverLink(instanceId) : null;

    // 2) Build the resource URL for electronic records
    const resourceUrl = item.copiedItem?.uri || item.copiedItem?.url || null;

    return (
      <tr key={item.id}>
        {/* Folder name column if hasElectronicReserves */}
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
          {/* Show popover only for print items */}
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
        
        {/* Discover link column */}
        <td>
          {!item.isElectronic && discoverUrl ? (
            <button
              onClick={(e) =>
                handleExternalLinkClick(e, 'record_discover_link', discoverUrl, item)
              }
              className="btn btn-link p-0"
              style={{ textDecoration: 'underline' }}
            >
              {customization.recordsDiscoverLinkText}
            </button>
          ) : 'N/A'}
        </td>

        {/* Resource link column */}
        <td>
          {resourceUrl ? (
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
              Access Resource
            </button>
          ) : 'N/A'}
        </td>
      </tr>
    );
  };

  // Determine the total number of columns.
  const totalColumns = (hasElectronicReserves ? 1 : 0) + 7 + 2; // 7 fixed columns + Discover and Resource

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
        {combinedResults.map((result) => {
          if (result.folder) {
            // For group entries, render a header row and then each record row.
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
            // Render an individual record row.
            return renderRecordRow(result);
          }
        })}
      </tbody>
    </Table>
  );
};

RecordTable.propTypes = {
  combinedResults: PropTypes.arrayOf(
    PropTypes.oneOfType([
      // Group object
      PropTypes.shape({
        folder: PropTypes.string.isRequired,
        items: PropTypes.array.isRequired,
      }),
      // Individual record item
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
        }).isRequired,
        isElectronic: PropTypes.bool,
        resource: PropTypes.object,
        folder_name: PropTypes.string,
      }),
    ])
  ).isRequired,
  availability: PropTypes.object.isRequired,
  hasElectronicReserves: PropTypes.bool,
  customization: PropTypes.shape({
    recordsDiscoverLinkBaseUrl: PropTypes.string,
    recordsDiscoverLinkText: PropTypes.string,
  }).isRequired,

  // NEW
  courseInfo: PropTypes.object,    // e.g. { name, courseNumber, courseListingObject, ... }
  collegeParam: PropTypes.string,  // e.g. "smith", etc.
};

export default RecordTable;
