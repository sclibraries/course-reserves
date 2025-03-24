// src/components/AdminCourseList.jsx
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {  Button } from 'reactstrap';
import AdminCourseTable from './AdminCourseTable';

function AdminCourseList({ courses }) {
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Attach a scroll listener to determine when to show the "scroll to top" button.
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
  onCourseDetails: PropTypes.func, // Optional callback if needed
};

export default AdminCourseList;
