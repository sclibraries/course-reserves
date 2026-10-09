import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody } from 'reactstrap';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Cell, ResponsiveContainer 
} from 'recharts';
import { CAMPUS_COLORS, COLORS } from '../constants';

/**
 * Chart component for showing course access by college
 */
const CollegeAccessChart = ({ collegeData }) => {
  // Filter out invalid or empty data
  const validCollegeData = (collegeData || [])
    .filter(item => 
      item && 
      item.college &&
      item.college !== 'N/A' && 
      item.college !== 'null' && 
      item.college !== 'NULL' &&
      item.college !== 'Unknown' &&
      item.college.toLowerCase() !== 'unknown' &&
      item.college !== 'default'
    )
    .map(item => ({
      college: item.college,
      value: Number(item.value) || 0
    }));
  
  // Check if we have data to display
  const hasData = validCollegeData.length > 0;

  return (
    <Card className="shadow-sm mb-4">
      <CardHeader className="bg-light">
        <h5 className="mb-0">Course Access by College</h5>
      </CardHeader>
      <CardBody>
        {!hasData ? (
          <div className="text-center p-4">
            <p>No college data available.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={validCollegeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="college" 
                tick={{ 
                  fontSize: 12,
                  angle: validCollegeData.length > 5 ? -45 : 0,
                  textAnchor: validCollegeData.length > 5 ? 'end' : 'middle'
                }}
                height={60}
                padding={{ left: 20, right: 20 }}
              />
              <YAxis 
                domain={[0, 'dataMax']} 
                label={{ 
                  value: 'Access Count', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { textAnchor: 'middle' }
                }}
              />
              <Tooltip 
                formatter={(value) => {
                  return [`${value} events`, 'Access Count'];
                }}
                labelFormatter={(label) => `College: ${label}`}
              />
              <Bar dataKey="value" name="Access Count">
                {validCollegeData.map((entry) => (
                  <Cell 
                    key={`cell-${entry.college}`} 
                    fill={CAMPUS_COLORS[entry.college.toLowerCase()] || 
                          COLORS[validCollegeData.indexOf(entry) % COLORS.length]} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
};

CollegeAccessChart.propTypes = {
  collegeData: PropTypes.arrayOf(
    PropTypes.shape({
      college: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    })
  )
};

CollegeAccessChart.defaultProps = {
  collegeData: []
};

export default CollegeAccessChart;