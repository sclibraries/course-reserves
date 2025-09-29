import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Table, Popover, PopoverBody, Button, Collapse, Alert, Row, Col } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faExternalLinkAlt, 
  faChevronDown, 
  faChevronUp, 
  faInfoCircle,
  faClock,
  faExclamationCircle
} from '@fortawesome/free-solid-svg-icons';
// Import tracking service
import { trackingService } from '../../../services/trackingService';
// Import Auth Context
import { useAuth } from '../../../contexts/AuthContext';
import { sanitizeHtml, containsHtml } from '../../../util/htmlUtils';
import { isPrimaryLinkVisible, isLinkVisible, getVisibilityInfo } from '../../../util/resourceVisibility';
import { useRecordsTextStore, selectRecordTableText, selectVisibilityText, selectAccessibilityText, selectCourseRecordsText, selectSplitViewText } from '../../../stores/recordsTextStore';

/**
 * RecordTable component
 * 
 * @component
 * @description Displays course records in a tabular format with expandable sections
 * for item details, availability information, and resource links.
 * 
 * @param {Object} props - Component props
 * @param {Array} props.combinedResults - Array of record items or record groups
 * @param {Object} props.availability - Mapping of instance IDs to availability data
 * @param {Object} props.customization - UI customization settings
 * @param {boolean} props.hasElectronicReserves - Whether electronic reserves are enabled
 * @param {Object} props.courseInfo - Information about the current course
 * @param {string} props.collegeParam - College identifier for tracking
 * @param {boolean} props.showVisibilityMessages - Whether to show visibility messages
 * @param {string} props.viewMode - View mode for the table ('combined' or 'split')
 * @param {Array} props.records - Array of individual record items
 * @returns {JSX.Element} A table of course records with interactive elements
 */
