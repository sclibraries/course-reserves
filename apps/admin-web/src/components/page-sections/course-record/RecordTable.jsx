import React, { useState, useMemo, useCallback } from 'react';
import { Table, Alert } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
// Import tracking service
import { trackingService } from '../../../services/trackingService';
import { getItemVisibility, parseVisibilityDate } from '../../../util/resourceVisibility';
import { useRecordsTextStore, selectRecordTableText, selectAccessibilityText, selectCourseRecordsText, selectSplitViewText } from '../../../store/recordsTextStore';
import RecordTableRow from './record-table/RecordTableRow';
import RecordTableSplitView from './record-table/RecordTableSplitView';
import { recordTableDefaultProps, recordTablePropTypes } from './record-table/recordTablePropTypes';

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
  records = [],
  canBypassVisibility = false,
}) => {
  const [activePopover, setActivePopover] = useState(null);
  const [expandedLinkItems, setExpandedLinkItems] = useState({});
  
  // Get text from the store
  const recordTableText = useRecordsTextStore(selectRecordTableText);
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

  const checkVisibility = useCallback(
    item => getItemVisibility(item, canBypassVisibility),
    [canBypassVisibility]
  );

  // Process visibility for all items
  const processedResults = useMemo(() => {
    let hiddenCount = 0;
    let visibleCount = 0;
    let scheduleInfo = [];
    
    const collectScheduleInfo = (item) => {
      const startDate = parseVisibilityDate(item.resource?.start_visibility);
      const endDate = parseVisibilityDate(item.resource?.end_visibility, 'end');
      if (startDate) {
        scheduleInfo.push({ title: item.copiedItem?.title, date: startDate, type: 'upcoming' });
      } else if (endDate) {
        scheduleInfo.push({ title: item.copiedItem?.title, date: endDate, type: 'past' });
      }
    };

    const processedItems = combinedResults.map(result => {
      if (result.folder) {
        // For grouped items
        const processedGroupItems = result.items.map(item => {
          const visibility = checkVisibility(item);
          if (!visibility.isVisible) {
            hiddenCount++;
            collectScheduleInfo(item);
          } else {
            visibleCount++;
          }
          return { ...item, visibility };
        });
        
        // Only include visible items in the processed group
        const visibleItems = processedGroupItems.filter(item => 
          item.visibility.isVisible || canBypassVisibility
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
          collectScheduleInfo(result);
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
      return item.visibility.isVisible || canBypassVisibility;
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
  }, [combinedResults, canBypassVisibility, checkVisibility]);
  
  const { 
    items: processedItems, 
    hiddenCount, 
    visibleCount, 
    totalCount,
    nextAvailableDate 
  } = processedResults;

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

  const tableContext = {
    accessibilityText,
    activePopover,
    availability,
    canBypassVisibility,
    checkVisibility,
    customization,
    expandedLinkItems,
    handleExternalLinkClick,
    hasElectronicReserves,
    recordTableText,
    showVisibilityMessages,
    splitViewText,
    toggleLinksExpand,
    togglePopover,
    totalColumns,
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
  return viewMode === 'split' ? <RecordTableSplitView records={records} context={tableContext} /> : (
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
                  {result.items.map(item => (
                    <RecordTableRow key={item.id} item={item} context={tableContext} />
                  ))}
                </React.Fragment>
              );
            } else {
              return <RecordTableRow key={result.id} item={result} context={tableContext} />;
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

RecordTable.propTypes = recordTablePropTypes;
RecordTable.defaultProps = recordTableDefaultProps;

export default RecordTable;
