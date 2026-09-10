import PropTypes from 'prop-types';

const StatCard = ({ label, value, color = 'primary', icon: Icon }) => (
  <div className="stat-card">
    <div className="stat-card-label">{label}</div>
    <div className={`stat-card-value text-${color}`}>
      {Icon && <Icon className="me-2" />}
      {value}
    </div>
  </div>
);

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  color: PropTypes.string,
  icon: PropTypes.elementType
};

export default StatCard;