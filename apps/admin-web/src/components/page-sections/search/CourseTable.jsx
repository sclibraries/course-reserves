import PropTypes from 'prop-types';
import { Table, Button, Badge } from 'reactstrap';
import { trackingService } from '../../../services/trackingService';
import useSearchStore from '../../../store/searchStore';
import { FaBook, FaChevronRight } from 'react-icons/fa';

function CourseTable({ courses, customization, onRecordsClick }) {
  const {
    cardBgColor,
    cardBorderColor,
    cardTitleTextColor,
    cardTextColor,
    cardButtonBgColor,
    campusLocation
  } = customization;

  const college = useSearchStore((state) => state.college);

  const handleRecordsClick = (course) => {
    const {
      courseListingId,
      name,
      courseNumber,
      departmentObject,
      courseListingObject
    } = course;

    const departmentName = departmentObject?.name || 'Unknown Department';
    const instructors = courseListingObject?.instructorObjects?.map((i) => i.name) || [];
    const termName = courseListingObject?.termObject?.name || 'Unknown Term';
    const locationName = courseListingObject?.locationObject?.name || 'Unknown Location';

    // Tracking event before navigating
    trackingService.trackEvent({
      college: college,
      event_type: "course_access",
      course_id: courseListingId,
      term: termName,
      course_name: name,
      course_code: courseNumber,
      instructor: instructors.map(i => ({ name: i })),
      metadata: {
        department: departmentName,
        location: locationName,
        action: "viewed course records"
      },
    }).catch((error) => console.error("Error tracking course access:", error));

    // Proceed with navigation
    onRecordsClick(courseListingId);
  };

  // Determine theme colors
  const accentColor = campusLocation === "hampshire" ? "#8A4F7D" : "#1c4f82";
  const buttonTextColor = campusLocation === "hampshire" ? 'black' : 'white';
  const headerBgColor = cardBorderColor || "#f8f9fa";
  const headerTextColor = cardTitleTextColor || "#212529";
  const termBadgeTextColor = cardButtonBgColor || "#0d4c8b"; // Darker blue for better contrast

  return (
    <div className="table-responsive course-table-container shadow-sm rounded overflow-hidden">
      <Table 
        hover 
        className="mb-0 align-middle course-table"
        style={{
          backgroundColor: cardBgColor,
        }}
      >
        <thead>
          <tr style={{ 
            color: headerTextColor, 
            backgroundColor: headerBgColor,
            borderBottom: `2px solid ${cardBorderColor || "#dee2e6"}`
          }}>
            <th className="py-3" scope="col">Course</th> {/* Added scope for better accessibility */}
            <th className="py-3" scope="col">Section</th>
            <th className="py-3" scope="col">Department</th>
            <th className="py-3 d-none d-md-table-cell" scope="col">Instructor(s)</th>
            <th className="py-3 d-none d-md-table-cell" scope="col">Term</th>
            <th className="py-3 d-none d-lg-table-cell" scope="col">Location</th>
            <th className="py-3 text-end" scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => {
            const {
              id,
              name,
              courseNumber,
              sectionName,
              departmentObject,
              courseListingObject
            } = course;

            const departmentName = departmentObject?.name || 'Unknown Department';
            const instructors = courseListingObject?.instructorObjects?.map((i) => i.name) || [];
            const termName = courseListingObject?.termObject?.name || 'Unknown Term';
            const locationName = courseListingObject?.locationObject?.name || 'Unknown Location';
            const instructorList = instructors.length > 0 ? instructors.join(', ') : 'No Instructors';

            return (
              <tr 
                key={id} 
                style={{ color: cardTextColor }}
                className="course-table-row"
              >
                <td>
                  <div className="d-flex flex-column">
                    <button
                      onClick={() => handleRecordsClick(course)}
                      className="course-title-link text-start"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: cardTitleTextColor,
                        fontWeight: "500",
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      aria-label={`View reserves for ${name}`}
                    >
                      {name}
                    </button>
                    <div className="d-flex align-items-center mt-1">
                      <Badge 
                        color="light" 
                        style={{ 
                          backgroundColor: "#f0f0f0", 
                          color: "#333",
                          fontWeight: "600",
                          fontSize: "0.75rem"
                        }}
                      >
                        {courseNumber}
                      </Badge>
                    </div>
                  </div>
                </td>
                <td>
                  {sectionName ? (
                    <Badge 
                      color="secondary"
                      style={{ 
                        fontSize: "0.75rem",
                        fontWeight: "500"
                      }}
                    >
                      {sectionName}
                    </Badge>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  <span className="department-name">{departmentName}</span>
                </td>
                <td className="d-none d-md-table-cell">
                  <div className="instructor-cell">
                    {instructors.length > 0 ? (
                      <span className="instructor-list">{instructorList}</span>
                    ) : (
                      <span className="text-muted">No Instructors</span>
                    )}
                  </div>
                </td>
                <td className="d-none d-md-table-cell">
                  <Badge 
                    color="light" 
                    className="term-badge"
                    style={{ 
                      backgroundColor: cardButtonBgColor ? `${cardButtonBgColor}15` : "#e6f0f9",
                      color: termBadgeTextColor, // Darker color for better contrast
                      fontWeight: "600" // Increased weight for better contrast
                    }}
                  >
                    {termName}
                  </Badge>
                </td>
                <td className="d-none d-lg-table-cell">
                  <small>{locationName}</small>
                </td>
                <td className="text-end">
                  <Button
                    size="sm"
                    className="d-flex align-items-center gap-1 ms-auto"
                    style={{
                      backgroundColor: cardButtonBgColor || accentColor, 
                      color: buttonTextColor,
                      border: "none",
                      fontWeight: "500",
                      fontSize: "0.8rem",
                      padding: "0.4rem 0.75rem"
                    }}
                    onClick={() => handleRecordsClick(course)}
                    aria-label={`View reserves for ${name}`}
                  >
                    <FaBook size={12} className="me-1" aria-hidden="true" /> {/* Icon is decorative */}
                    <span className="d-none d-sm-inline">View</span>
                    <FaChevronRight size={10} aria-hidden="true" />  {/* Icon is decorative */}
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

CourseTable.propTypes = {
  courses: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      courseNumber: PropTypes.string.isRequired,
      sectionName: PropTypes.string,
      departmentObject: PropTypes.shape({
        name: PropTypes.string,
      }),
      courseListingObject: PropTypes.shape({
        instructorObjects: PropTypes.arrayOf(
          PropTypes.shape({
            name: PropTypes.string,
          })
        ),
        termObject: PropTypes.shape({
          name: PropTypes.string,
        }),
        locationObject: PropTypes.shape({
          name: PropTypes.string,
        }),
      }),
      courseListingId: PropTypes.string.isRequired,
    })
  ).isRequired,
  customization: PropTypes.shape({
    cardBgColor: PropTypes.string,
    cardBorderColor: PropTypes.string,
    cardTitleTextColor: PropTypes.string,
    cardTitleFontSize: PropTypes.string,
    cardTextColor: PropTypes.string,
    cardButtonBgColor: PropTypes.string,
    campusLocation: PropTypes.string,
  }).isRequired,
  onRecordsClick: PropTypes.func.isRequired,
};

export default CourseTable;