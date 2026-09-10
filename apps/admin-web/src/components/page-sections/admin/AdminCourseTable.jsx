/**
 * @file AdminCourseTable component
 * @module AdminCourseTable
 * @description Renders administrative courses in a styled table format
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { Table, Badge, Button } from 'reactstrap';
import { FaEye, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';

function AdminCourseTable({ courses, onCourseDetails }) {
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  const getSortedCourses = () => {
    return [...courses].sort((a, b) => {
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';

      // Handle nested values
      if (sortField === 'department') {
        aValue = a.departmentObject?.name || '';
        bValue = b.departmentObject?.name || '';
      } else if (sortField === 'term') {
        aValue = a.courseListingObject?.termObject?.name || '';
        bValue = b.courseListingObject?.termObject?.name || '';
      } else if (sortField === 'instructors') {
        const aInstructors = a.courseListingObject?.instructorObjects || [];
        const bInstructors = b.courseListingObject?.instructorObjects || [];
        aValue = aInstructors.map(i => i.name).join(', ');
        bValue = bInstructors.map(i => i.name).join(', ');
      }

      if (sortDirection === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const isTermActive = (course) => {
    const termStart = course.courseListingObject?.termObject?.startDate;
    const termEnd = course.courseListingObject?.termObject?.endDate;
    
    if (!termStart || !termEnd) return false;
    const now = new Date();
    return now >= new Date(termStart) && now <= new Date(termEnd);
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) return <FaSort size={12} className="ms-1 text-muted" />;
    return sortDirection === 'asc' 
      ? <FaSortUp size={12} className="ms-1 text-primary" /> 
      : <FaSortDown size={12} className="ms-1 text-primary" />;
  };

  const sortedCourses = getSortedCourses();

  return (
    <div className="admin-table-container">
      <Table hover responsive className="custom-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
              <span className="d-inline-flex align-items-center">
                Course Name {renderSortIcon('name')}
              </span>
            </th>
            <th onClick={() => handleSort('courseNumber')} style={{ cursor: 'pointer' }}>
              <span className="d-inline-flex align-items-center">
                Course Number {renderSortIcon('courseNumber')}
              </span>
            </th>
            <th>Section</th>
            <th onClick={() => handleSort('department')} style={{ cursor: 'pointer' }}>
              <span className="d-inline-flex align-items-center">
                Department {renderSortIcon('department')}
              </span>
            </th>
            <th onClick={() => handleSort('term')} style={{ cursor: 'pointer' }}>
              <span className="d-inline-flex align-items-center">
                Term {renderSortIcon('term')}
              </span>
            </th>
            <th onClick={() => handleSort('instructors')} style={{ cursor: 'pointer' }}>
              <span className="d-inline-flex align-items-center">
                Instructors {renderSortIcon('instructors')}
              </span>
            </th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedCourses.map((course) => {
            const active = isTermActive(course);
            const courseId = course.courseListingObject?.id || course.id;

            return (
              <tr key={course.id}>
                <td className="fw-medium">{course.name || 'Untitled Course'}</td>
                <td>{course.courseNumber || 'N/A'}</td>
                <td>
                  {course.sectionName ? (
                    <Badge color="secondary" pill>
                      {course.sectionName}
                    </Badge>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>{course.departmentObject?.name || 'N/A'}</td>
                <td>{course.courseListingObject?.termObject?.name || 'N/A'}</td>
                <td>
                  {course.courseListingObject?.instructorObjects?.map(i => i.name).join(', ') || 'N/A'}
                </td>
                <td>
                  <Badge 
                    color={active ? 'success' : 'secondary'} 
                    pill
                    className="px-3 py-1"
                  >
                    {active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td>
                  <Button
                    color="primary"
                    size="sm"
                    outline
                    className="d-flex align-items-center gap-1"
                    onClick={() => onCourseDetails && onCourseDetails(courseId)}
                  >
                    <FaEye size={14} /> Details
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

AdminCourseTable.propTypes = {
  courses: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      // ...other props
    })
  ).isRequired,
  onCourseDetails: PropTypes.func,
};

export default AdminCourseTable;