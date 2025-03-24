import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody } from 'reactstrap';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { formatEventTypeData } from '../utils/chartUtils';
import { COLORS } from '../constants';
import { getEventBadgeColor } from '../utils/eventUtils';

/**
 * Pie chart showing event types distribution
 */
const EventTypesPieChart = ({ eventTypeData, title }) => {
  const formattedData = formatEventTypeData(eventTypeData);
  
  // Check if we have data to display
  const hasData = formattedData && formattedData.length > 0;
  
  return (
    <Card className="h-100 shadow-sm">
      <CardHeader className="bg-light">
        <h5 className="mb-0">{title || 'Event Types Distribution'}</h5>
      </CardHeader>
      <CardBody>
        {!hasData ? (
          <div className="text-center p-5">
            <p>No event type data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={formattedData}
                cx="50%"
                cy="50%"
                labelLine={true}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={({name, percent}) => 
                  percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''
                }
              >
                {formattedData.map((entry, index) => {
                  // Try to use event type color if available, fall back to rotation
                  const colorName = getEventBadgeColor(entry.rawName);
                  // Convert Bootstrap color name to hex if needed
                  const bootstrapColors = {
                    primary: '#0d6efd',
                    success: '#198754',
                    info: '#0dcaf0',
                    warning: '#ffc107',
                    danger: '#dc3545',
                    secondary: '#6c757d',
                    dark: '#212529'
                  };
                  const color = bootstrapColors[colorName] || COLORS[index % COLORS.length];
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Pie>
              <Tooltip formatter={(value) => [`${value} events`, 'Count']} />
              <Legend layout="vertical" align="right" verticalAlign="middle" />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
};

EventTypesPieChart.propTypes = {
  /**
   * Event type data with counts
   */
  eventTypeData: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    })
  ),
  
  /**
   * Chart title
   */
  title: PropTypes.string
};

EventTypesPieChart.defaultProps = {
  eventTypeData: [],
  title: 'Event Types Distribution'
};

export default EventTypesPieChart;