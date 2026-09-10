import PropTypes from 'prop-types';
import { Badge } from 'reactstrap';
import { CAMPUS_COLORS } from '../constants';

/**
 * Custom tooltip for course charts
 */
const CustomTooltip = ({ active, payload, showCampusBadge = true }) => {
  if (!(active && payload && payload.length > 0)) return null;
  
  const data = payload[0].payload;
  
  return (
    <div className="custom-tooltip" style={{ 
      background: 'white', 
      padding: '10px', 
      border: '1px solid #ccc',
      borderRadius: '4px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
    }}>
      <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>{data.name}</p>
      <p>{data.count} access events</p>
      {showCampusBadge && (
        <p>Campus: <Badge 
          color="primary" 
          style={{ 
            backgroundColor: CAMPUS_COLORS[data.college] || '#666'
          }}
        >
          {data.college}
        </Badge></p>
      )}
      <p>Term: {data.term}</p>
    </div>
  );
};

CustomTooltip.propTypes = {
  // These are standard props passed by recharts to tooltip components
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.shape({
    payload: PropTypes.shape({
      name: PropTypes.string,
      count: PropTypes.number,
      college: PropTypes.string,
      term: PropTypes.string
    })
  })),
  showCampusBadge: PropTypes.bool
};

export default CustomTooltip;