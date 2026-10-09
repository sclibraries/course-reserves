import PropTypes from 'prop-types';
import { Button } from 'reactstrap';

/**
 * Reusable pagination controls 
 */
const PaginationControls = ({ 
  page, 
  pageSize, 
  totalItems, 
  onPageChange 
}) => {
  if (!totalItems || totalItems <= pageSize) return null;
  
  // Calculate values for display
  const firstItemIndex = ((page - 1) * pageSize) + 1;
  const lastItemIndex = Math.min(page * pageSize, totalItems);
  const hasNextPage = page * pageSize < totalItems;
  const hasPrevPage = page > 1;
  
  return (
    <div className="d-flex justify-content-between align-items-center mt-3">
      <div>
        Showing {firstItemIndex}-{lastItemIndex} of {totalItems} items
      </div>
      <div>
        <Button 
          color="primary" 
          size="sm" 
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrevPage}
          className="me-2"
        >
          Previous
        </Button>
        <Button
          color="primary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

PaginationControls.propTypes = {
  /**
   * Current page number (1-based)
   */
  page: PropTypes.number.isRequired,
  
  /**
   * Number of items per page
   */
  pageSize: PropTypes.number.isRequired,
  
  /**
   * Total number of items across all pages
   */
  totalItems: PropTypes.number.isRequired,
  
  /**
   * Callback when page changes
   */
  onPageChange: PropTypes.func.isRequired
};

export default PaginationControls;