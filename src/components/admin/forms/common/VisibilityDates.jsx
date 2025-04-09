import PropTypes from 'prop-types';
import { Row, Col, FormGroup, Label, Input } from 'reactstrap';

/**
 * VisibilityDates - Component for setting resource visibility dates
 */
export const VisibilityDates = ({ startDate, endDate, handleChange }) => {
  return (
    <Row>
      <Col md={6}>
        <FormGroup>
          <Label for="start_visibility">Visibility Start Date</Label>
          <Input
            id="start_visibility"
            name="start_visibility"
            type="date"
            value={startDate || ''}
            onChange={handleChange}
          />
          <small className="text-muted">
            When the resource becomes visible to students
          </small>
        </FormGroup>
      </Col>
      
      <Col md={6}>
        <FormGroup>
          <Label for="end_visibility">Visibility End Date</Label>
          <Input
            id="end_visibility"
            name="end_visibility"
            type="date"
            value={endDate || ''}
            onChange={handleChange}
          />
          <small className="text-muted">
            When the resource stops being visible to students
          </small>
        </FormGroup>
      </Col>
    </Row>
  );
};

VisibilityDates.propTypes = {
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  handleChange: PropTypes.func.isRequired
};

export default VisibilityDates;