const RecordTable = ({
  combinedResults,
  availability,
  customization,
  hasElectronicReserves,
  courseInfo,
  collegeParam,
  showVisibilityMessages = true,
  viewMode = 'combined',
  records = []
}) => {
  const [activePopover, setActivePopover] = useState(null);
  const [expandedLinkItems, setExpandedLinkItems] = useState({});
  const [showHiddenItems] = useState(false);
  
  // Get authentication state from context
  const { isAuthenticated } = useAuth();

  // Get text from the store
  const recordTableText = useRecordsTextStore(selectRecordTableText);
  const visibilityText = useRecordsTextStore(selectVisibilityText);
  const accessibilityText = useRecordsTextStore(selectAccessibilityText);
  const courseRecordsText = useRecordsTextStore(selectCourseRecordsText);
  const splitViewText = useRecordsTextStore(selectSplitViewText);

  // Calculate total columns for table layout - define before use
  const totalColumns = (hasElectronicReserves ? 1 : 0) + 7 + 2; // Base columns + conditional folder column

  /**
   * Toggle the active popover
   * 
   * @function
   * @param {string|number} itemId - The ID of the item to toggle popover for
   */
  const togglePopover = (itemId) => {
    setActivePopover(activePopover === itemId ? null : itemId);
  };

  /**
   * Toggle expanded state for item links
   * 
   * @function
   * @param {string|number} itemId - The ID of the item to toggle links for
   */
  const toggleLinksExpand = (itemId) => {
    setExpandedLinkItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  /**
   * Check visibility window for electronic resources
   * @param {Object} item - Record item to check
   * @returns {Object} Object containing visibility status and message
   */
  const checkVisibility = useCallback((item) => {
    if (item.isElectronic && item.resource) {
      // Authenticated users can see all resources regardless of visibility window
      if (isAuthenticated) {
        return { isVisible: true };
      }

      const now = new Date();
      const startVisibility = item.resource.start_visibility
        ? new Date(item.resource.start_visibility)
        : null;
      const endVisibility = item.resource.end_visibility
        ? new Date(item.resource.end_visibility)
        : null;
        
      // If current time is before the start of the visibility window
      if (startVisibility && now < startVisibility) {
        return { 
          isVisible: false,
          message: `Available from ${startVisibility.toLocaleDateString()}`,
          startDate: startVisibility
        };
      }
      
      // If current time is after the end of the visibility window
      if (endVisibility && now > endVisibility) {
        return {
          isVisible: false,
          message: `Available until ${endVisibility.toLocaleDateString()}`,
          endDate: endVisibility
        };
      }
    }
    return { isVisible: true };
  }, [isAuthenticated]);

  // Process visibility for all items
  const processedResults = useMemo(() => {
    let hiddenCount = 0;
    let visibleCount = 0;
    let scheduleInfo = [];
    
    const processedItems = combinedResults.map(result => {
      if (result.folder) {
        // For grouped items
        const processedGroupItems = result.items.map(item => {
          const visibility = checkVisibility(item);
          if (!visibility.isVisible) {
            hiddenCount++;
            // Gather information about scheduled items
            if (item.resource?.start_visibility) {
              scheduleInfo.push({
                title: item.copiedItem?.title,
                date: new Date(item.resource.start_visibility),
                type: 'upcoming'
              });
            } else if (item.resource?.end_visibility) {
              scheduleInfo.push({
                title: item.copiedItem?.title,
                date: new Date(item.resource.end_visibility),
                type: 'past'
              });
            }
          } else {
            visibleCount++;
          }
          return { ...item, visibility };
        });
        
        // Only include visible items in the processed group
        const visibleItems = processedGroupItems.filter(item => 
          item.visibility.isVisible || isAuthenticated
        );
        
        return {
          ...result,
          items: visibleItems,
          hasHiddenItems: processedGroupItems.some(item => !item.visibility.isVisible)
        };
      } else {
        // For individual items
        const visibility = checkVisibility(result);
        if (!visibility.isVisible) {
          hiddenCount++;
          // Gather information about scheduled items
          if (result.resource?.start_visibility) {
            scheduleInfo.push({
              title: result.copiedItem?.title,
              date: new Date(result.resource.start_visibility),
              type: 'upcoming'
            });
          } else if (result.resource?.end_visibility) {
            scheduleInfo.push({
              title: result.copiedItem?.title,
              date: new Date(result.resource.end_visibility),
              type: 'past'
            });
          }
        } else {
          visibleCount++;
        }
        return { ...result, visibility };
      }
    });
    
    // Filter out items that aren't visible (unless user is authenticated)
    const filteredItems = processedItems.filter(item => {
      if ('items' in item) {
        // Group items
        return item.items.length > 0; // Only keep groups with visible items
      }
      // Individual items
      return item.visibility.isVisible || isAuthenticated;
    });
    
    // Sort upcoming items by date
    const upcomingItems = scheduleInfo
      .filter(item => item.type === 'upcoming')
      .sort((a, b) => a.date - b.date);
    
    return { 
      items: filteredItems, 
      hiddenCount,
      visibleCount,
      totalCount: hiddenCount + visibleCount,
      upcomingItems,
      nextAvailableDate: upcomingItems.length > 0 ? upcomingItems[0].date : null
    };
  }, [combinedResults, isAuthenticated, checkVisibility]);
  
  const { 
    items: processedItems, 
    hiddenCount, 
    visibleCount, 
    totalCount,
    nextAvailableDate 
  } = processedResults;

  /**
   * Generate discover link URL from instance ID
   * 
   * @function
   * @param {string} instanceId - The instance ID to generate link for
   * @returns {string|null} The discover link URL or null if inputs are invalid
   */
  const getDiscoverLink = (instanceId) => {
    if (!instanceId || !customization?.recordsDiscoverLinkBaseUrl) return null;
    return `${customization.recordsDiscoverLinkBaseUrl}${instanceId.replace(/-/g, '.')}`;
  };

  /**
   * Format publication information into readable string
   * 
   * @function
   * @param {Array} publication - Publication information array
   * @returns {string} Formatted publication string
   */
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

  // Extract course information with fallbacks for missing data
  const {
    name: courseName = 'N/A',
    courseNumber = 'N/A',
    courseListingId = 'N/A',
    courseListingObject = {}
  } = courseInfo || {};

  const termName = courseListingObject?.termObject?.name ?? 'N/A';
  const instructors = courseListingObject?.instructorObjects?.map(i => i.name) || [];

  /**
   * Handle external link click with tracking
   * 
   * @async
   * @function
   * @param {Event} e - Click event
   * @param {string} eventType - Type of event for tracking
   * @param {string} url - URL to open
   * @param {Object} recordItem - Record item being accessed
   * @param {Object} extraMetadata - Additional metadata for tracking
   */
  const handleExternalLinkClick = (e, eventType, url, recordItem, extraMetadata = {}) => {
    if (!url) {
      console.warn('Attempted to open external link with empty URL');
      return;
    }
    
    e.preventDefault();
    
    const { copiedItem } = recordItem || {};
    const { title: recordTitle, instanceId } = copiedItem || {};

    const trackingPayload = {
      college: collegeParam || 'Unknown',
      event_type: eventType,
      course_id: courseListingId,
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

    try {
      trackingService.trackEvent(trackingPayload).finally(() => {
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    } catch (error) {
      console.error('Failed to track event:', error);
      // Still open the URL even if tracking fails
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  /**
   * Render an individual record row with its data
   * 
   * @function
   * @param {Object} item - Record item data
   * @returns {JSX.Element} Table row(s) for the record
   */
  const renderRecordRow = (item) => {
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

    const discoverUrl = !item.isElectronic ? getDiscoverLink(instanceId) : null;

    // Check primary link visibility for electronic resources
    const isPrimaryLinkVisibleCheck = item.isElectronic && item.resource 
      ? isPrimaryLinkVisible(item.resource, isAuthenticated) 
      : true;

    const resourceUrl = item.isElectronic && item.resource && isPrimaryLinkVisibleCheck
      ? item.resource.item_url 
      : (!item.isElectronic ? (item.copiedItem?.uri || item.copiedItem?.url) : null);

    const hasAdditionalLinks = item.isElectronic && 
                              item.resource && 
                              Array.isArray(item.resource.links) && 
                              item.resource.links.length > 0;
    
    const isExpanded = expandedLinkItems[item.id] || false;

    // Get visibility information for electronic resources
    const visibilityInfo = item.isElectronic && item.resource 
      ? getVisibilityInfo(item.resource, isAuthenticated) 
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
                      <div><strong>From:</strong> {new Date(visibilityInfo.startDate).toLocaleDateString()}</div>
                    )}
                    {visibilityInfo.endDate && (
                      <div><strong>Until:</strong> {new Date(visibilityInfo.endDate).toLocaleDateString()}</div>
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
                    <Button 
                      color="link" 
                      size="sm" 
                      className="p-0"
                      onClick={() => toggleLinksExpand(item.id)}
                      aria-expanded={isExpanded}
                      style={{ color: customization.buttonPrimaryColor }}
                    >
                      <span className="badge bg-secondary">
                        {item.resource.links.length} additional {item.resource.links.length === 1 ? 'link' : 'links'}
                      </span>
                      <FontAwesomeIcon 
                        icon={isExpanded ? faChevronUp : faChevronDown} 
                        className="ms-1" 
                      />
                    </Button>
                  </div>
                )}
              </div>
            ) : item.isElectronic && item.resource && item.resource.item_url && !isPrimaryLinkVisibleCheck ? (
              <div>
                <span className="text-warning small">
                  <FontAwesomeIcon icon={faExclamationCircle} className="me-1" />
                  {visibilityText.notCurrentlyAvailable}
                </span>
                {hasAdditionalLinks && (
                  <div className="mt-2">
                    <Button 
                      color="link" 
                      size="sm" 
                      className="p-0"
                      onClick={() => toggleLinksExpand(item.id)}
                      aria-expanded={isExpanded}
                      style={{ color: customization.buttonPrimaryColor }}
                    >
                      <span className="badge bg-secondary">
                        {item.resource.links.length} additional {item.resource.links.length === 1 ? 'link' : 'links'}
                      </span>
                      <FontAwesomeIcon 
                        icon={isExpanded ? faChevronUp : faChevronDown} 
                        className="ms-1" 
                      />
                    </Button>
                  </div>
                )}
              </div>
            ) : hasAdditionalLinks ? (
              <Button 
                color="link" 
                size="sm" 
                className="p-0"
                onClick={() => toggleLinksExpand(item.id)}
                aria-expanded={isExpanded}
                style={{ color: customization.buttonPrimaryColor }}
              >
                <span className="badge bg-secondary">
                  {item.resource.links.length} {item.resource.links.length === 1 ? 'link' : 'links'} available
                </span>
                <FontAwesomeIcon 
                  icon={isExpanded ? faChevronUp : faChevronDown} 
                  className="ms-1" 
                />
              </Button>
            ) : 'N/A'}
          </td>
        </tr>

        {/* Additional links row (collapsible) */}
        {hasAdditionalLinks && (
          <tr className="bg-light">
            <td colSpan={totalColumns} className="p-0">
              <Collapse isOpen={isExpanded}>
                <div className="p-3">
                  <h6 className="mb-2">{recordTableText.additionalLinks}</h6>
                  <ul className="list-group">
                    {item.resource.links.map((link, idx) => {
                      const isCurrentLinkVisible = isLinkVisible(link, isAuthenticated);
                      
                      return (
                        <li key={link.link_id || idx} className="list-group-item">
                          <div className="d-flex justify-content-between align-items-top">
                            <div>
                              <strong>{link.title || `Link ${idx + 1}`}</strong>
                              {!isCurrentLinkVisible && (
                                <span className="badge bg-warning text-dark ms-2">{visibilityText.notCurrentlyAvailableBadge}</span>
                              )}
                              <div>
                                {isCurrentLinkVisible ? (
                                  <a 
                                    href={link.url}
                                    onClick={(e) => handleExternalLinkClick(
                                      e, 
                                      'resource_link_click', 
                                      link.url, 
                                      item, 
                                      {
                                        linkId: link.link_id,
                                        linkTitle: link.title
                                      }
                                    )}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    style={{ color: customization.buttonPrimaryColor }}
                                  >
                                    {link.url}
                                    <FontAwesomeIcon icon={faExternalLinkAlt} className="ms-1" />
                                  </a>
                                ) : (
                                  <span className="text-muted fst-italic">
                                    {visibilityText.linkNotAvailable}
                                  </span>
                                )}
                              </div>
                              {link.description && (
                                <div className="text-muted small mt-1">
                                  {containsHtml(link.description) ? (
                                    <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(link.description) }} />
                                  ) : (
                                    link.description
                                  )}
                                </div>
                              )}
                              {/* Show link visibility dates for authenticated users */}
                              {isAuthenticated && link.use_link_visibility && (link.start_visibility || link.end_visibility) && (
                                <div className="small text-muted mt-1">
                                  <strong>Link Visibility:</strong>{' '}
                                  {link.start_visibility ? `From ${new Date(link.start_visibility).toLocaleDateString()}` : 'No start date'}{' '}
                                  {link.end_visibility ? `until ${new Date(link.end_visibility).toLocaleDateString()}` : 'No end date'}
                                </div>
                              )}
                            </div>
                            {link.use_proxy === "1" && (
                              <span className="badge bg-light text-dark">Proxy Enabled</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </Collapse>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  /**
   * Render the table in split view mode
   */
  const renderSplitView = () => {
    const printRecords = records.filter(item => !item.isElectronic);
    const electronicRecords = records.filter(item => item.isElectronic);
    
    return (
      <Row>
        {/* Print resources column */}
        <Col md={6}>
          <div className="column-header mb-3 p-3 bg-light border rounded">
            <h3 className="h4 mb-0" style={{ color: customization.cardTextColor }}>
              <i className="fas fa-book text-muted me-2"></i>
              {splitViewText.printMaterials}
            </h3>
          </div>
          
          {printRecords.length === 0 ? (
            <p className="text-muted">{splitViewText.noPrintMaterials}</p>
          ) : (
            <Table bordered responsive className="align-middle">
              <thead className="table-light">
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Authors</th>
                  <th scope="col">Publication</th>
                  <th scope="col">Holdings</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {printRecords
                  .sort((a, b) => a.copiedItem.title.localeCompare(b.copiedItem.title))
                  .map(item => {
                    const instanceId = item.copiedItem?.instanceId;
                    const holdings = availability[instanceId]?.holdings || [];
                    const discoverUrl = getDiscoverLink(instanceId);
                    
                    return (
                      <tr key={item.id}>
                        <td>{item.copiedItem.title}</td>
                        <td>{item.copiedItem.contributors?.map(c => c.name).join(', ') || 'N/A'}</td>
                        <td>{formatPublication(item.copiedItem.publication)}</td>
                        <td>{holdings.length > 0 ? `${holdings.length} items` : 'N/A'}</td>
                        <td>
                          {discoverUrl ? (
                            <button
                              onClick={(e) =>
                                handleExternalLinkClick(e, 'record_discover_link', discoverUrl, item)
                              }
                              className="btn btn-sm btn-outline-secondary"
                            >
                              View in Catalog <FontAwesomeIcon icon={faExternalLinkAlt} />
                            </button>
                          ) : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </Table>
          )}
        </Col>
        
        {/* Electronic resources column */}
        <Col md={6}>
          <div className="column-header mb-3 p-3 bg-light border rounded">
            <h3 className="h4 mb-0" style={{ color: customization.cardTextColor }}>
              <i className="fas fa-laptop text-muted me-2"></i>
              {splitViewText.electronicMaterials}
            </h3>
          </div>
          
          {electronicRecords.length === 0 ? (
            <p className="text-muted">{splitViewText.noElectronicMaterials}</p>
          ) : (
            <Table bordered responsive className="align-middle">
              <thead className="table-light">
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Description</th>
                  <th scope="col">Access</th>
                </tr>
              </thead>
              <tbody>
                {electronicRecords
                  .sort((a, b) => a.copiedItem.title.localeCompare(b.copiedItem.title))
                  .map(item => {
                    const isPrimaryLinkVisibleCheck = isPrimaryLinkVisible(item.resource, isAuthenticated);
                    const resourceUrl = item.resource?.item_url && isPrimaryLinkVisibleCheck ? item.resource.item_url : null;
                    const hasAdditionalLinks = item.resource?.links?.length > 0;
                    const isExpanded = expandedLinkItems[item.id] || false;
                    
                    return (
                      <React.Fragment key={item.id}>
                        <tr>
                          <td>{item.copiedItem.title}</td>
                          <td>
                            {item.resource?.description ? (
                              <div className="small">
                                {containsHtml(item.resource.description) ? (
                                  <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.resource.description) }} />
                                ) : (
                                  item.resource.description
                                )}
                              </div>
                            ) : 'N/A'}
                          </td>
                          <td>
                            {resourceUrl ? (
                              <div>
                                <button
                                  onClick={(e) =>
                                    handleExternalLinkClick(e, 'resource_click', resourceUrl, item, {
                                      isElectronic: true,
                                    })
                                  }
                                  className="btn btn-sm btn-outline-secondary"
                                  aria-label={accessibilityText.accessResourceGeneric}
                                >
                                  {recordTableText.access} <FontAwesomeIcon icon={faExternalLinkAlt} />
                                </button>
                                
                                {hasAdditionalLinks && (
                                  <Button 
                                    color="link" 
                                    size="sm" 
                                    className="ms-2"
                                    onClick={() => toggleLinksExpand(item.id)}
                                    aria-expanded={isExpanded}
                                    style={{ color: customization.buttonPrimaryColor }}
                                  >
                                    {item.resource.links.length} more
                                    <FontAwesomeIcon 
                                      icon={isExpanded ? faChevronUp : faChevronDown} 
                                      className="ms-1" 
                                    />
                                  </Button>
                                )}
                              </div>
                            ) : item.resource?.item_url && !isPrimaryLinkVisibleCheck ? (
                              <div>
                                <span className="text-warning small">
                                  <FontAwesomeIcon icon={faExclamationCircle} className="me-1" />
                                  {visibilityText.notCurrentlyAvailable}
                                </span>
                                {hasAdditionalLinks && (
                                  <Button 
                                    color="link" 
                                    size="sm" 
                                    className="ms-2"
                                    onClick={() => toggleLinksExpand(item.id)}
                                    aria-expanded={isExpanded}
                                    style={{ color: customization.buttonPrimaryColor }}
                                  >
                                    {item.resource.links.length} more
                                    <FontAwesomeIcon 
                                      icon={isExpanded ? faChevronUp : faChevronDown} 
                                      className="ms-1" 
                                    />
                                  </Button>
                                )}
                              </div>
                            ) : hasAdditionalLinks ? (
                              <Button 
                                color="link" 
                                size="sm"
                                onClick={() => toggleLinksExpand(item.id)}
                                aria-expanded={isExpanded}
                                style={{ color: customization.buttonPrimaryColor }}
                              >
                                {item.resource.links.length} links
                                <FontAwesomeIcon 
                                  icon={isExpanded ? faChevronUp : faChevronDown} 
                                  className="ms-1" 
                                />
                              </Button>
                            ) : 'N/A'}
                          </td>
                        </tr>
                        
                        {/* Additional links row (collapsible) */}
                        {hasAdditionalLinks && (
                          <tr className={isExpanded ? '' : 'd-none'}>
                            <td colSpan={3} className="p-0">
                              <Collapse isOpen={isExpanded}>
                                <div className="p-3 bg-light">
                                  <ul className="list-group list-group-flush">
                                    {item.resource.links.map((link, idx) => (
                                      <li key={link.link_id || idx} className="list-group-item bg-transparent px-0">
                                        <div>
                                          <strong>{link.title || `Link ${idx + 1}`}</strong>
                                          <div>
                                            <a 
                                              href={link.url}
                                              onClick={(e) => handleExternalLinkClick(
                                                e, 
                                                'resource_link_click', 
                                                link.url, 
                                                item, 
                                                {
                                                  linkId: link.link_id,
                                                  linkTitle: link.title
                                                }
                                              )}
                                              target="_blank"
                                              rel="noreferrer noopener"
                                              style={{ color: customization.buttonPrimaryColor }}
                                            >
                                              {link.url}
                                              <FontAwesomeIcon icon={faExternalLinkAlt} className="ms-1" />
                                            </a>
                                          </div>
                                          {link.description && (
                                            <div className="text-muted small mt-1">
                                              {containsHtml(link.description) ? (
                                                <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(link.description) }} />
                                              ) : (
                                                link.description
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </Collapse>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </Table>
          )}
        </Col>
      </Row>
    );
  };

  // If there are no items at all, show a notice
  if (totalCount === 0) {
    return (
      <Alert color="info" className="d-flex align-items-center">
        <FontAwesomeIcon icon={faInfoCircle} className="me-3 fa-lg" />
        <div>
          <h4 className="alert-heading">{courseRecordsText.noCourseMaterialsFound}</h4>
          <p className="mb-0">{courseRecordsText.noMaterialsAdded}</p>
        </div>
      </Alert>
    );
  }

  // If all items are hidden, show a message about scheduled materials
  if (visibleCount === 0 && hiddenCount > 0) {
    return (
      <Alert color="warning" className="d-flex align-items-center">
        <FontAwesomeIcon icon={faExclamationCircle} className="me-3 fa-lg" />
        <div>
          <h4 className="alert-heading">{courseRecordsText.materialsNotCurrentlyAvailable}</h4>
          <p>
            {hiddenCount} {hiddenCount === 1 ? courseRecordsText.resourcesScheduled : courseRecordsText.resourcesScheduledPlural} {courseRecordsText.scheduledButNotAvailable} {hiddenCount === 1 ? courseRecordsText.isNotCurrentlyAvailable : courseRecordsText.areNotCurrentlyAvailable} {courseRecordsText.notCurrentlyAvailable}
          </p>
          {nextAvailableDate && (
            <p className="mb-0">
              <strong>{courseRecordsText.nextAvailableDate}</strong> {nextAvailableDate.toLocaleDateString()}
            </p>
          )}
        </div>
      </Alert>
    );
  }

  // For the main return, add split view support
  return viewMode === 'split' ? renderSplitView() : (
    <Table bordered responsive className="align-middle">
      <caption className="sr-only">
        List of available records, their types, holdings, and access links
      </caption>
      <thead className="table-light">
        <tr>
          {hasElectronicReserves && <th scope="col">{recordTableText.headers.folder}</th>}
          <th scope="col">{recordTableText.headers.title}</th>
          <th scope="col">{recordTableText.headers.authors}</th>
          <th scope="col">{recordTableText.headers.type}</th>
          <th scope="col">{recordTableText.headers.publication}</th>
          <th scope="col">{recordTableText.headers.holdings}</th>
          <th scope="col">{recordTableText.headers.discover}</th>
          <th scope="col">{recordTableText.headers.resource}</th>
        </tr>
      </thead>
      <tbody>
        {processedItems.length > 0 ? (
          processedItems.map((result) => {
            if (result.folder) {
              return (
                <React.Fragment key={`group-${result.folder}`}>
                  <tr className="table-group-divider">
                    <td colSpan={totalColumns} className="bg-light text-dark p-2 fw-bold">
                      {result.folder}
                    </td>
                  </tr>
                  {result.items.map(item => renderRecordRow(item))}
                </React.Fragment>
              );
            } else {
              return renderRecordRow(result);
            }
          })
        ) : (
          <tr>
            <td colSpan={totalColumns} className="text-center p-3">
              No records found
            </td>
          </tr>
        )}
      </tbody>
    </Table>
  );
};

RecordTable.propTypes = {
  /**
   * Combined results data containing either individual items or grouped items with folder
   */
  combinedResults: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.shape({
        folder: PropTypes.string.isRequired,
        items: PropTypes.array.isRequired,
      }),
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
          uri: PropTypes.string,
          url: PropTypes.string,
        }).isRequired,
        isElectronic: PropTypes.bool,
        resource: PropTypes.shape({
          resource_id: PropTypes.string,
          name: PropTypes.string,
          item_url: PropTypes.string,
          description: PropTypes.string,
          external_note: PropTypes.string,
          internal_note: PropTypes.string,
          start_visibility: PropTypes.string,
          end_visibility: PropTypes.string,
          links: PropTypes.arrayOf(
            PropTypes.shape({
              link_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
              url: PropTypes.string,
              title: PropTypes.string,
              description: PropTypes.string,
              use_proxy: PropTypes.string
            })
          )
        }),
        folder_name: PropTypes.string,
      }),
    ])
  ).isRequired,
  /**
   * Availability data keyed by instance ID
   */
  availability: PropTypes.object.isRequired,
  /**
   * Whether electronic reserves feature is enabled
   */
  hasElectronicReserves: PropTypes.bool,
  /**
   * UI customization settings
   */
  customization: PropTypes.shape({
    recordsDiscoverLinkBaseUrl: PropTypes.string,
    recordsDiscoverLinkText: PropTypes.string,
    buttonPrimaryColor: PropTypes.string,
    buttonSecondaryColor: PropTypes.string,
    cardTextColor: PropTypes.string,
  }).isRequired,
  /**
   * Course information for tracking and display
   */
  courseInfo: PropTypes.object,
  /**
   * College parameter for tracking
   */
  collegeParam: PropTypes.string,
  /**
   * Whether to show visibility messages for unavailable items
   */
  showVisibilityMessages: PropTypes.bool,
  /**
   * View mode for the table ('combined' or 'split')
   */
  viewMode: PropTypes.oneOf(['combined', 'split']),
  /**
   * Array of individual record items
   */
  records: PropTypes.array,
};

RecordTable.defaultProps = {
  hasElectronicReserves: false,
  courseInfo: {},
  collegeParam: 'Unknown',
  showVisibilityMessages: true,
  viewMode: 'combined',
  records: []
};

export default RecordTable;
