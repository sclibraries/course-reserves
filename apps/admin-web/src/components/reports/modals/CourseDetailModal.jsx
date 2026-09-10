import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { 
  Modal, 
  ModalHeader, 
  ModalBody, 
  ModalFooter, 
  Button, 
  Card, 
  CardHeader, 
  CardBody, 
  Table, 
  Badge, 
  Alert, 
  Spinner,
  Row,
  Col,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane
} from 'reactstrap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { config } from '../../../config';
import { COLORS } from '../constants';
import { exportEventsToCSV, generateTimestampedFilename } from '../utils/csvExportUtils';
import EventTypeBadge from '../common/EventTypeBadge';
import MetadataDisplay from '../common/MetadataDisplay';

/**
 * Course Detail Modal component for displaying comprehensive course analytics
 */
const CourseDetailModal = ({ isOpen, toggle, course }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [courseData, setCourseData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  /**
   * Fetch detailed course data
   */
  const fetchCourseDetail = useCallback(async () => {
    if (!course?.name) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        'course-name': course.name
      });

      if (course.college) {
        params.append('college', course.college);
      }

      const url = `${config.api.urls.courseReserves}${config.api.endpoints.admin.reports}/course-detail?${params}`;
      
      console.debug('Fetching course detail:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, ${errorText || 'No error details'}`);
      }
      
      const data = await response.json();
      setCourseData(data);
      
    } catch (err) {
      console.error('Error fetching course detail:', err);
      setError(err.message || 'Failed to fetch course details');
    } finally {
      setLoading(false);
    }
  }, [course]);

  // Fetch data when modal opens or course changes
  useEffect(() => {
    if (isOpen && course) {
      fetchCourseDetail();
    }
  }, [isOpen, course, fetchCourseDetail]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCourseData(null);
      setError(null);
      setActiveTab('overview');
    }
  }, [isOpen]);

  /**
   * Handle CSV export for course data
   */
  const handleExportCourseData = () => {
    if (!courseData?.events) return;

    const filename = generateTimestampedFilename(`course-${course.name.replace(/[^a-zA-Z0-9]/g, '-')}`);
    exportEventsToCSV(courseData.events, filename);
  };

  /**
   * Format percentage for display
   */
  const formatPercentage = (value, total) => {
    if (!total || total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  if (!course) return null;

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xl" className="course-detail-modal">
      <ModalHeader toggle={toggle}>
        <div>
          <h4 className="mb-1">{course.name}</h4>
          <div className="text-muted">
            {course.college && <Badge color="secondary" className="me-2">{course.college}</Badge>}
            {course.term && <Badge color="info">{course.term}</Badge>}
          </div>
        </div>
      </ModalHeader>

      <ModalBody>
        {loading && (
          <div className="text-center my-5">
            <Spinner color="primary" />
            <p className="mt-2">Loading course details...</p>
          </div>
        )}

        {error && (
          <Alert color="danger">
            <h5 className="alert-heading">Error Loading Course Details</h5>
            <p>{error}</p>
            <Button color="outline-danger" size="sm" onClick={fetchCourseDetail}>
              Retry
            </Button>
          </Alert>
        )}

        {courseData && !loading && (
          <>
            {/* Navigation Tabs */}
            <Nav tabs className="mb-3">
              <NavItem>
                <NavLink
                  className={activeTab === 'overview' ? 'active' : ''}
                  onClick={() => setActiveTab('overview')}
                  style={{ cursor: 'pointer' }}
                >
                  Overview
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink
                  className={activeTab === 'terms' ? 'active' : ''}
                  onClick={() => setActiveTab('terms')}
                  style={{ cursor: 'pointer' }}
                >
                  By Terms
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink
                  className={activeTab === 'activity' ? 'active' : ''}
                  onClick={() => setActiveTab('activity')}
                  style={{ cursor: 'pointer' }}
                >
                  Activity Details
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink
                  className={activeTab === 'events' ? 'active' : ''}
                  onClick={() => setActiveTab('events')}
                  style={{ cursor: 'pointer' }}
                >
                  Event Log
                </NavLink>
              </NavItem>
            </Nav>

            <TabContent activeTab={activeTab}>
              {/* Overview Tab */}
              <TabPane tabId="overview">
                <Row>
                  <Col md="6">
                    <Card className="mb-3">
                      <CardHeader>
                        <h6 className="mb-0">Summary Statistics</h6>
                      </CardHeader>
                      <CardBody>
                        <div className="row">
                          <div className="col-6">
                            <div className="text-center">
                              <h4 className="text-primary">{courseData.totalEvents || 0}</h4>
                              <small className="text-muted">Total Events</small>
                            </div>
                          </div>
                          <div className="col-6">
                            <div className="text-center">
                              <h4 className="text-success">{courseData.uniqueSessions || 0}</h4>
                              <small className="text-muted">Unique Sessions</small>
                            </div>
                          </div>
                        </div>
                        <hr />
                        <div className="row">
                          <div className="col-6">
                            <div className="text-center">
                              <h5 className="text-info">{courseData.termsActive || 0}</h5>
                              <small className="text-muted">Terms Active</small>
                            </div>
                          </div>
                          <div className="col-6">
                            <div className="text-center">
                              <h5 className="text-warning">{courseData.eventTypes?.length || 0}</h5>
                              <small className="text-muted">Event Types</small>
                            </div>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </Col>
                  
                  <Col md="6">
                    <Card className="mb-3">
                      <CardHeader>
                        <h6 className="mb-0">Event Types Distribution</h6>
                      </CardHeader>
                      <CardBody>
                        {courseData.eventTypes && courseData.eventTypes.length > 0 ? (
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={courseData.eventTypes}
                                dataKey="count"
                                nameKey="event_type"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ event_type, count }) => `${event_type}: ${count}`}
                              >
                                {courseData.eventTypes.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-muted text-center">No event type data available</p>
                        )}
                      </CardBody>
                    </Card>
                  </Col>
                </Row>

                {/* Event Types Table */}
                {courseData.eventTypes && courseData.eventTypes.length > 0 && (
                  <Card className="mb-3">
                    <CardHeader>
                      <h6 className="mb-0">Event Types Breakdown</h6>
                    </CardHeader>
                    <CardBody>
                      <Table responsive hover>
                        <thead>
                          <tr>
                            <th>Event Type</th>
                            <th>Count</th>
                            <th>Percentage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {courseData.eventTypes.map((eventType, index) => (
                            <tr key={index}>
                              <td>
                                <EventTypeBadge eventType={eventType.event_type} />
                              </td>
                              <td><strong>{eventType.count}</strong></td>
                              <td>
                                {formatPercentage(eventType.count, courseData.totalEvents)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </CardBody>
                  </Card>
                )}

                {/* Activity Summary */}
                {courseData.events && courseData.events.length > 0 && (
                  <Card>
                    <CardHeader>
                      <h6 className="mb-0">Recent Activity Summary</h6>
                    </CardHeader>
                    <CardBody>
                      <div className="mb-3">
                        <small className="text-muted">Most recent activities (last 10 events):</small>
                      </div>
                      {courseData.events.slice(0, 10).map((event, index) => (
                        <div key={event.id || index} className="mb-2 pb-2 border-bottom">
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="flex-grow-1">
                              <EventTypeBadge eventType={event.event_type} />
                              <span className="ms-2">
                                <MetadataDisplay
                                  metadata={event.metadata}
                                  eventType={event.event_type}
                                  event={event}
                                  showInline={true}
                                  maxInlineLength={80}
                                  enhanced={true}
                                />
                              </span>
                            </div>
                            <small className="text-muted text-nowrap ms-2">
                              {event.created_at ? 
                                new Date(event.created_at).toLocaleDateString() : 
                                'Unknown'
                              }
                            </small>
                          </div>
                        </div>
                      ))}
                      <div className="text-center mt-3">
                        <Button
                          color="outline-primary"
                          size="sm"
                          onClick={() => setActiveTab('activity')}
                        >
                          View All Activity Details
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </TabPane>

              {/* Terms Tab */}
              <TabPane tabId="terms">
                {courseData.termData && courseData.termData.length > 0 ? (
                  <>
                    <Card className="mb-3">
                      <CardHeader>
                        <h6 className="mb-0">Access by Term</h6>
                      </CardHeader>
                      <CardBody>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={courseData.termData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="term" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#007bff" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardHeader>
                        <h6 className="mb-0">Terms Details</h6>
                      </CardHeader>
                      <CardBody>
                        <Table responsive hover>
                          <thead>
                            <tr>
                              <th>Term</th>
                              <th>Total Events</th>
                              <th>Unique Sessions</th>
                              <th>Event Types</th>
                              <th>Percentage of Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {courseData.termData.map((term, index) => (
                              <tr key={index}>
                                <td><Badge color="info">{term.term}</Badge></td>
                                <td><strong>{term.count}</strong></td>
                                <td>{term.uniqueSessions || 0}</td>
                                <td>{term.eventTypes || 0}</td>
                                <td>
                                  {formatPercentage(term.count, courseData.totalEvents)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </CardBody>
                    </Card>
                  </>
                ) : (
                  <Alert color="info">
                    No term-specific data available for this course.
                  </Alert>
                )}
              </TabPane>

              {/* Activity Details Tab */}
              <TabPane tabId="activity">
                {courseData.events && courseData.events.length > 0 ? (
                  <div>
                    <Card className="mb-3">
                      <CardHeader>
                        <h6 className="mb-0">Recent Activity with Details</h6>
                      </CardHeader>
                      <CardBody>
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                          {courseData.events.slice(0, 20).map((event, index) => (
                            <MetadataDisplay
                              key={event.id || index}
                              metadata={event.metadata}
                              eventType={event.event_type}
                              event={event}
                              enhanced={true}
                            />
                          ))}
                        </div>
                        {courseData.events.length > 20 && (
                          <div className="text-center mt-3">
                            <small className="text-muted">
                              Showing first 20 of {courseData.events.length} events. 
                              View all in the Event Log tab.
                            </small>
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  </div>
                ) : (
                  <Alert color="info">
                    No detailed activity data available for this course.
                  </Alert>
                )}
              </TabPane>

              {/* Events Tab */}
              <TabPane tabId="events">
                <Card>
                  <CardHeader className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">Recent Events ({courseData.events?.length || 0})</h6>
                    <Button 
                      color="primary" 
                      size="sm" 
                      onClick={handleExportCourseData}
                      disabled={!courseData.events || courseData.events.length === 0}
                    >
                      Export CSV
                    </Button>
                  </CardHeader>
                  <CardBody>
                    {courseData.events && courseData.events.length > 0 ? (
                      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <Table responsive hover size="sm">
                          <thead className="sticky-top bg-light">
                            <tr>
                              <th>Date</th>
                              <th>Event Type</th>
                              <th>Term</th>
                              <th>Course Code</th>
                              <th>Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {courseData.events.map((event, index) => (
                              <tr key={event.id || index}>
                                <td>
                                  {event.created_at ? 
                                    new Date(event.created_at).toLocaleDateString() : 
                                    'N/A'
                                  }
                                </td>
                                <td>
                                  <EventTypeBadge eventType={event.event_type} />
                                </td>
                                <td>
                                  {event.term ? 
                                    <Badge color="info" size="sm">{event.term}</Badge> : 
                                    'N/A'
                                  }
                                </td>
                                <td className="font-monospace small">{event.course_code || 'N/A'}</td>
                                <td style={{ maxWidth: '300px' }}>
                                  <MetadataDisplay
                                    metadata={event.metadata}
                                    eventType={event.event_type}
                                    event={event}
                                    showInline={true}
                                    maxInlineLength={60}
                                    enhanced={true}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    ) : (
                      <Alert color="info">
                        No event data available for this course.
                      </Alert>
                    )}
                  </CardBody>
                </Card>
              </TabPane>
            </TabContent>
          </>
        )}
      </ModalBody>

      <ModalFooter>
        <Button color="secondary" onClick={toggle}>
          Close
        </Button>
        {courseData && (
          <Button 
            color="primary" 
            onClick={handleExportCourseData}
            disabled={!courseData.events || courseData.events.length === 0}
          >
            Export All Data
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};

CourseDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  course: PropTypes.shape({
    name: PropTypes.string,
    college: PropTypes.string,
    term: PropTypes.string,
    count: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
  })
};

export default CourseDetailModal;
