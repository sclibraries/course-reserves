import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody, Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Cell, ResponsiveContainer 
} from 'recharts';
import { COLORS, CAMPUS_COLORS } from '../constants';
import CustomTooltip from './CustomTooltip';
import CustomChartTick from './CustomChartTick';

const CoursesByTermChart = ({ 
  coursesByTerm, 
  availableTerms,
  activeTermTab, 
  setActiveTermTab 
}) => {
  return (
    <Card className="mb-4 shadow-sm">
      <CardHeader className="bg-light">
        <h5 className="mb-0">Top Courses By Term</h5>
      </CardHeader>
      <CardBody>
        {availableTerms.length === 0 ? (
          <div className="text-center p-4">
            <p>No term data available.</p>
          </div>
        ) : (
          <>
            <Nav tabs className="mb-3">
              {['all', ...availableTerms].map(term => (
                <NavItem key={term}>
                  <NavLink
                    className={activeTermTab === term ? 'active' : ''}
                    onClick={() => setActiveTermTab(term)}
                    style={{ cursor: 'pointer' }}
                  >
                    {term === 'all' ? 'All Terms' : term}
                  </NavLink>
                </NavItem>
              ))}
            </Nav>
            
            <TabContent activeTab={activeTermTab}>
              {['all', ...availableTerms].map(term => (
                <TabPane tabId={term} key={term}>
                  {coursesByTerm[term] && coursesByTerm[term].length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart 
                        data={coursesByTerm[term].map(item => ({
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
                        <Tooltip content={props => <CustomTooltip {...props} />} />
                        <Bar dataKey="count" fill="#8884d8">
                          {coursesByTerm[term].map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={CAMPUS_COLORS[entry.college] || COLORS[index % COLORS.length]} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center p-4">
                      <p>No course data available for this term.</p>
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

CoursesByTermChart.propTypes = {
  coursesByTerm: PropTypes.objectOf(
    PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        college: PropTypes.string,
        term: PropTypes.string
      })
    )
  ).isRequired,
  availableTerms: PropTypes.arrayOf(PropTypes.string).isRequired,
  activeTermTab: PropTypes.string.isRequired,
  setActiveTermTab: PropTypes.func.isRequired
};

export default CoursesByTermChart;