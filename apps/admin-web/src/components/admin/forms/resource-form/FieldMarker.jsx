import PropTypes from 'prop-types';

export const FieldMarker = ({ marker }) => {
  if (!marker) return null;
  return (
    <span className="tw-ml-2 tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-border tw-bg-secondary tw-px-2 tw-py-0.5 tw-align-middle tw-text-xs tw-font-medium tw-text-secondary-foreground">
      {marker}
    </span>
  );
};

FieldMarker.propTypes = {
  marker: PropTypes.oneOf(['from EDS', 'guessed']),
};

export default FieldMarker;
