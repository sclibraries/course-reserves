import PropTypes from 'prop-types';
import { Button, CardText } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { formatPublicationEntries } from '../recordDisplayUtils';

const formatPublication = (publication) => {
  if (!publication || !Array.isArray(publication)) return 'N/A';
  return formatPublicationEntries(publication);
};

const RecordCardPrintDetails = ({
  isElectronic,
  contributors,
  publication,
  discoverUrl,
  recordsDiscoverLinkText,
  recordsDiscoverLinkBgColor,
  textStyle,
  title,
  handleExternalLinkClick,
}) => {
  if (isElectronic) return null;

  const handleDiscoverClick = (event) => {
    if (!discoverUrl) return;
    handleExternalLinkClick(event, 'record_discover_link', discoverUrl, {
      authors: contributors?.map((contributor) => contributor.name) || [],
    });
  };

  return (
    <>
      {contributors?.length > 0 && (
        <CardText style={textStyle}>
          <strong>Authors:</strong> {contributors.map((contributor) => contributor.name).join(', ')}
        </CardText>
      )}

      {publication?.length > 0 && (
        <CardText style={textStyle}>
          <strong>Publication:</strong> {formatPublication(publication)}
        </CardText>
      )}
      {discoverUrl && (
        <Button
          color="primary"
          onClick={handleDiscoverClick}
          className="mb-3 d-inline-flex align-items-center"
          style={{
            backgroundColor: recordsDiscoverLinkBgColor,
            borderColor: recordsDiscoverLinkBgColor,
          }}
          aria-label={`View ${title} in library catalog (opens in a new tab)`}
        >
          {recordsDiscoverLinkText}
          <FontAwesomeIcon icon={faExternalLinkAlt} className="ms-2" aria-hidden="true" />
        </Button>
      )}
    </>
  );
};

RecordCardPrintDetails.propTypes = {
  isElectronic: PropTypes.bool.isRequired,
  contributors: PropTypes.array,
  publication: PropTypes.array,
  discoverUrl: PropTypes.string,
  recordsDiscoverLinkText: PropTypes.string.isRequired,
  recordsDiscoverLinkBgColor: PropTypes.string.isRequired,
  textStyle: PropTypes.object.isRequired,
  title: PropTypes.string,
  handleExternalLinkClick: PropTypes.func.isRequired,
};

export default RecordCardPrintDetails;
