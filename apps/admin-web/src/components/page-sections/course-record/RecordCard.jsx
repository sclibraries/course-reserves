import { useMemo, useState } from 'react';
import { Card, CardBody } from 'reactstrap';
import { trackingService } from '../../../services/trackingService';
import { getItemVisibility, getVisibilityInfo } from '../../../util/resourceVisibility';
import {
  getDiscoverUrl,
  getResourceBadgeText,
  getReserveMaterialTypes,
} from './recordDisplayUtils';
import RecordCardElectronicResource from './record-card/RecordCardElectronicResource';
import RecordCardHeading from './record-card/RecordCardHeading';
import RecordCardHoldings from './record-card/RecordCardHoldings';
import RecordCardPrintDetails from './record-card/RecordCardPrintDetails';
import { recordCardDefaultProps, recordCardPropTypes } from './record-card/recordCardPropTypes';

/**
 * Renders a detailed course record card with resource, availability, and access information.
 */
const RecordCard = ({
  recordItem,
  availability,
  openAccordions,
  toggleAccordion,
  customization,
  isGrouped = false,
  courseInfo,
  collegeParam,
  showVisibilityMessages = true,
  canBypassVisibility = false,
}) => {
  const [activePopover, setActivePopover] = useState(null);
  const togglePopover = (itemId) => {
    setActivePopover(activePopover === itemId ? null : itemId);
  };

  const {
    recordsCardTitleTextColor = '#000000',
    recordsCardTextColor = '#212529',
    recordsDiscoverLinkText = 'View in Catalog',
    recordsDiscoverLinkBgColor = '#0d6efd',
    recordsDiscoverLinkBaseUrl = '',
    accordionHeaderBgColor = '#f8f9fa',
    accordionHeaderTextColor = '#212529',
  } = customization || {};

  const textStyle = useMemo(() => ({ color: recordsCardTextColor }), [recordsCardTextColor]);
  const titleStyle = useMemo(() => ({ color: recordsCardTitleTextColor }), [recordsCardTitleTextColor]);
  const accordionHeaderStyle = useMemo(() => ({
    backgroundColor: accordionHeaderBgColor,
    color: accordionHeaderTextColor,
  }), [accordionHeaderBgColor, accordionHeaderTextColor]);

  const {
    name: courseName = 'N/A',
    courseNumber = 'N/A',
    courseListingObject = {},
    courseListingId = 'N/A',
  } = courseInfo || {};
  const termName = courseListingObject?.termObject?.name ?? 'N/A';
  const instructors = courseListingObject?.instructorObjects?.map((instructor) => instructor.name) || [];

  if (!recordItem || !recordItem.copiedItem) {
    console.error('Invalid record item data:', recordItem);
    return null;
  }

  const { copiedItem, isElectronic, resource } = recordItem;
  const { instanceId, title, contributors, publication } = copiedItem;
  const resourceTypeStyles = isElectronic ? {
    borderLeft: '4px solid #1976D2',
    borderLeftColor: '#1976D2',
  } : {
    borderLeft: '4px solid #388E3C',
    borderLeftColor: '#388E3C',
  };

  const { isVisible, message } = getItemVisibility(recordItem, canBypassVisibility);
  if (!isVisible && !canBypassVisibility && !showVisibilityMessages) return null;

  const discoverUrl = !isElectronic
    ? getDiscoverUrl(recordsDiscoverLinkBaseUrl, instanceId)
    : null;
  const availabilityData = availability[instanceId] || {};
  const holdings = availabilityData.holdings || [];
  const allHoldings = availabilityData.allHoldings || [];
  const reserveMaterialTypes = getReserveMaterialTypes(isElectronic, holdings);
  const visibilityInfo = isElectronic && resource
    ? getVisibilityInfo(resource, canBypassVisibility)
    : { showVisibilityDates: false };
  const showVisibilityDates = visibilityInfo.showVisibilityDates;
  const resourceBadgeText = getResourceBadgeText(isElectronic, reserveMaterialTypes);

  const handleExternalLinkClick = (event, eventType, url, extraMetadata = {}) => {
    if (!url) {
      console.warn('Attempted to open external link with empty URL');
      return;
    }

    event.preventDefault();

    try {
      trackingService.trackEvent({
        college: collegeParam || 'Unknown',
        event_type: eventType,
        course_id: courseListingId,
        term: termName,
        course_name: courseName,
        course_code: courseNumber,
        instructor: instructors.map((instructor) => ({ name: instructor })),
        metadata: {
          record_title: recordItem.copiedItem?.title || 'N/A',
          instanceId: recordItem.copiedItem?.instanceId || 'N/A',
          target_url: url,
          ...extraMetadata,
        },
      }).finally(() => {
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    } catch (error) {
      console.error('Error tracking event:', error);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card
      className={`shadow-sm mb-4 bg-body-tertiary ${
        isGrouped ? 'ms-4 border-start border-3 border-secondary-color-rgb' : ''
      } ${!isVisible ? 'border border-warning' : ''}`}
      style={{
        ...resourceTypeStyles,
        transition: 'all 0.2s ease-in-out',
        opacity: isVisible ? 1 : 0.8,
      }}
    >
      <CardBody>
        <RecordCardHeading
          recordItem={recordItem}
          title={title}
          titleStyle={titleStyle}
          isElectronic={isElectronic}
          resource={resource}
          resourceBadgeText={resourceBadgeText}
          isVisible={isVisible}
          message={message}
          showVisibilityMessages={showVisibilityMessages}
          canBypassVisibility={canBypassVisibility}
          showVisibilityDates={showVisibilityDates}
          visibilityInfo={visibilityInfo}
          activePopover={activePopover}
          togglePopover={togglePopover}
        />

        <RecordCardPrintDetails
          isElectronic={isElectronic}
          contributors={contributors}
          publication={publication}
          discoverUrl={discoverUrl}
          recordsDiscoverLinkText={recordsDiscoverLinkText}
          recordsDiscoverLinkBgColor={recordsDiscoverLinkBgColor}
          textStyle={textStyle}
          title={title}
          handleExternalLinkClick={handleExternalLinkClick}
        />
        <RecordCardElectronicResource
          resource={isElectronic ? resource : null}
          title={title}
          canBypassVisibility={canBypassVisibility}
          visibilityInfo={visibilityInfo}
          showVisibilityDates={showVisibilityDates}
          recordsDiscoverLinkBgColor={recordsDiscoverLinkBgColor}
          textStyle={textStyle}
          handleExternalLinkClick={handleExternalLinkClick}
        />
        <RecordCardHoldings
          isElectronic={isElectronic}
          instanceId={instanceId}
          holdings={holdings}
          allHoldings={allHoldings}
          openAccordions={openAccordions}
          toggleAccordion={toggleAccordion}
          accordionHeaderStyle={accordionHeaderStyle}
          copiedItem={copiedItem}
          title={title}
          recordsDiscoverLinkBgColor={recordsDiscoverLinkBgColor}
          handleExternalLinkClick={handleExternalLinkClick}
        />
      </CardBody>
    </Card>
  );
};

RecordCard.propTypes = recordCardPropTypes;
RecordCard.defaultProps = recordCardDefaultProps;

export default RecordCard;
