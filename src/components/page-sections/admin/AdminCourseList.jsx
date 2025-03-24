/**
 * @file AdminCourseList component
 * @module AdminCourseList
 * @description Renders a list of administrative courses in a table with an optional "scroll to top" button.
 * Attaches a scroll listener to display the button when needed.
 *
 * @requires react
 * @requires prop-types
 * @requires reactstrap
 * @requires ./AdminCourseTable
 */

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import AdminCourseTable from './AdminCourseTable';

/**
 * Admin course list component
 *
 * Displays a table of administrative courses and shows a "scroll to top" button
 * when the user scrolls beyond a certain threshold.
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
function AdminCourseList({ courses }) {
  const [showScrollTop, setShowScrollTop] = useState(false);

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

  if (!courses || courses.length === 0) {
    return <p>No admin courses found.</p>;
  }

  return (
    <div className="mt-4">
      <AdminCourseTable courses={courses} />

      {showScrollTop && (
        <Button
          color="secondary"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '1000',
          }}
          onClick={scrollToTop}
        >
          ↑ Top
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