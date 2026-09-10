import PropTypes from 'prop-types';
import { FormGroup, Label, Row, Col, Input } from 'reactstrap';

/**
 * Component for filtering data by date range
 */
const DateRangeFilter = ({ 
  startDate, 
  endDate, 
  onStartDateChange, 
  onEndDateChange,
  label
}) => {
  return (
    <FormGroup>
      <Label>{label}</Label>
      <Row className="g-2">
        <Col xs={6}>
          <Input
            type="date"
            value={startDate || ''}
            onChange={(e) => onStartDateChange(e.target.value)}
            placeholder="Start Date"
            aria-label="Start Date"
          />
        </Col>
        <Col xs={6}>
          <Input
            type="date"
            value={endDate || ''}
            onChange={(e) => onEndDateChange(e.target.value)}
            placeholder="End Date"
            min={startDate || ''}
            aria-label="End Date"
          />
        </Col>
      </Row>
    </FormGroup>
  );
};

DateRangeFilter.propTypes = {
  /**
   * Start date value (YYYY-MM-DD format)
   */
  startDate: PropTypes.string,
  
  /**
   * End date value (YYYY-MM-DD format)
   */
  endDate: PropTypes.string,
  
  /**
   * Callback for when start date changes
   */
  onStartDateChange: PropTypes.func.isRequired,
  
  /**
   * Callback for when end date changes
   */
  onEndDateChange: PropTypes.func.isRequired,
  
  /**
   * Field label
   */
  label: PropTypes.string
};

DateRangeFilter.defaultProps = {
  startDate: '',
  endDate: '',
  label: 'Date Range'
};

export default DateRangeFilter;