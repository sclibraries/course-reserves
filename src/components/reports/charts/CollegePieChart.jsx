import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody } from 'reactstrap';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { filterValidColleges } from '../utils/chartUtils';
import { COLORS, CAMPUS_COLORS } from '../constants';

/**
 * Pie chart showing events by college
 */
const CollegePieChart = ({ collegeData, title }) => {
  const formattedData = filterValidColleges(collegeData);
  
  // Check if we have data to display
  const hasData = formattedData && formattedData.length > 0;
  
  return (
    <Card className="h-100 shadow-sm">
      <CardHeader className="bg-light">
        <h5 className="mb-0">{title || 'Events by College'}</h5>
      </CardHeader>
      <CardBody>
        {!hasData ? (
          <div className="text-center p-5">
            <p>No college data available</p>
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
                nameKey="college"
                label={({name, percent}) => 
                  percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''
                }
              >
                {formattedData.map((entry, index) => {
                  // Try to use campus color if available, fall back to rotation
                  const color = CAMPUS_COLORS[entry.college.toLowerCase()] || 
                                COLORS[index % COLORS.length];
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

CollegePieChart.propTypes = {
  /**
   * College data with counts
   */
  collegeData: PropTypes.arrayOf(
    PropTypes.shape({
      college: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    })
  ),
  
  /**
   * Chart title
   */
  title: PropTypes.string
};

CollegePieChart.defaultProps = {
  collegeData: [],
  title: 'Events by College'
};

export default CollegePieChart;