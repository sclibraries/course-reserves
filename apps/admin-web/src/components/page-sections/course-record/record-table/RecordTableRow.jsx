import PropTypes from 'prop-types';
import React from 'react';
import { Popover, PopoverBody } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faClock, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import {
  formatVisibilityDate,
  getVisibleLinks,
  getVisibilityInfo,
  isPrimaryLinkVisible,
} from '../../../../util/resourceVisibility';
import { formatPublicationEntries, getDiscoverUrl } from '../recordDisplayUtils';
import LinksExpandButton from './LinksExpandButton';
import RecordTableAdditionalLinks from './RecordTableAdditionalLinks';

const formatPublication = (publication) => {
  if (!publication?.length) return 'N/A';
  return formatPublicationEntries(publication);
};

const RecordTableRow = ({ item, context }) => {
  const {
    accessibilityText,
    activePopover,
    availability,
    canBypassVisibility,
    customization,
    expandedLinkItems,
    handleExternalLinkClick,
    hasElectronicReserves,
    recordTableText,
    showVisibilityMessages,
    toggleLinksExpand,
    togglePopover,
    totalColumns,
  } = context;
  const showHiddenItems = false;

  if (!item || !item.copiedItem) {
    console.warn('Invalid record item data:', item);
    return null;
  }

  const { isVisible, message } = item.visibility || { isVisible: true };

  // Skip items that should be hidden based on visibility window when not showing all
  if (!isVisible && !showHiddenItems && !showVisibilityMessages) {
    return null;
  }

  const instanceId = item.copiedItem?.instanceId;
  const holdings = availability[instanceId]?.holdings || [];
  // Holdings are pre-filtered to barcodes on reserve for this course
  const reserveCount = holdings.length;
  const popoverId = `holdings-${item.id}`;

  const discoverUrl = !item.isElectronic
    ? getDiscoverUrl(customization?.recordsDiscoverLinkBaseUrl, instanceId)
    : null;

  // Check primary link visibility for electronic resources
  const isPrimaryLinkVisibleCheck = item.isElectronic && item.resource
    ? isPrimaryLinkVisible(item.resource, canBypassVisibility)
    : true;

  const resourceUrl = item.isElectronic && item.resource && isPrimaryLinkVisibleCheck
    ? item.resource.item_url
    : (!item.isElectronic ? (item.copiedItem?.uri || item.copiedItem?.url) : null);

  const visibleAdditionalLinks = item.isElectronic
    ? getVisibleLinks(item.resource?.links, canBypassVisibility)
    : [];
  const hasAdditionalLinks = visibleAdditionalLinks.length > 0;

  const isExpanded = expandedLinkItems[item.id] || false;

  // Get visibility information for electronic resources
  const visibilityInfo = item.isElectronic && item.resource
    ? getVisibilityInfo(item.resource, canBypassVisibility)
    : { showVisibilityDates: false };
  const showVisibilityDates = visibilityInfo.showVisibilityDates;

  return (
    <React.Fragment key={item.id}>
      <tr className={!isVisible ? 'table-warning' : ''}>
        {hasElectronicReserves && (
          <td>{item.folder_name || 'N/A'}</td>
        )}
        <td>
          {item.copiedItem.title}
          {!isVisible && (
            <div className="small text-warning mt-1">
              <FontAwesomeIcon icon={faClock} className="me-1" />
              {message}
            </div>
          )}
          {showVisibilityDates && (
            <span
              id={`visibility-${item.id}`}
              className="ms-2 text-muted"
            >
              <FontAwesomeIcon
                icon={faInfoCircle}
                className="cursor-pointer"
              />
            </span>
          )}
          {showVisibilityDates && (
            <Popover
              placement="auto"
              isOpen={activePopover === `visibility-${item.id}`}
              target={`visibility-${item.id}`}
              trigger="hover"
              toggle={() => togglePopover(`visibility-${item.id}`)}
            >
              <PopoverBody>
                <h6 className="mb-2">Visibility Window</h6>
                <div className="small">
                  {visibilityInfo.startDate && (
                    <div><strong>From:</strong> {formatVisibilityDate(visibilityInfo.startDate, 'start')}</div>
                  )}
                  {visibilityInfo.endDate && (
                    <div><strong>Until:</strong> {formatVisibilityDate(visibilityInfo.endDate, 'end')}</div>
                  )}
                </div>
              </PopoverBody>
            </Popover>
          )}
        </td>
        <td>{item.copiedItem.contributors?.map(c => c.name).join(', ') || 'N/A'}</td>
        <td>
          {holdings.length > 0 && holdings[0].materialType?.name
            ? holdings[0].materialType.name
            : (item.isElectronic ? 'Electronic' : 'Print')}
        </td>
        <td>{formatPublication(item.copiedItem.publication)}</td>
        <td>
          <span
            id={popoverId}
            style={{ color: customization.buttonPrimaryColor, cursor: 'pointer', textDecoration: 'underline' }}
            onMouseEnter={() => togglePopover(item.id)}
            onMouseLeave={() => togglePopover(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
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
                    <div><strong>Call Number:</strong> {holding.callNumber || 'N/A'}</div>
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
              style={{ textDecoration: 'underline', color: customization.buttonSecondaryColor }}
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
                style={{ textDecoration: 'underline', color: customization.buttonPrimaryColor }}
                aria-label={accessibilityText.accessResourceGeneric}
              >
                {recordTableText.accessResource} <FontAwesomeIcon icon={faExternalLinkAlt} />
              </button>

              {hasAdditionalLinks && (
                <div className="mt-2">
                  <LinksExpandButton
                    itemId={item.id}
                    isExpanded={isExpanded}
                    color={customization.buttonPrimaryColor}
                    label={`${visibleAdditionalLinks.length} additional ${visibleAdditionalLinks.length === 1 ? 'link' : 'links'}`}
                    onToggle={toggleLinksExpand}
                  />
                </div>
              )}
            </div>
          ) : hasAdditionalLinks ? (
            <LinksExpandButton
              itemId={item.id}
              isExpanded={isExpanded}
              color={customization.buttonPrimaryColor}
              label={`${visibleAdditionalLinks.length} ${visibleAdditionalLinks.length === 1 ? 'link' : 'links'} available`}
              onToggle={toggleLinksExpand}
            />
          ) : 'N/A'}
        </td>
      </tr>

      {hasAdditionalLinks && (
        <RecordTableAdditionalLinks
          links={visibleAdditionalLinks}
          item={item}
          isExpanded={isExpanded}
          totalColumns={totalColumns}
          recordTableText={recordTableText}
          canBypassVisibility={canBypassVisibility}
          customization={customization}
          handleExternalLinkClick={handleExternalLinkClick}
        />
      )}
    </React.Fragment>
  );
};

RecordTableRow.propTypes = {
  item: PropTypes.object,
  context: PropTypes.object.isRequired,
};

export default RecordTableRow;
