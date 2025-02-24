// CourseCard.jsx
import PropTypes from 'prop-types';
import { Card, CardBody, CardTitle, CardText, Button } from 'reactstrap';

function CourseCard({ course, customization, onRecordsClick }) {
  const {
    cardBgColor,
    cardBorderColor,
    cardTitleTextColor,
    cardTitleFontSize,
    cardTextColor,
    cardButtonBgColor,
    campusLocation
  } = customization;

  const {
    name,
    courseNumber,
    departmentObject,
    courseListingObject,
    courseListingId,
    sectionName
  } = course;

  const departmentName = departmentObject?.name || 'Unknown Department';
  const instructors =
    courseListingObject?.instructorObjects?.map((i) => i.name) || [];
  const termName = courseListingObject?.termObject?.name || 'Unknown Term';
  const locationName =
    courseListingObject?.locationObject?.name || 'Unknown Location';

  return (
    <Card
      className="h-100 w-100 shadow-sm p-3 mb-5 bg-body-tertiary rounded"
      style={{
        backgroundColor: cardBgColor,
        border: `1px solid ${cardBorderColor}`,
      }}
    >
      <CardBody className="d-flex flex-column">
      <CardTitle
          tag="h2"
          className="mb-3"
          style={{
            color: cardTitleTextColor,
            fontSize: cardTitleFontSize,
            textAlign: 'left', // Ensure alignment
          }}
        >
          <button
            onClick={() => onRecordsClick(courseListingId)}
            style={{
              background: 'none',
              border: 'none',
              color: cardTitleTextColor,
              textDecoration: 'underline',
              cursor: 'pointer',
              display: 'inline',
              textAlign: 'inherit',
              padding: 0,
            }}
            aria-label={`View records for ${name}`}
          >
            {name}
          </button>
        </CardTitle>
        <CardText style={{ color: cardTextColor }}>
          <strong>Course Number:</strong> {courseNumber}
        </CardText>
        {sectionName && (
        <CardText style={{ color: cardTextColor }}>
          <strong>Section:</strong> {sectionName}
        </CardText>
        )}
        <CardText style={{ color: cardTextColor }}>
          <strong>Department:</strong> {departmentName}
        </CardText>
        <CardText style={{ color: cardTextColor }}>
          <strong>Instructor(s):</strong>
          {instructors.length > 0 ? (
            <ul>
              {instructors.map((name, index) => (
                <li key={index}>{name}</li>
              ))}
            </ul>
          ) : (
            'No Instructors'
          )}
        </CardText>
        <CardText style={{ color: cardTextColor }}>
          <strong>Term:</strong> {termName}
        </CardText>
        <CardText style={{ color: cardTextColor }}>
          <strong>Location:</strong> {locationName}
        </CardText>
        <Button
          className="mt-auto"
          aria-label={`See reserves for ${name}`}
          style={{
            backgroundColor: cardButtonBgColor || '#007bff', 
            color: campusLocation == "hampshire" ? 'black' : 'white',
          }}
          onClick={() => onRecordsClick(courseListingId)}
        >
          See Reserves
        </Button>
      </CardBody>
    </Card>
  );
}

CourseCard.propTypes = {
  course: PropTypes.shape({
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
  }).isRequired,
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

export default CourseCard;