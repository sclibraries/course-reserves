/**
 * @file AdminCourseTable component
 * @module AdminCourseTable
 * @description Displays course data in a sortable, responsive table format with status indicators
 * and action buttons. Uses React Table for columns and row handling.
 * @requires react
 * @requires prop-types
 * @requires react-table
 * @requires reactstrap
 * @requires react-router-dom
 * @requires ../../../types/courseTypes
 * @requires ../../../store/courseManagementStore
 * @requires ../../../config
 */

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTable } from 'react-table';
import { Table, Button } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import useCourseManagementStore from '../../../store/courseManagementStore';
import { config } from '../../../config';
import { courseShape } from '../../../types/courseTypes';

/**
 * Status badge component for displaying course term status
 * 
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isActive - Whether the course is currently active
 * @returns {JSX.Element} Badge showing active/inactive status with appropriate color
 */
const StatusBadge = ({ isActive }) => (
  <span className={`badge ${isActive ? 'text-bg-success' : 'text-bg-danger'}`}>
    {isActive ? 'Active' : 'Inactive'}
  </span>
);

StatusBadge.propTypes = {
  isActive: PropTypes.bool.isRequired,
};

/**
 * Custom cell component for rendering actions for each row
 * 
 * @component
 * @param {Object} props - Cell props from react-table
 * @param {Object} props.row - Row data containing the original course object
 * @returns {JSX.Element} Action buttons for the course row
 */
const ActionCell = ({ row }) => {
  const navigate = useNavigate();
  const { setCourse } = useCourseManagementStore();
  const courseListingId = row.original.courseListingObject?.id || row.original.id;

  /**
   * Generates a URL to view the course in FOLIO
   * 
   * @function
   * @param {string} id - Course ID
   * @returns {string} Full FOLIO course URL
   */
  const getFOLIOCourseLink = (id) => {
    console.log(config)
    return `${config.api.folioBaseUrl}${config.api.endpoints.folioApplicationEndpoints.courses}${id}`;
  };

  /**
   * Navigate to electronic resource management for this course
   * 
   * @function
   * @returns {void}
   */
  const handleManageResources = () => {
    setCourse(row.original);
    navigate(`/admin/electronic/${courseListingId}`);
  };

  return (
    <div className="d-flex gap-2">
      <a
        href={getFOLIOCourseLink(row.original.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary btn-sm"
      >
        View FOLIO Course
      </a>
      <Button
        color="warning"
        size="sm"
        onClick={handleManageResources}
        disabled={!courseListingId}
      >
        Manage Resources
      </Button>
    </div>
  );
};

ActionCell.propTypes = {
  row: PropTypes.shape({
    original: courseShape.isRequired,
  }).isRequired,
};

/**
 * Determines if a course is currently active based on term dates
 * 
 * @function
 * @param {Object} termObject - Term data containing dates
 * @param {string} [termObject.startDate] - ISO date string for term start
 * @param {string} [termObject.endDate] - ISO date string for term end
 * @returns {boolean} Whether the current date falls within the term dates
 */
const isTermActive = (termObject) => {
  const termStart = termObject?.startDate;
  const termEnd = termObject?.endDate;
  
  if (!termStart || !termEnd) return false;
  
  const now = new Date();
  return now >= new Date(termStart) && now <= new Date(termEnd);
};

/**
 * Create table columns configuration
 * 
 * @function
 * @param {Function} navigate - React Router navigate function
 * @param {Function} setCourse - Store function to set the current course
 * @returns {Array} Column definitions for react-table
 */
const createColumns = () => [
  {
    Header: 'Course Name',
    accessor: 'name',
  },
  {
    Header: 'Course Number',
    accessor: 'courseNumber',
  },
  {
    Header: 'Department',
    accessor: (row) => row.departmentObject?.name || 'Unknown Department',
    id: 'department',
  },
  {
    Header: 'Instructor(s)',
    accessor: (row) => {
      const instructors = row.courseListingObject?.instructorObjects || [];
      return instructors.map((i) => i.name).join(', ') || 'N/A';
    },
    id: 'instructors',
  },
  {
    Header: 'Term',
    accessor: (row) => row.courseListingObject?.termObject?.name || 'Unknown Term',
    id: 'term',
  },
  {
    Header: 'Location',
    accessor: (row) =>
      row.courseListingObject?.locationObject?.name ||
      row.courseListingObject?.locationObject?.code ||
      'Unknown Location',
    id: 'location',
  },
  {
    Header: 'Status',
    accessor: (row) => {
      const termObject = row.courseListingObject?.termObject;
      const active = isTermActive(termObject);
      return <StatusBadge isActive={active} />;
    },
    id: 'status',
  },
  {
    Header: 'Actions',
    Cell: ActionCell,
    id: 'actions',
  },
];

/**
 * Admin course table component
 * 
 * Displays a responsive table of admin courses with filtering, 
 * status indicators, and action buttons.
 * 
 * @component
 * @example
 * const courses = [
 *   { 
 *     id: '1234', 
 *     name: 'Introduction to React',
 *     courseNumber: 'CS-101',
 *     courseListingObject: { ... }
 *   }
 * ];
 * 
 * return <AdminCourseTable courses={courses} />;
 * 
 * @param {Object} props - Component props
 * @param {Array} props.courses - Array of course objects to display
 * @returns {JSX.Element} Responsive table component with course data
 */
const AdminCourseTable = ({ courses }) => {
  const navigate = useNavigate();
  const { setCourse } = useCourseManagementStore();

  // Memoize columns definition to avoid unnecessary re-renders
  const columns = useMemo(
    () => createColumns(navigate, setCourse),
    [navigate, setCourse]
  );

  // Initialize react-table
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({ columns, data: courses });

  // Early return for empty courses array
  if (!courses?.length) {
    return <p>No admin courses found.</p>;
  }

  return (
    <Table size="sm" {...getTableProps()} bordered hover responsive striped>
      <thead>
        {headerGroups.map((headerGroup) => {
          const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps();
          return (
            <tr key={key} {...headerGroupProps}>
              {headerGroup.headers.map((column) => {
                const { key, ...headerProps } = column.getHeaderProps();
                return (
                  <th key={key} {...headerProps}>
                    {column.render('Header')}
                  </th>
                );
              })}
            </tr>
          );
        })}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row) => {
          prepareRow(row);
          const { key, ...rowProps } = row.getRowProps();
          return (
            <tr key={key} {...rowProps}>
              {row.cells.map((cell) => {
                const { key, ...cellProps } = cell.getCellProps();
                return (
                  <td key={key} {...cellProps}>
                    {cell.render('Cell')}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
};

AdminCourseTable.propTypes = {
  courses: PropTypes.arrayOf(courseShape).isRequired,
};

export default AdminCourseTable;