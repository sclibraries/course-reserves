import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody, Table, Badge, Button, Input } from 'reactstrap';
import { CAMPUS_COLORS, COLORS } from '../constants';
import CourseDetailModal from '../modals/CourseDetailModal';

/**
 * Table component for displaying all courses with sorting and pagination
 */
const CoursesTable = ({
  processedCourses,
  courseSearchTerm,
  campusFilter,
  termFilter,
  courseSortConfig,
  setCourseSortConfig,
  coursesPagination,
  setCoursesPagination,
  setCampusFilter,
  setTermFilter,
  setCourseSearchTerm
}) => {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseDetailModalOpen, setCourseDetailModalOpen] = useState(false);

  // Filter and sort courses
  const filteredAndSortedCourses = useMemo(() => {
    try {
      // First filter courses based on search term, campus, and term
      const filtered = processedCourses.filter(course => {
        const matchesSearch = !courseSearchTerm || 
          (course.name && course.name.toLowerCase().includes(courseSearchTerm.toLowerCase()));
        const matchesCampus = !campusFilter || course.college === campusFilter;
        const matchesTerm = !termFilter || course.term === termFilter;
        
        return matchesSearch && matchesCampus && matchesTerm;
      });
      
      // Then sort the filtered courses
      return [...filtered].sort((a, b) => {
        // Handle string fields (name, college, term)
        if (['name', 'college', 'term'].includes(courseSortConfig.key)) {
          const valueA = (a[courseSortConfig.key] || '').toLowerCase();
          const valueB = (b[courseSortConfig.key] || '').toLowerCase();
          
          if (valueA < valueB) {
            return courseSortConfig.direction === 'asc' ? -1 : 1;
          }
          if (valueA > valueB) {
            return courseSortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        }
        
        // Handle numeric field (count)
        const countA = Number(a.count) || 0;
        const countB = Number(b.count) || 0;
        
        return courseSortConfig.direction === 'asc' 
          ? countA - countB 
          : countB - countA;
      });
    } catch (err) {
      console.error('Error filtering/sorting courses:', err);
      return [];
    }
  }, [processedCourses, courseSearchTerm, campusFilter, termFilter, courseSortConfig]);

  // Calculate total count for percentage calculations
  const totalCount = useMemo(() => {
    return processedCourses.reduce((sum, course) => sum + (Number(course.count) || 0), 0);
  }, [processedCourses]);

  // Pagination logic
  const paginatedCourses = useMemo(() => {
    const startIndex = (coursesPagination.page - 1) * coursesPagination.pageSize;
    const endIndex = startIndex + coursesPagination.pageSize;
    
    return filteredAndSortedCourses.slice(startIndex, endIndex);
  }, [filteredAndSortedCourses, coursesPagination.page, coursesPagination.pageSize]);

  // Handle column sorting
  const handleSortRequest = (key) => {
    let direction = 'asc';
    if (courseSortConfig.key === key && courseSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setCourseSortConfig({ key, direction });
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    setCoursesPagination(prev => ({ ...prev, page: newPage }));
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (e) => {
    setCoursesPagination({
      page: 1, // Reset to first page when changing page size
      pageSize: Number(e.target.value)
    });
  };

  // Calculate total pages
  const totalPages = Math.ceil(filteredAndSortedCourses.length / coursesPagination.pageSize);

  // If no matching courses, show message
  if (filteredAndSortedCourses.length === 0) {
    return (
      <Card className="shadow-sm mt-4">
        <CardHeader className="bg-light">
          <h5 className="mb-0">All Courses Access Report</h5>
        </CardHeader>
        <CardBody className="text-center p-5">
          <p>No courses match your current filter criteria.</p>
          <Button color="primary" onClick={() => {
            setCampusFilter('');
            setTermFilter('');
            setCourseSearchTerm('');
          }}>
            Clear Filters
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm mt-4">
      <CardHeader className="bg-light d-flex justify-content-between align-items-center">
        <h5 className="mb-0">All Courses Access Report</h5>
        <div className="text-muted small">
          Showing {filteredAndSortedCourses.length} course{filteredAndSortedCourses.length !== 1 ? 's' : ''}
        </div>
      </CardHeader>
      <CardBody>
        <div className="table-responsive">
          <Table striped hover bordered>
            <thead>
              <tr>
                <th 
                  onClick={() => handleSortRequest('name')} 
                  style={{ cursor: 'pointer' }}
                  className="position-relative"
                >
                  Course Name 
                  {courseSortConfig.key === 'name' && (
                    <span className="ms-1">
                      {courseSortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th 
                  onClick={() => handleSortRequest('college')} 
                  style={{ cursor: 'pointer', width: '120px' }}
                >
                  Campus 
                  {courseSortConfig.key === 'college' && (
                    <span className="ms-1">
                      {courseSortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th 
                  onClick={() => handleSortRequest('term')} 
                  style={{ cursor: 'pointer', width: '140px' }}
                >
                  Term 
                  {courseSortConfig.key === 'term' && (
                    <span className="ms-1">
                      {courseSortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th 
                  onClick={() => handleSortRequest('count')} 
                  style={{ cursor: 'pointer', width: '120px', textAlign: 'center' }}
                >
                  Access Count 
                  {courseSortConfig.key === 'count' && (
                    <span className="ms-1">
                      {courseSortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
                <th style={{ width: '120px' }}>Percentage</th>
                <th style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCourses.map((course, index) => {
                // Calculate percentage of total access
                const percentage = totalCount > 0
                  ? ((Number(course.count) || 0) / totalCount * 100).toFixed(1)
                  : '0.0';
                  
                return (
                  <tr key={`course-${course.college}-${course.name}-${index}`}>
                    <td className="text-wrap">{course.name || 'Unknown Course'}</td>
                    <td>
                      {course.college ? (
                        <Badge 
                          color="primary" 
                          style={{ 
                            backgroundColor: CAMPUS_COLORS[course.college] || '#666'
                          }}
                        >
                          {course.college}
                        </Badge>
                      ) : 'Unknown'}
                    </td>
                    <td>{course.term || 'N/A'}</td>
                    <td className="text-center">{course.count}</td>
                    <td>
                      <div className="d-flex align-items-center">
                        <div className="me-2">{percentage}%</div>
                        <div className="progress" style={{width: '60px', height: '8px'}}>
                          <div 
                            className="progress-bar" 
                            role="progressbar" 
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: course.college ? 
                                CAMPUS_COLORS[course.college] : COLORS[index % COLORS.length]
                            }} 
                            aria-valuenow={percentage} 
                            aria-valuemin="0" 
                            aria-valuemax="100"
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Button
                        color="primary"
                        size="sm"
                        onClick={() => {
                          setSelectedCourse(course);
                          setCourseDetailModalOpen(true);
                        }}
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div>
              Showing {((coursesPagination.page - 1) * coursesPagination.pageSize) + 1}-
              {Math.min(coursesPagination.page * coursesPagination.pageSize, filteredAndSortedCourses.length)} of {filteredAndSortedCourses.length} courses
            </div>
            <div className="d-flex align-items-center">
              <span className="me-2">Rows per page:</span>
              <Input
                type="select"
                bsSize="sm"
                value={coursesPagination.pageSize}
                onChange={handleRowsPerPageChange}
                style={{width: '70px'}}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </Input>
              
              <Button 
                color="primary" 
                size="sm" 
                onClick={() => handlePageChange(coursesPagination.page - 1)}
                disabled={coursesPagination.page === 1}
                className="ms-2"
              >
                Previous
              </Button>
              
              {/* Page number indicator */}
              <span className="mx-2">
                Page {coursesPagination.page} of {totalPages}
              </span>
              
              <Button
                color="primary"
                size="sm"
                onClick={() => handlePageChange(coursesPagination.page + 1)}
                disabled={coursesPagination.page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Course Detail Modal */}
        {selectedCourse && (
          <CourseDetailModal 
            isOpen={courseDetailModalOpen}
            toggle={() => setCourseDetailModalOpen(!courseDetailModalOpen)}
            course={selectedCourse}
          />
        )}
      </CardBody>
      
      {/* Course Detail Modal */}
      <CourseDetailModal
        isOpen={courseDetailModalOpen}
        toggle={() => setCourseDetailModalOpen(false)}
        course={selectedCourse}
      />
    </Card>
  );
};

CoursesTable.propTypes = {
  processedCourses: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      college: PropTypes.string,
      term: PropTypes.string
    })
  ).isRequired,
  courseSearchTerm: PropTypes.string,
  campusFilter: PropTypes.string,
  termFilter: PropTypes.string,
  availableTerms: PropTypes.arrayOf(PropTypes.string).isRequired,
  campuses: PropTypes.arrayOf(PropTypes.string).isRequired,
  courseSortConfig: PropTypes.shape({
    key: PropTypes.string.isRequired,
    direction: PropTypes.oneOf(['asc', 'desc']).isRequired
  }).isRequired,
  setCourseSortConfig: PropTypes.func.isRequired,
  coursesPagination: PropTypes.shape({
    page: PropTypes.number.isRequired,
    pageSize: PropTypes.number.isRequired
  }).isRequired,
  setCoursesPagination: PropTypes.func.isRequired,
  setCampusFilter: PropTypes.func.isRequired,
  setTermFilter: PropTypes.func.isRequired,
  setCourseSearchTerm: PropTypes.func.isRequired
};

CoursesTable.defaultProps = {
  courseSearchTerm: '',
  campusFilter: '',
  termFilter: ''
};

export default CoursesTable;