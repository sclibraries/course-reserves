import PropTypes from 'prop-types';

export const recordCardPropTypes = {
  /** Record item data containing all necessary information */
  recordItem: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    copiedItem: PropTypes.shape({
      instanceId: PropTypes.string,
      title: PropTypes.string,
      barcode: PropTypes.string,
      url: PropTypes.string,
      uri: PropTypes.string,
      contributors: PropTypes.arrayOf(
        PropTypes.shape({ name: PropTypes.string })
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
  }).isRequired,
  /** Whether the record is displayed as part of a group */
  isGrouped: PropTypes.bool,
  /** Availability information keyed by instance ID */
  availability: PropTypes.objectOf(
    PropTypes.shape({
      holdings: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          location: PropTypes.string,
          status: PropTypes.string,
          temporaryLoanType: PropTypes.string,
          permanentLoanType: PropTypes.string,
          library: PropTypes.shape({ name: PropTypes.string }),
        })
      ),
    })
  ).isRequired,
  /** Map of which accordions are open, keyed by ID */
  openAccordions: PropTypes.object.isRequired,
  /** Function to toggle accordion open state */
  toggleAccordion: PropTypes.func.isRequired,
  /** UI customization settings */
  customization: PropTypes.shape({
    recordsCardTitleTextColor: PropTypes.string,
    recordsCardTextColor: PropTypes.string,
    recordsDiscoverLinkText: PropTypes.string,
    recordsDiscoverLinkBgColor: PropTypes.string,
    recordsDiscoverLinkBaseUrl: PropTypes.string,
    accordionHeaderBgColor: PropTypes.string,
    accordionHeaderTextColor: PropTypes.string,
  }).isRequired,
  /** Course information for tracking and display */
  courseInfo: PropTypes.shape({
    name: PropTypes.string,
    courseNumber: PropTypes.string,
    courseListingId: PropTypes.string,
    courseListingObject: PropTypes.shape({
      termObject: PropTypes.shape({ name: PropTypes.string }),
      instructorObjects: PropTypes.arrayOf(
        PropTypes.shape({ name: PropTypes.string })
      ),
    }),
  }),
  /** College parameter for tracking */
  collegeParam: PropTypes.string,
  /** Whether to show visibility messages instead of hiding items */
  showVisibilityMessages: PropTypes.bool,
  /** Whether visibility restrictions can be bypassed */
  canBypassVisibility: PropTypes.bool,
};

export const recordCardDefaultProps = {
  isGrouped: false,
  courseInfo: {},
  collegeParam: 'Unknown',
  showVisibilityMessages: true,
  canBypassVisibility: false,
};
