import PropTypes from 'prop-types';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';

export const DatePairControl = ({ id, startLabel, endLabel, startName, endName, startValue, endValue, onStartChange, onEndChange }) => (
  <div className="tw-grid tw-min-w-0 tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2">
    <div className="tw-min-w-0 tw-space-y-2">
      <Label htmlFor={`${id}-start`}>{startLabel}</Label>
      <Input
        id={`${id}-start`}
        name={startName}
        type="date"
        value={startValue || ''}
        onChange={onStartChange}
        className="tw-min-w-0"
      />
    </div>
    <div className="tw-min-w-0 tw-space-y-2">
      <Label htmlFor={`${id}-end`}>{endLabel}</Label>
      <Input
        id={`${id}-end`}
        name={endName}
        type="date"
        value={endValue || ''}
        onChange={onEndChange}
        className="tw-min-w-0"
      />
    </div>
  </div>
);

DatePairControl.propTypes = {
  id: PropTypes.string.isRequired,
  startLabel: PropTypes.string.isRequired,
  endLabel: PropTypes.string.isRequired,
  startName: PropTypes.string.isRequired,
  endName: PropTypes.string.isRequired,
  startValue: PropTypes.string,
  endValue: PropTypes.string,
  onStartChange: PropTypes.func.isRequired,
  onEndChange: PropTypes.func.isRequired,
};

export default DatePairControl;
