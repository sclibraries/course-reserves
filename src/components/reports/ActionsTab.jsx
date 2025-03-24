import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody, Table, Alert } from 'reactstrap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';

// Color palette for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

/**
 * Actions Tab component displaying analytics related to user actions
 */
const ActionsTab = ({ analyticsData, loading, error }) => {
  // Validate and prepare top actions data
  const validTopActions = useMemo(() => {
    if (!analyticsData.topActions || !Array.isArray(analyticsData.topActions)) {
      return [];
    }
    return analyticsData.topActions.map(action => ({
      action: action.action || 'Unknown Action',
      count: Number(action.count) || 0
    }));
  }, [analyticsData.topActions]);

  // Validate and prepare event type data
  const validEventTypes = useMemo(() => {
    if (!analyticsData.eventTypeData || !Array.isArray(analyticsData.eventTypeData)) {
      return [];
    }
    return analyticsData.eventTypeData.map(type => ({
      name: type.name || 'Unknown Type',
      value: Number(type.value) || 0
    }));
  }, [analyticsData.eventTypeData]);

  // Calculate total count safely
  const totalCount = useMemo(() => {
    return Number(analyticsData.totalCount) || 
      validEventTypes.reduce((sum, type) => sum + type.value, 0);
  }, [analyticsData.totalCount, validEventTypes]);

  // Check if we have valid data to display
  const hasTopActionsData = validTopActions.length > 0;
  const hasEventTypeData = validEventTypes.length > 0;

  // If there's an error, display it
  if (error) {
    return (
      <Alert color="danger">
        <h4 className="alert-heading">Error Loading Actions Data</h4>
        <p>{error}</p>
      </Alert>
    );
  }

  return (
    <div>
      <Card className="mb-4 shadow-sm">
        <CardHeader className="bg-light">
          <h5 className="mb-0">Top User Actions</h5>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="text-center p-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2">Loading action data...</p>
            </div>
          ) : !hasTopActionsData ? (
            <div className="text-center p-4">
              <p>No action data available.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={validTopActions}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  type="category" 
                  dataKey="action" 
                  width={120}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(value) => [`${value} events`, 'Count']} />
                <Bar dataKey="count" fill="#82ca9d" name="Event Count">
                  {validTopActions.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>
      
      <Card className="shadow-sm">
        <CardHeader className="bg-light">
          <h5 className="mb-0">Event Types Breakdown</h5>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="text-center p-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2">Loading event type data...</p>
            </div>
          ) : !hasEventTypeData ? (
            <div className="text-center p-4">
              <p>No event type data available.</p>
            </div>
          ) : (
            <Table hover responsive>
              <thead>
                <tr>
                  <th>Event Type</th>
                  <th>Count</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {validEventTypes.map((type, index) => {
                  // Safe percentage calculation
                  const percentage = totalCount > 0 
                    ? (Number(type.value) / totalCount * 100).toFixed(1) 
                    : '0.0';
                    
                  return (
                    <tr key={type.name || index}>
                      <td>{type.name}</td>
                      <td>{type.value}</td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="me-2">{percentage}%</div>
                          <div className="progress" style={{width: '100px', height: '10px'}}>
                            <div 
                              className="progress-bar" 
                              role="progressbar" 
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }} 
                              aria-valuenow={percentage} 
                              aria-valuemin="0" 
                              aria-valuemax="100"
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

// Improved PropTypes with more specific validation
ActionsTab.propTypes = {
  analyticsData: PropTypes.shape({
    topActions: PropTypes.arrayOf(PropTypes.shape({
      action: PropTypes.string,
      count: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    })),
    eventTypeData: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    })),
    totalCount: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
  }),
  loading: PropTypes.bool,
  error: PropTypes.string
};

ActionsTab.defaultProps = {
  analyticsData: {
    topActions: [],
    eventTypeData: [],
    totalCount: 0
  },
  loading: false,
  error: null
};

export default ActionsTab;