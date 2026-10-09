/**
 * @file AdminCourseList component
 * @module AdminCourseList
 * @description Renders a list of administrative courses with configurable view options
 * (table or card) and improved UI/UX elements including scroll-to-top button.
 *
 * @requires react
 * @requires prop-types
 * @requires reactstrap
 * @requires react-icons/fa
 * @requires ./AdminCourseTable
 * @requires ./AdminCourseCard
 * @requires ../../../css/AdminComponents.css
 */

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, ButtonGroup } from 'reactstrap';
import { FaTable, FaTh, FaArrowUp, FaSearch } from 'react-icons/fa';
import AdminCourseTable from './AdminCourseTable';
import AdminCourseCard from './AdminCourseCard';
import '../../../css/AdminComponents.css';

/**
 * Admin course list component
 *
 * Displays administrative courses in either table or card view with
 * enhanced user experience features like view toggle and scroll-to-top.
 *
 * @component
 * @example
 * const coursesArray = [{ id: 'abc123', name: 'Example Course' }];
 *
 * return (
 *   <AdminCourseList courses={coursesArray} />
 * );
 *
 * @param {Object} props - Component props
 * @param {Array} props.courses - Array of course objects
 * @param {string} props.courses[].id - Unique course identifier
 * @param {Function} [props.onCourseDetails] - Optional callback for course details
 * @returns {JSX.Element} The rendered course list.
 */
function AdminCourseList({ courses, onCourseDetails }) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'

  // Listen for window scroll events to toggle the "scroll to top" button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /**
   * Scroll smoothly to the top of the page
   * @function scrollToTop
   * @returns {void}
   */
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Handle details click for a specific course
   * @function handleDetailsClick
   * @param {string} courseId - ID of the course to show details for
   * @returns {void}
   */
  const handleDetailsClick = (courseId) => {
    if (onCourseDetails) {
      onCourseDetails(courseId);
    }
  };

  if (!courses || courses.length === 0) {
    return (
      <div className="empty-state fade-in">
        <div className="empty-state-icon">
          <FaSearch />
        </div>
        <h3>No courses found</h3>
        <p className="text-muted">Try adjusting your search criteria or filters.</p>
      </div>
    );
  }

  return (
    <div className="admin-course-list mt-4 fade-in">
      <div className="view-toggle-container mb-3">
        <ButtonGroup>
          <Button
            className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            aria-label="Table view"
          >
            <FaTable /> Table View
          </Button>
          <Button
            className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
            onClick={() => setViewMode('card')}
            aria-label="Card view"
          >
            <FaTh /> Card View
          </Button>
        </ButtonGroup>
      </div>

      {viewMode === 'table' ? (
        <AdminCourseTable courses={courses} onCourseDetails={handleDetailsClick} />
      ) : (
        <div className="course-cards-container">
          {courses.map(course => (
            <AdminCourseCard
              key={course.id}
              course={course}
              onDetailsClick={handleDetailsClick}
            />
          ))}
        </div>
      )}

      {showScrollTop && (
        <Button
          className="scroll-top-btn"
          onClick={scrollToTop}
          aria-label="Scroll to top"
        >
          <FaArrowUp />
        </Button>
      )}
    </div>
  );
}

AdminCourseList.propTypes = {
  courses: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
    })
  ).isRequired,
  onCourseDetails: PropTypes.func,
};

export default AdminCourseList;