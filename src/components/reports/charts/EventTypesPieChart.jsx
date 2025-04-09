import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody } from 'reactstrap';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { COLORS } from '../constants';

/**
 * Custom label for pie chart that avoids overlapping
 */
const renderCustomizedLabel = ({ cx, cy, midAngle, outerRadius, percent, name }) => {
  // Only display label for segments greater than 5%
  if (percent < 0.05) return null;
  
  const RADIAN = Math.PI / 180;
  const radius = outerRadius * 1.1;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
  const percentValue = (percent * 100).toFixed(0);
  
  // For very small segments, only show percentage
  const labelText = percentValue > 7 ? `${name}: ${percentValue}%` : `${percentValue}%`;

  return (
    <text 
      x={x} 
      y={y} 
      fill="#666"
      textAnchor={x > cx ? 'start' : 'end'} 
      dominantBaseline="central"
      fontSize="12"
    >
      {labelText}
    </text>
  );
};

/**
 * Component that displays event types distribution as a pie chart with improved label handling
 */
const EventTypesPieChart = ({ eventTypeData }) => {
  // Group small event types into "Other" category to reduce clutter
  const prepareChartData = (data) => {
    if (!data || data.length === 0) {
      return [];
    }
    
    // Calculate total for percentage calculation
    const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
    
    // If the total is 0, return empty data
    if (total === 0) {
      return [];
    }
    
    // Set threshold for "Other" grouping (events less than 3% of total)
    const threshold = total * 0.03;
    let significant = [];
    let othersValue = 0;
    
    data.forEach(item => {
      const value = Number(item.value || 0);
      if (value >= threshold) {
        significant.push({
          name: item.name || 'Unknown',
          value
        });
      } else {
        othersValue += value;
      }
    });
    
    // Sort by value (descending)
    significant = significant.sort((a, b) => b.value - a.value);
    
    // Add "Others" category if needed
    if (othersValue > 0) {
      significant.push({ name: 'Other', value: othersValue });
    }
    
    return significant;
  };

  const chartData = prepareChartData(eventTypeData);

  // Don't render if no data
  if (chartData.length === 0) {
    return (
      <Card className="shadow-sm fade-in h-100">
        <CardHeader className="bg-light">
          <h5 className="mb-0">Event Type Distribution</h5>
        </CardHeader>
        <CardBody className="text-center py-5">
          <p className="text-muted mb-0">No event type data available</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm fade-in h-100">
      <CardHeader className="bg-light">
        <h5 className="mb-0">Event Type Distribution</h5>
      </CardHeader>
      <CardBody>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={renderCustomizedLabel}
              isAnimationActive={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value, name) => [`${value} events (${((value/chartData.reduce((sum, item) => sum + item.value, 0))*100).toFixed(1)}%)`, name]} 
              contentStyle={{ borderRadius: '4px' }}
            />
            <Legend 
              layout="vertical" 
              verticalAlign="middle" 
              align="right"
              wrapperStyle={{ paddingLeft: '20px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
};

EventTypesPieChart.propTypes = {
  /**
   * Event type data for the chart
   */
  eventTypeData: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    })
  )
};

EventTypesPieChart.defaultProps = {
  eventTypeData: []
};

export default EventTypesPieChart;