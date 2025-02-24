// src/components/RecordTable.jsx
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Table, Popover, PopoverBody } from 'reactstrap';

const RecordTable = ({ groupedRecords, ungroupedRecords, availability, customization, hasElectronicReserves }) => {
  const [activePopover, setActivePopover] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'print', 'electronic'

  const togglePopover = (itemId) => {
    setActivePopover(activePopover === itemId ? null : itemId);
  };

  const getDiscoverLink = (instanceId) => {
    if (!instanceId || !customization.recordsDiscoverLinkBaseUrl) return null;
    return `${customization.recordsDiscoverLinkBaseUrl}${instanceId.replace(/-/g, '.')}`;
  };

  const formatPublication = (publication) => {
    if (!publication?.length) return 'N/A';

    return publication.map(pub => {
      const parts = [];
      if (pub.publisher) parts.push(pub.publisher);
      if (pub.place) parts.push(pub.place);
      if (pub.dateOfPublication) parts.push(pub.dateOfPublication);
      return parts.join('; ');
    }).join(' / ');
  };

  const renderHoldingsDetails = (holdings) => {
    if (!holdings?.length) return <div className="text-muted">No availability data</div>;

    return holdings.map(holding => (
      <div key={holding.id} className="mb-2 small">
        <div><strong>Location:</strong> {holding.location}</div>
        <div><strong>Library:</strong> {holding.library?.name || 'Unknown'}</div>
        <div><strong>Status:</strong> {holding.status}</div>
        <div><strong>Loan Type:</strong>
          {holding.temporaryLoanType || holding.permanentLoanType}
        </div>
      </div>
    ));
  };
    const filteredGroupedRecords = useMemo(() => {
        const filteredGroups = {};
    
        if (filter === 'all') {
          return groupedRecords;
        }
    
        const filterFunc = filter === 'print'
          ? item => !item.isElectronic
          : item => item.isElectronic;
    
        for (const groupName in groupedRecords) {
          const filteredItems = groupedRecords[groupName].filter(filterFunc);
          if (filteredItems.length > 0) {
            filteredGroups[groupName] = filteredItems;
          }
        }
        return filteredGroups;
      }, [groupedRecords, filter]);
    
      const filteredUngroupedRecords = useMemo(() => {
        if (filter === 'all') {
          return ungroupedRecords;
        }
    
        const filterFunc = filter === 'print'
          ? item => !item.isElectronic
          : item => item.isElectronic;
    
        return ungroupedRecords.filter(filterFunc);
    
      }, [ungroupedRecords, filter]);

  const renderItems = (items) => {
    return items.map(item => {
      const holdings = availability[item.copiedItem.instanceId]?.holdings || [];
      const reserveCount = holdings.filter(h =>
        h.location?.includes('Reserve')).length;
      const popoverId = `holdings-${item.id}`;

      return (
        <tr key={item.id}>
          {hasElectronicReserves && (
            <td>{item.folder_name || 'N/A'}</td> 
          )}
          <td>{item.copiedItem.title}</td>
          <td>
            {item.copiedItem.contributors?.map(c => c.name).join(', ') || 'N/A'}
          </td>
          <td>{item.isElectronic ? 'Electronic' : 'Print'}</td>
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
              {item.isElectronic ? 'Electronic' :
                `${holdings.length} items (${reserveCount} Reserve)`}
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
                  {renderHoldingsDetails(holdings)}
                </PopoverBody>
              </Popover>
            )}
          </td>
          <td>
            {item.isElectronic ? (
              item.resource?.item_url ? (
                <div className="d-flex flex-column">
                  <a
                    href={item.resource.item_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Access resource (opens in a new tab)"
                  >
                    Access Resource
                  </a>

                  {item.resource.external_note && (
                    <small className="text-muted">{item.resource.external_note}</small>
                  )}
                </div>
              ) : 'N/A'
            ) : (
              getDiscoverLink(item.copiedItem.instanceId) ? (
                <a
                  href={getDiscoverLink(item.copiedItem.instanceId)}
                  target="_blank"
                  rel="noopener"
                >
                  {customization.recordsDiscoverLinkText}
                </a>
              ) : 'N/A'
            )}
          </td>
        </tr>
      );
    });
  };



  return (
    <>
    <Table bordered responsive className="align-middle">
      <caption className="sr-only">List of available records, their types, holdings, and access links</caption>
        <thead className="table-light">
          <tr>
            {hasElectronicReserves && <th scope="col">Folder</th>}
            <th scope="col">Title</th>
            <th scope="col">Authors</th>
            <th scope="col">Type</th>
            <th scope="col">Call Number</th>
            <th scope="col">Publication</th>
            <th scope="col">Holdings</th>
            <th scope="col">Access</th>
          </tr>
        </thead>

        <tbody>
          {/* Grouped Records */}
          {Object.entries(filteredGroupedRecords).map(([groupName, groupItems]) => (
            <React.Fragment key={groupName}>
              <tr className="table-group-divider">
                <td colSpan={hasElectronicReserves ? 8 : 7} className="bg-dark text-white p-2">
                  {groupName}
                </td>
              </tr>
              {renderItems(groupItems, true)}
            </React.Fragment>
          ))}

          {/* Ungrouped Records */}
          {filteredUngroupedRecords.length > 0 && (
            <>
            {hasElectronicReserves && (
              <tr className="table-group-divider">
                <td colSpan={hasElectronicReserves ? 8 : 7} className="bg-secondary text-white p-2">
                  Ungrouped Items
                </td>
              </tr>
            )}
              {renderItems(filteredUngroupedRecords)}
            </>
          )}
        </tbody>
      </Table>
    </>
  );
};

RecordTable.propTypes = {
  groupedRecords: PropTypes.object.isRequired,
  ungroupedRecords: PropTypes.array.isRequired,
  availability: PropTypes.object.isRequired,
  hasElectronicReserves: PropTypes.bool,
  customization: PropTypes.shape({
    recordsDiscoverLinkBaseUrl: PropTypes.string,
    recordsDiscoverLinkText: PropTypes.string,
  }).isRequired,
};

export default RecordTable;