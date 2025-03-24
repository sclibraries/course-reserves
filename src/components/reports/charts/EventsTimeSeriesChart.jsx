import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody } from 'reactstrap';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { formatTimeSeriesData } from '../utils/chartUtils';

/**
 * Time series chart showing events over time
 */
const EventsTimeSeriesChart = ({ timeSeriesData, title }) => {
  const formattedData = formatTimeSeriesData(timeSeriesData);
  
  // Check if we have data to display
  const hasData = formattedData && formattedData.length > 0;
  
  return (
    <Card className="shadow-sm">
      <CardHeader className="bg-light">
        <h5 className="mb-0">{title || 'Events Over Time'}</h5>
      </CardHeader>
      <CardBody>
        {!hasData ? (
          <div className="text-center p-5">
            <p>No time series data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => {
                  try {
                    const d = new Date(date);
                    return isNaN(d.getTime()) ? 'Invalid' : `${d.getMonth()+1}/${d.getDate()}`;
                  } catch (e) {
                    console.debug(e);
                    return 'Invalid';
                  }
                }}
              />
              <YAxis 
                domain={[0, 'dataMax + 5']} 
                allowDecimals={false}
              /> 
              <Tooltip 
                labelFormatter={(date) => {
                  try {
                    return `Date: ${new Date(date).toLocaleDateString()}`;
                  } catch (e) {
                    console.debug(e);
                    return 'Invalid date';
                  }
                }} 
                formatter={(value) => [`${value} events`, 'Count']}
              />
              <Area 
                type="monotone" 
                dataKey="count" 
                stroke="#8884d8" 
                fillOpacity={1} 
                fill="url(#colorCount)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
};

EventsTimeSeriesChart.propTypes = {
  /**
   * Time series data with counts
   */
  timeSeriesData: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.string,
      count: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    })
  ),
  
  /**
   * Chart title
   */
  title: PropTypes.string
};

EventsTimeSeriesChart.defaultProps = {
  timeSeriesData: [],
  title: 'Events Over Time'
};

export default EventsTimeSeriesChart;