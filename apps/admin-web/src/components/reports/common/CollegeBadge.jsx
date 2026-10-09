import PropTypes from 'prop-types';
import { Badge } from 'reactstrap';
import { CAMPUS_COLORS } from '../constants';

/**
 * Display a college/campus with appropriate coloring
 */
const CollegeBadge = ({ college }) => {
  if (!college) return null;
  
  // Get color from constants or use default
  const badgeColor = college && CAMPUS_COLORS?.[college.toLowerCase()] 
    ? CAMPUS_COLORS[college.toLowerCase()] 
    : '#6c757d'; // Default gray
  
  return (
    <Badge 
      color="info" 
      style={badgeColor !== '#6c757d' ? { backgroundColor: badgeColor } : {}}
    >
      {college}
    </Badge>
  );
};

CollegeBadge.propTypes = {
  /**
   * College/campus name
   */
  college: PropTypes.string
};

export default CollegeBadge;