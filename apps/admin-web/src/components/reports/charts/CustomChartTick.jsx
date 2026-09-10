import PropTypes from 'prop-types';

/**
 * Custom tick component for truncating long course names in charts
 */
const CustomChartTick = (props) => {
  const { x, y, payload } = props;
  
  return (
    <g transform={`translate(${x},${y})`}>
      <text 
        x={-3} 
        y={0} 
        dy={4} 
        textAnchor="end" 
        fill="#666"
        fontSize={11}
        width={240}
      >
        {payload?.value && typeof payload.value === 'string' && payload.value.length > 35 
          ? payload.value.substring(0, 32) + '...' 
          : payload?.value}
      </text>
    </g>
  );
};

CustomChartTick.propTypes = {
  // These props are passed by recharts to the tick component
  x: PropTypes.number,
  y: PropTypes.number,
  payload: PropTypes.shape({
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  })
};

export default CustomChartTick;