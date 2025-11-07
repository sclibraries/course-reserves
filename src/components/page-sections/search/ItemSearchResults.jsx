/**
 * @file Item search results display component
 * @module ItemSearchResults
 * @description Displays search results for items in courses with course details
 */
import { useState } from 'react';
import { Table, Spinner, Alert } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { buildFriendlyCourseUrl } from '../../../util/urlHelpers';
import { trackingService } from '../../../services/trackingService';
import useSearchStore from '../../../store/searchStore';
import useRecordStore from '../../../store/recordStore';
import '../../../css/ItemSearchResults.css';

/**
 * Extracts the primary author from contributors
 * @param {Object|Array} contributors - Contributors object or array from API response
 * @param {boolean} isElectronic - Whether this is an electronic resource
 * @returns {string} - Primary author name or 'N/A'
 */
const getPrimaryAuthor = (contributors, isElectronic = false) => {
  if (!contributors) return 'N/A';
  
  // Handle electronic resources (different structure)
  if (isElectronic) {
    return contributors || 'N/A';
  }
  
  // Handle direct array (new structure)
  if (Array.isArray(contributors)) {
    if (contributors.length === 0) return 'N/A';
    const primaryAuthor = contributors.find(c => c.primary === 'true' || c.primary === true);
    if (primaryAuthor) return primaryAuthor.name;
    return contributors[0].name || 'N/A';
  }
  
  // Handle old structure with .item property
  if (contributors.item) {
    if (Array.isArray(contributors.item)) {
      if (contributors.item.length === 0) return 'N/A';
      const primaryAuthor = contributors.item.find(c => c.primary === 'true' || c.primary === true);
      if (primaryAuthor) return primaryAuthor.name;
      return contributors.item[0].name || 'N/A';
    }
    return contributors.item.name || 'N/A';
  }
  
  return 'N/A';
};

/**
 * Extracts instructor name from course data
 * @param {Object} course - Course object from API response
 * @param {boolean} isElectronic - Whether this is an electronic resource
 * @returns {string} - Instructor name or 'N/A'
 */
const getInstructorName = (course, isElectronic = false) => {
  if (!course) return 'N/A';
  
  // Handle electronic resources (different structure)
  if (isElectronic) {
    if (course.instructor) return course.instructor;
    return 'N/A';
  }
  
  if (!course.courseListingObject?.instructorObjects) return 'N/A';
  
  const instructors = course.courseListingObject.instructorObjects;
  
  // Handle array of instructors (new structure)
  if (Array.isArray(instructors)) {
    if (instructors.length === 0) return 'N/A';
    return instructors.map(i => i.name).join(', ');
  }
  
  // Handle old structure with .item property
  if (instructors.item) {
    if (Array.isArray(instructors.item)) {
      return instructors.item.map(i => i.name).join(', ');
    }
    return instructors.item.name || 'N/A';
  }
  
  return 'N/A';
};

/**
 * ItemSearchResults component - displays reserve items with course information
 */
