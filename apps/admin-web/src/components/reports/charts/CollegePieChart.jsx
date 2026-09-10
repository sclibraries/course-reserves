import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody } from 'reactstrap';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { COLORS, CAMPUS_COLORS } from '../constants';

/**
 * Custom label renderer for pie chart that prevents label overlapping
 */
const renderCustomizedLabel = ({ cx, cy, midAngle, outerRadius, percent, name }) => {
  // Only show labels for segments larger than 5%
  if (percent < 0.05) return null;
  
  const RADIAN = Math.PI / 180;
  const radius = outerRadius * 1.1;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
  const percentValue = (percent * 100).toFixed(0);
  
  // Shorter labels for smaller segments
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
 * Component that displays college/campus distribution as a pie chart
 */
const CollegePieChart = ({ collegeData }) => {
  // Transform data for chart and group small segments
  const prepareChartData = (data) => {
    if (!data || data.length === 0) {
      return [];
    }

    // Map raw data to chart format and handle missing values
    const formattedData = data.map(item => ({
      name: item.college || 'Unknown',
      value: Number(item.value || 0),
      // Use predefined campus color if available
      color: CAMPUS_COLORS[item.college?.toLowerCase()] || null
    })).filter(item => item.value > 0);
    
    if (formattedData.length === 0) {
      return [];
    }
    
    // Calculate total for percentage threshold
    const total = formattedData.reduce((sum, item) => sum + item.value, 0);
    
    // Group segments smaller than 3% as "Other"
    const threshold = total * 0.03;
    let significant = [];
    let othersValue = 0;
    
    formattedData.forEach(item => {
      if (item.value >= threshold) {
        significant.push(item);
      } else {
        othersValue += item.value;
      }
    });
    
    // Sort by value (descending)
    significant = significant.sort((a, b) => b.value - a.value);
    
    // Add "Other" category if needed
    if (othersValue > 0) {
      significant.push({ name: 'Other', value: othersValue });
    }
    
    return significant;
  };
  
  const chartData = prepareChartData(collegeData);
  
  // Handle empty data state
  if (chartData.length === 0) {
    return (
      <Card className="shadow-sm fade-in h-100">
        <CardHeader className="bg-light">
          <h5 className="mb-0">College Distribution</h5>
        </CardHeader>
        <CardBody className="text-center py-5">
          <p className="text-muted mb-0">No college data available</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm fade-in h-100">
      <CardHeader className="bg-light">
        <h5 className="mb-0">College Distribution</h5>
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
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || COLORS[index % COLORS.length]} 
                />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value, name) => {
                const total = chartData.reduce((sum, item) => sum + item.value, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return [`${value} events (${percentage}%)`, name];
              }}
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

CollegePieChart.propTypes = {
  /**
   * College data for the chart
   */
  collegeData: PropTypes.arrayOf(
    PropTypes.shape({
      college: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    })
  )
};

CollegePieChart.defaultProps = {
  collegeData: []
};

export default CollegePieChart;