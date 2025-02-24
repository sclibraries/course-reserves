import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTable } from 'react-table';
import { Table, Button } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import useCourseManagementStore from '../store/courseManagementStore';

// Define the course shape for reuse
const courseShape = PropTypes.shape({
  id: PropTypes.string,
  name: PropTypes.string,
  courseNumber: PropTypes.string,
  departmentObject: PropTypes.shape({
    name: PropTypes.string,
  }),
  courseListingObject: PropTypes.shape({
    id: PropTypes.string,
    courseTypeObject: PropTypes.shape({
      name: PropTypes.string,
      description: PropTypes.string,
    }),
    instructorObjects: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
    })),
    termObject: PropTypes.shape({
      name: PropTypes.string,
      startDate: PropTypes.string,
      endDate: PropTypes.string,
    }),
    locationObject: PropTypes.shape({
      name: PropTypes.string,
      code: PropTypes.string,
    }),
  }),
});

// Custom Cell component for Actions column
const ActionCell = ({ row }) => {
  const navigate = useNavigate();
  const { setCourse } = useCourseManagementStore();
  const courseListingId = row.original.courseListingObject?.id || row.original.id;

  const getFOLIOCourseLink = (id) => {
    return `https://fivecolleges.folio.ebsco.com/cr/courses/${id}`;
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
        onClick={() => {
          setCourse(row.original);
          navigate(`/admin/electronic/${courseListingId}`);
        }}
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

const AdminCourseTable = ({ courses }) => {
  const navigate = useNavigate();
  const { setCourse } = useCourseManagementStore();

  const columns = useMemo(
    () => [
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
        Header: 'Course Type',
        accessor: (row) =>
          row.courseListingObject?.courseTypeObject?.name ||
          row.courseListingObject?.courseTypeObject?.description ||
          'Unknown Type',
        id: 'courseType',
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
        Header: 'Term Start',
        accessor: (row) =>
          row.courseListingObject?.termObject?.startDate
            ? row.courseListingObject.termObject.startDate.substring(0, 10)
            : 'N/A',
        id: 'termStart',
      },
      {
        Header: 'Term End',
        accessor: (row) =>
          row.courseListingObject?.termObject?.endDate
            ? row.courseListingObject.termObject.endDate.substring(0, 10)
            : 'N/A',
        id: 'termEnd',
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
          const termStart = row.courseListingObject?.termObject?.startDate;
          const termEnd = row.courseListingObject?.termObject?.endDate;
          if (!termStart || !termEnd) {
            return <span className="badge text-bg-danger">Inactive</span>;
          }
          const now = new Date();
          const isActive = now >= new Date(termStart) && now <= new Date(termEnd);
          return (
            <span className={`badge ${isActive ? 'text-bg-success' : 'text-bg-danger'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          );
        },
        id: 'status',
      },
      {
        Header: 'Actions',
        Cell: ActionCell,
        id: 'actions',
      },
    ],
    [navigate, setCourse]
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({ columns, data: courses });

  if (!courses?.length) {
    return <p>No admin courses found.</p>;
  }

  return (
    <Table {...getTableProps()} bordered hover responsive>
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