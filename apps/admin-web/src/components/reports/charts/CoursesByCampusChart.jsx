import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody, Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Cell, ResponsiveContainer 
} from 'recharts';
import { COLORS, CAMPUS_COLORS } from '../constants';
import CustomChartTick from './CustomChartTick';
import CustomTooltip from './CustomTooltip';

/**
 * Component for displaying top courses by campus
 */
const CoursesByCampusChart = ({ 
  coursesByCampus, 
  campuses,
  activeCampusTab, 
  setActiveCampusTab 
}) => {
  return (
    <Card className="mb-4 shadow-sm">
      <CardHeader className="bg-light">
        <h5 className="mb-0">Top 10 Most Accessed Courses by Campus</h5>
      </CardHeader>
      <CardBody>
        {campuses.length <= 1 ? (
          <div className="text-center p-4">
            <p>No campus data available.</p>
          </div>
        ) : (
          <>
            <Nav tabs className="mb-3">
              {campuses.map(campus => (
                <NavItem key={campus}>
                  <NavLink
                    className={activeCampusTab === campus ? 'active' : ''}
                    onClick={() => setActiveCampusTab(campus)}
                    style={{ cursor: 'pointer' }}
                  >
                    {campus === 'all' ? 'All Campuses' : campus.charAt(0).toUpperCase() + campus.slice(1)}
                  </NavLink>
                </NavItem>
              ))}
            </Nav>
            
            <TabContent activeTab={activeCampusTab}>
              {campuses.map(campus => (
                <TabPane tabId={campus} key={campus}>
                  {coursesByCampus[campus] && coursesByCampus[campus].length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart 
                        data={coursesByCampus[campus].map(item => ({
                          name: item.name || 'Unknown Course',
                          count: Number(item.count) || 0,
                          college: item.college || 'unknown',
                          term: item.term || 'N/A'
                        }))}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 250, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 'dataMax']} />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          width={250}
                          tick={props => <CustomChartTick {...props} />}
                        />
                        <Tooltip 
                          content={props => (
                            <CustomTooltip 
                              {...props} 
                              showCampusBadge={campus === 'all'} // Only show campus badge when viewing all campuses
                            />
                          )} 
                        />
                        <Bar dataKey="count" fill="#8884d8">
                          {coursesByCampus[campus].map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={campus === 'all' 
                                ? CAMPUS_COLORS[entry.college] || COLORS[index % COLORS.length]
                                : CAMPUS_COLORS[campus] || COLORS[index % COLORS.length]
                              } 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center p-4">
                      <p>No course data available for this campus.</p>
                    </div>
                  )}
                </TabPane>
              ))}
            </TabContent>
          </>
        )}
      </CardBody>
    </Card>
  );
};

CoursesByCampusChart.propTypes = {
  coursesByCampus: PropTypes.objectOf(
    PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        college: PropTypes.string,
        term: PropTypes.string
      })
    )
  ).isRequired,
  campuses: PropTypes.arrayOf(PropTypes.string).isRequired,
  activeCampusTab: PropTypes.string.isRequired,
  setActiveCampusTab: PropTypes.func.isRequired
};

export default CoursesByCampusChart;