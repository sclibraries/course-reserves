import PropTypes from 'prop-types';

export const recordTablePropTypes = {
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
   * Whether visibility restrictions can be bypassed
   */
  canBypassVisibility: PropTypes.bool,
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

export const recordTableDefaultProps = {
  hasElectronicReserves: false,
  courseInfo: {},
  collegeParam: 'Unknown',
  showVisibilityMessages: true,
  viewMode: 'combined',
  records: [],
  canBypassVisibility: false,
};
