import PropTypes from 'prop-types';
import { Table, Button } from 'reactstrap';
import { trackingService } from '../../../services/trackingService';
import useSearchStore from '../../../store/searchStore';

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

  return (
    <div className="table-responsive">
      <Table 
        hover 
        bordered 
        striped 
        className="shadow-sm bg-body-tertiary"
        style={{
          backgroundColor: cardBgColor,
          borderColor: cardBorderColor
        }}
      >
        <thead>
          <tr style={{ color: cardTitleTextColor, backgroundColor: cardBorderColor }}>
            <th>Course Name</th>
            <th>Course Number</th>
            <th>Section</th>
            <th>Department</th>
            <th>Instructor(s)</th>
            <th>Term</th>
            <th>Location</th>
            <th>Actions</th>
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

            return (
              <tr key={id} style={{ color: cardTextColor }}>
                <td>
                  <button
                    onClick={() => handleRecordsClick(course)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: cardTitleTextColor,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      textAlign: 'inherit',
                      padding: 0,
                    }}
                    aria-label={`View records for ${name}`}
                  >
                    {name}
                  </button>
                </td>
                <td>{courseNumber}</td>
                <td>{sectionName || '-'}</td>
                <td>{departmentName}</td>
                <td>
                  {instructors.length > 0 
                    ? instructors.join(', ')
                    : 'No Instructors'}
                </td>
                <td>{termName}</td>
                <td>{locationName}</td>
                <td>
                  <Button
                    size="sm"
                    aria-label={`See reserves for ${name}`}
                    style={{
                      backgroundColor: cardButtonBgColor || '#007bff', 
                      color: campusLocation === "hampshire" ? 'black' : 'white',
                    }}
                    onClick={() => handleRecordsClick(course)}
                  >
                    See Reserves
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