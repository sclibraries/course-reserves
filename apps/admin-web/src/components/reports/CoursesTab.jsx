import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Alert, Spinner } from 'reactstrap';

// Import utility functions and components
import { 
  filterValidTerms, 
  sortTerms,
  normalizeCourseData,
  getCoursesByTerm,
  getCoursesByCampus
} from './utils/courseDataUtils';
import CoursesByTermChart from './charts/CoursesByTermChart';
import CoursesByCampusChart from './charts/CoursesByCampusChart';
import CollegeAccessChart from './charts/CollegeAccessChart';
import CoursesTable from './tables/CoursesTable';

/**
 * CoursesTab component displaying course access analytics
 */
const CoursesTab = ({ analyticsData, loading, error }) => {
  // State management
  const [courseSearchTerm, setCourseSearchTerm] = useState('');
  const [courseSortConfig, setCourseSortConfig] = useState({ key: 'count', direction: 'desc' });
  const [coursesPagination, setCoursesPagination] = useState({ page: 1, pageSize: 25 });
  const [campusFilter, setCampusFilter] = useState('');
  const [activeCampusTab, setActiveCampusTab] = useState('all');
  const [termFilter, setTermFilter] = useState('');
  const [activeTermTab, setActiveTermTab] = useState('all');

  // Reset pagination when filters change

  // Processed data - move complex data processing to useMemo hooks
  const processedCourses = useMemo(() => 
    normalizeCourseData(analyticsData.allCourses), 
    [analyticsData.allCourses]
  );

  const availableTerms = useMemo(() => {
    // First try to use terms from analytics data
    if (analyticsData.terms && Array.isArray(analyticsData.terms) && analyticsData.terms.length) {
      return sortTerms(filterValidTerms(analyticsData.terms));
    }
    
    // Otherwise extract from courses data
    const termsFromCourses = [...new Set(
      processedCourses
        .filter(course => course.term)
        .map(course => course.term)
    )];
    
    return sortTerms(filterValidTerms(termsFromCourses));
  }, [analyticsData.terms, processedCourses]);

  // Courses by term and campus
  const coursesByTerm = useMemo(() => 
    getCoursesByTerm(processedCourses, availableTerms), 
    [processedCourses, availableTerms]
  );
  
  const coursesByCampus = useMemo(() => 
    getCoursesByCampus(processedCourses), 
    [processedCourses]
  );
  
  // Campus list for tabs and filters
  const campuses = useMemo(() => 
    ['all', ...Object.keys(coursesByCampus).filter(c => c !== 'all')], 
    [coursesByCampus]
  );

  // Error handling
  if (error) {
    return (
      <Alert color="danger">
        <h4 className="alert-heading">Error Loading Course Data</h4>
        <p>{error}</p>
      </Alert>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="text-center my-5">
        <Spinner color="primary" />
        <p className="mt-2">Loading course analytics...</p>
      </div>
    );
  }

  return (
    <div>
      {processedCourses.length === 0 ? (
        <Alert color="info">
          No course data available. Please adjust your filters or try again later.
        </Alert>
      ) : (
        <>
          {/* Top Courses By Term Chart */}
          <CoursesByTermChart 
            coursesByTerm={coursesByTerm}
            availableTerms={availableTerms}
            activeTermTab={activeTermTab}
            setActiveTermTab={setActiveTermTab}
          />

          {/* Top Courses by Campus Chart */}
          <CoursesByCampusChart
            coursesByCampus={coursesByCampus}
            campuses={campuses}
            activeCampusTab={activeCampusTab}
            setActiveCampusTab={setActiveCampusTab}
          />
          
          {/* College Access Chart */}
          <CollegeAccessChart collegeData={analyticsData.collegeData} />
          
          {/* Courses Table */}
          <CoursesTable 
            processedCourses={processedCourses}
            courseSearchTerm={courseSearchTerm}
            campusFilter={campusFilter}
            termFilter={termFilter}
            availableTerms={availableTerms}
            campuses={campuses}
            courseSortConfig={courseSortConfig} 
            setCourseSortConfig={setCourseSortConfig}
            coursesPagination={coursesPagination}
            setCoursesPagination={setCoursesPagination}
            setCampusFilter={setCampusFilter}
            setTermFilter={setTermFilter}
            setCourseSearchTerm={setCourseSearchTerm}
          />
        </>
      )}
    </div>
  );
};

CoursesTab.propTypes = {
  analyticsData: PropTypes.shape({
    collegeData: PropTypes.arrayOf(PropTypes.shape({
      college: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    })),
    topCourses: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      college: PropTypes.string,
      term: PropTypes.string
    })),
    allCourses: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      college: PropTypes.string,
      term: PropTypes.string
    })),
    terms: PropTypes.arrayOf(PropTypes.string),
    totalCount: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
  }),
  loading: PropTypes.bool,
  error: PropTypes.string
};

export default CoursesTab;