function ItemSearchResults({ reserves, loading, error }) {
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const navigate = useNavigate();
  const college = useSearchStore((state) => state.college);
  const { setRecord } = useRecordStore();

  /**
   * Handles navigation to course page when course name is clicked
   */
  const handleCourseClick = (reserve) => {
    const { course } = reserve;
    if (!course) return;

    const courseListingId = course.courseListingId;
    
    // Set the record in the store (just like CourseCard does)
    setRecord(courseListingId);
    
    // Save scroll position for when user returns
    sessionStorage.setItem('searchScrollPosition', window.scrollY);
    
    // Track the navigation event
    trackingService.trackEvent({
      college: college,
      event_type: "course_access_from_item_search",
      course_id: courseListingId,
      term: course.courseListingObject?.termObject?.name || 'Unknown Term',
      course_name: course.name,
      course_code: `${course.courseNumber}${course.sectionName ? `-${course.sectionName}` : ''}`,
      instructor: course.courseListingObject?.instructorObjects?.map(i => ({ name: i.name })) || [],
      metadata: {
        department: course.departmentObject?.name || 'Unknown Department',
        location: course.courseListingObject?.locationObject?.name || 'Unknown Location',
        action: "viewed course from item search",
        item_title: reserve.copiedItem?.title || 'Unknown Item'
      },
    }).catch((error) => console.error("Error tracking course access:", error));

    // Build and navigate to friendly course URL
    const targetUrl = buildFriendlyCourseUrl(course);
    navigate(targetUrl);
  };

  if (loading) {
    return (
      <div className="text-center my-5">
        <Spinner color="primary" />
        <p className="mt-3">Loading items...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert color="danger" className="my-3">
        <h5>Error Loading Items</h5>
        <p>{error}</p>
      </Alert>
    );
  }

  if (!reserves || reserves.length === 0) {
    return (
      <Alert color="info" className="my-3">
        No items found matching your search criteria.
      </Alert>
    );
  }

  /**
   * Handles sorting of table columns
   */
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  /**
   * Gets nested property value for sorting
   */
  const getPropertyValue = (reserve, field) => {
    switch (field) {
      case 'title':
        // Both use copiedItem.title
        return reserve.copiedItem?.title || '';
      case 'author':
        // Both use copiedItem.contributors
        return getPrimaryAuthor(reserve.copiedItem?.contributors, false);
      case 'callNumber':
        // Electronic resources may not have call numbers
        return reserve.copiedItem?.callNumber || '';
      case 'courseName':
        return reserve.course?.name || '';
      case 'courseNumber':
        return reserve.course?.courseNumber || '';
      case 'section':
        return reserve.course?.sectionName || '';
      case 'instructor':
        return getInstructorName(reserve.course, false);
      default:
        return '';
    }
  };

  /**
   * Sorts reserves based on current sort field and direction
   */
  const sortedReserves = [...reserves].sort((a, b) => {
    if (!sortField) return 0;
    
    const aValue = getPropertyValue(a, sortField).toLowerCase();
    const bValue = getPropertyValue(b, sortField).toLowerCase();
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  /**
   * Renders sort indicator icon
   */
  const renderSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="item-search-results">
      <div className="results-header mb-3">
        <h4>Reserve Items ({reserves.length})</h4>
        <p className="text-muted">
          Showing reserve items and their associated courses
        </p>
      </div>

      <div className="table-responsive">
        <Table striped bordered hover className="item-results-table">
          <thead>
            <tr>
              <th 
                onClick={() => handleSort('title')} 
                className="sortable"
                style={{ cursor: 'pointer' }}
              >
                Title{renderSortIcon('title')}
              </th>
              <th 
                onClick={() => handleSort('author')} 
                className="sortable"
                style={{ cursor: 'pointer' }}
              >
                Author{renderSortIcon('author')}
              </th>
              <th 
                onClick={() => handleSort('callNumber')} 
                className="sortable"
                style={{ cursor: 'pointer' }}
              >
                Call Number{renderSortIcon('callNumber')}
              </th>
              <th 
                onClick={() => handleSort('courseName')} 
                className="sortable"
                style={{ cursor: 'pointer' }}
              >
                Course Name{renderSortIcon('courseName')}
              </th>
              <th 
                onClick={() => handleSort('courseNumber')} 
                className="sortable"
                style={{ cursor: 'pointer' }}
              >
                Course Number{renderSortIcon('courseNumber')}
              </th>
              <th 
                onClick={() => handleSort('section')} 
                className="sortable"
                style={{ cursor: 'pointer' }}
              >
                Section{renderSortIcon('section')}
              </th>
              <th 
                onClick={() => handleSort('instructor')} 
                className="sortable"
                style={{ cursor: 'pointer' }}
              >
                Instructor{renderSortIcon('instructor')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedReserves.map((reserve, index) => {
              const isElectronic = reserve.isElectronic;
              const title = reserve.copiedItem?.title || 'N/A';
              const author = getPrimaryAuthor(reserve.copiedItem?.contributors, false);
              const callNumber = reserve.copiedItem?.callNumber || (isElectronic ? 'Electronic' : 'N/A');
              
              return (
                <tr key={reserve.id || `reserve-${index}`}>
                  <td>
                    {title}
                    {isElectronic && reserve.copiedItem?.permanentLocationId && (
                      <span 
                        className="ms-2 badge bg-info text-dark" 
                        style={{ fontSize: '0.7em', verticalAlign: 'middle' }}
                        title="Electronic Resource"
                      >
                        E-Resource
                      </span>
                    )}
                  </td>
                  <td>{author}</td>
                  <td>
                    {callNumber === 'Electronic' ? (
                      <span className="text-muted" style={{ fontSize: '0.85em', fontStyle: 'italic' }}>
                        Electronic
                      </span>
                    ) : (
                      callNumber
                    )}
                  </td>
                  <td>
                    {reserve.course?.name ? (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handleCourseClick(reserve);
                        }}
                        style={{
                          color: '#0066cc',
                          textDecoration: 'none',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.textDecoration = 'underline';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.textDecoration = 'none';
                        }}
                        title={`View course materials for ${reserve.course.name}`}
                      >
                        {reserve.course.name}
                      </a>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>{reserve.course?.courseNumber || 'N/A'}</td>
                  <td>{reserve.course?.sectionName || 'N/A'}</td>
                  <td>{getInstructorName(reserve.course, false)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

ItemSearchResults.propTypes = {
  reserves: PropTypes.array,
  loading: PropTypes.bool,
  error: PropTypes.string,
};

ItemSearchResults.defaultProps = {
  reserves: [],
  loading: false,
  error: null,
};

export default ItemSearchResults;
