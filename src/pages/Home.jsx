import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, CardBody, CardTitle, Button, Badge, Spinner, Alert } from 'reactstrap';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { config } from '../config';
import useSearchStore from '../store/searchStore';
import '../css/Home.css';
import '../css/CourseList.css'; // Import the same CSS file used in Search page

function Home() {
  const [analyticsData, setAnalyticsData] = useState({
    topCourses: [],
    collegeData: [],
    totalCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { college } = useSearchStore();

  useEffect(() => {
    const fetchPopularCourses = async () => {
      try {
        setLoading(true);
        const url = `${config.api.urls.courseReserves}${config.api.endpoints.admin.reports}/top-courses?limit=10` +
          (college ? `&college=${encodeURIComponent(college)}` : '');
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch popular courses');
        }
        
        const data = await response.json();
        setAnalyticsData({
          topCourses: data.topCourses || [],
          collegeData: data.collegeData || [],
          totalCount: data.totalCount || 0
        });
      } catch (err) {
        console.error('Error fetching popular courses:', err);
        setError('Unable to load trending courses at this time');
      } finally {
        setLoading(false);
      }
    };

    fetchPopularCourses();
  }, []);

  const collegeNameConverter = (college) => {
    switch (college) {
      case 'smith':
        return 'Smith College';
      case 'hampshire':
        return 'Hampshire College';
      case 'mtholyoke':
        return 'Mount Holyoke College';
      case 'amherst':
        return 'Amherst College';
      case 'umass':
        return 'UMass Amherst';
      default:
        return college;
    }
  }

  return (
    <Container fluid className="home-container py-4">
      {/* Hero Section */}
      <Row className="justify-content-center hero-section mb-5">
        <Col md="10" lg="8" className="text-center">
          <h1 className="display-4 mb-3">Course Reserves Portal</h1>
          <div className="d-flex justify-content-center gap-3">
            <Button color="primary" size="lg" tag={Link} to={`/search?college=${encodeURIComponent(college)}`}>
              <FontAwesomeIcon icon={faSearch} className="me-2" />
              Browse Courses
            </Button>
          </div>
        </Col>
      </Row>


      {/* Popular Courses Section */}
      <Row className="mb-4">
        <Col md="12" className="mb-4">
          <h2>Trending Courses</h2>
          <p className="text-muted">Most popular courses based on user activity</p>
        </Col>
        
        {loading ? (
          <Col className="text-center my-5">
            <Spinner color="primary" />
            <p className="mt-2">Loading trending courses...</p>
          </Col>
        ) : error ? (
          <Col>
            <Alert color="warning">{error}</Alert>
          </Col>
        ) : analyticsData.topCourses.length === 0 ? (
          <Col>
            <Alert color="info">No course activity data available yet.</Alert>
          </Col>
        ) : (
          analyticsData.topCourses.map((course, index) => (
            <Col md="6" lg="4" key={index} className="mb-4">
              <Card className="course-card h-100">
                <CardBody>
                  <CardTitle tag="h4">{course.name}</CardTitle>
                  <Badge color="primary" className="mb-2">{collegeNameConverter(course.college)}</Badge>
                  <p className="text-muted mb-3">
                    {course.courseId || course.code} • 
                    <span className="mb-3" style={{marginTop  : '1rem'}}>
                      {course?.instructors?.map((instructor, idx) => (
                        <Badge 
                          key={`${course.course_id}-instructor-${idx}`} 
                          color="light" 
                          className="me-1 mb-1"
                          style={{color: '#000', fontSize: '1rem'}}
                        >
                          {instructor}
                        </Badge>
                      ))}
                    </span>
                  </p>
                  <div className="d-flex align-items-center mb-3">
                    <div className="engagement-bar" style={{ width: '100%', height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
                      <div
                        style={{
                          width: `${Math.min(100, (course.count / analyticsData.topCourses[0].count) * 100)}%`,
                          height: '8px',
                          backgroundColor: '#007bff',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                    <span className="ms-2 text-primary fw-bold">{course.count}</span>
                  </div>
                  <Button color="outline-primary" tag={Link} to={`/records?courseListingId=${course.course_id}`} className="w-100">
                    View Course
                  </Button>
                </CardBody>
              </Card>
            </Col>
          ))
        )}
        
        <Col md="12" className="text-center mt-2">
          <Button color="link" tag={Link} to={`/search?college=${encodeURIComponent(college)}`}className="mt-3">
            View All Courses
          </Button>
        </Col>
      </Row>

      {/* College Distribution */}
      {!loading && !error && analyticsData.collegeData.length > 0 && (
        <Row className="mb-5">
          <Col md="12" className="mb-4">
            <h2>Courses by College</h2>
          </Col>
          {analyticsData.collegeData.slice(0, 6).map((college, index) => (
            <Col key={index} md="4" className="mb-3">
              <Card className="college-card h-100">
                <CardBody>
                  <h4>{college.name}</h4>
                  <p className="mb-2">{college.count} courses</p>
                  <div className="progress" style={{ height: '5px' }}>
                    <div
                      className="progress-bar"
                      role="progressbar"
                      style={{
                        width: `${(college.count / analyticsData.totalCount) * 100}%`,
                        backgroundColor: `hsl(${index * 30}, 70%, 50%)`
                      }}
                      aria-valuenow={(college.count / analyticsData.totalCount) * 100}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    />
                  </div>
                  <Button
                    color="link"
                    className="p-0 mt-3"
                    tag={Link}
                    to={`/search?college=${encodeURIComponent(college)}`}
                  >
                    Browse {college.name} courses →
                  </Button>
                </CardBody>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
}

export default Home;
