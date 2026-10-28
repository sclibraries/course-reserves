import PropTypes from 'prop-types';

function ReadinessStatusIcon({ presentation }) {
  const Icon = presentation.Icon;
  return (
    <span role="img" aria-label={presentation.label} className="tw-inline-flex tw-shrink-0 tw-text-muted-foreground">
      <Icon aria-hidden="true" className="tw-h-4 tw-w-4" />
    </span>
  );
}

ReadinessStatusIcon.propTypes = {
  presentation: PropTypes.shape({
    label: PropTypes.string.isRequired,
    Icon: PropTypes.elementType.isRequired,
  }).isRequired,
};

export default ReadinessStatusIcon;
