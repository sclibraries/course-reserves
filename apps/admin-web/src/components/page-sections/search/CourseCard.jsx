import PropTypes from 'prop-types';
import { 
  Card, CardBody, CardTitle, CardSubtitle, 
  Badge, Button
} from 'reactstrap';
import { trackingService } from '../../../services/trackingService';
import useSearchStore from '../../../store/searchStore';
import { useNavigate } from 'react-router-dom';
import { FaChevronRight } from 'react-icons/fa';

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
    sectionName,
    departmentObject,
    courseListingObject,
    courseListingId,
  } = course;

  const navigate = useNavigate();
  const setType = useSearchStore((state) => state.setType);
  const setQuery = useSearchStore((state) => state.setQuery);

  const college = useSearchStore((state) => state.college);
  
  const departmentName = departmentObject?.name || 'Unknown Department';
  const instructors = courseListingObject?.instructorObjects?.map((i) => i.name) || [];
  const termName = courseListingObject?.termObject?.name || 'Unknown Term';
  const locationName = courseListingObject?.locationObject?.name || 'Unknown Location';

  const handleRecordsClick = () => {
    // Tracking event before navigating
    trackingService.trackEvent({
      college: college,
      event_type: "course_access",
      course_id: courseListingId,
      term: termName,
      course_name: name,
      course_code: `${courseNumber}${sectionName ? `-${sectionName}` : ''}`,
      instructor: instructors.map(i => ({ name: i })),
      metadata: {
        department: departmentName,
        location: locationName,
        action: "viewed course records"
      },
    }).catch((error) => console.error("Error tracking course access:", error));
  
    // Proceed with navigation
    onRecordsClick(courseListingId, course);
  };

  const handleInstructorClick = (instructorName, event) => {
    // Prevent event bubbling
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Set values in store first (like Searchbar does)
    // This helps React Router optimize the navigation
    const searchAreaKey = 'instructor';
    const searchQuery = instructorName;
    
    setType(searchAreaKey);
    setQuery(searchQuery);
    
    // Build URL parameters
    const searchParams = new URLSearchParams();
    if (college) searchParams.set('college', college);
    searchParams.set('type', searchAreaKey);
    searchParams.set('query', searchQuery);
    
    // Navigate after store updates
    navigate(`/search?${searchParams.toString()}`);
    
    // Track in background (non-blocking)
    setTimeout(() => {
      trackingService.trackEvent({
        college: college,
        event_type: "instructor_search",
        course_id: courseListingId,
        term: termName,
        course_name: name,
        course_code: `${courseNumber}${sectionName ? `-${sectionName}` : ''}`,
        instructor: [{ name: instructorName }],
        metadata: {
          department: departmentName,
          search_type: "instructor",
          query: instructorName
        },
      }).catch((error) => console.error("Error tracking instructor search:", error));
    }, 0);
  };

  // Determine accent color based on campus, ensuring good contrast
  const accentColor = campusLocation === "hampshire" ? "#8A4F7D" : "#1c4f82";
  
  // Create higher contrast color combinations for badges
  const termBadgeBg = "#e6eef7"; // Darker background for better contrast
  const termBadgeText = "#0d4c8b"; // Darker blue for better contrast
  const locationBadgeText = "#333333"; // Much darker text for location badge
  const locationBadgeBg = "#e9ecef"; // Slightly darker background

  return (
    <Card
      className="h-100 shadow-sm mb-4 position-relative overflow-hidden course-card"
      style={{
        backgroundColor: cardBgColor || "#ffffff",
        borderLeft: `4px solid ${cardButtonBgColor || accentColor}`,
        borderTop: `1px solid ${cardBorderColor || "#eaeaea"}`,
        borderRight: `1px solid ${cardBorderColor || "#eaeaea"}`,
        borderBottom: `1px solid ${cardBorderColor || "#eaeaea"}`,
        transition: "all 0.3s ease",
        transform: "translateY(0)",
        minWidth: "280px", // Prevents cards from becoming too narrow
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <CardBody>
        {/* Term and Location Badges - With improved contrast */}
        <div className="d-flex flex-wrap justify-content-between align-items-start mb-2">
          <Badge 
            color="light" 
            className="term-badge"
            style={{ 
              padding: "0.4em 0.8em",
              backgroundColor: termBadgeBg,
              color: termBadgeText,
              fontWeight: "700", // Increased to bold for better contrast
              borderRadius: "16px",
              fontSize: "0.75rem",
              marginBottom: "8px",
              border: "1px solid rgba(13, 76, 139, 0.2)" // Add border related to text color
            }}
          >
            {termName}
          </Badge>
          <Badge 
            color="light" 
            className="location-badge"
            style={{ 
              padding: "0.4em 0.8em", 
              backgroundColor: locationBadgeBg,
              color: locationBadgeText,
              fontWeight: "700", // Increased to bold for better contrast
              borderRadius: "16px",
              fontSize: "0.75rem",
              marginBottom: "8px",
              border: "1px solid rgba(0,0,0,0.1)"
            }}
          >
            {locationName}
          </Badge>
        </div>

        {/* Course title without redundant title attribute */}
        <CardTitle 
          tag="h3" 
          className="mb-2"
          onClick={handleRecordsClick}
          style={{
            color: cardTitleTextColor || "#333",
            fontSize: cardTitleFontSize || "1.25rem",
            fontWeight: "600",
            cursor: "pointer",
            transition: "color 0.2s ease"
          }}
          // Removed redundant title attribute
        >
          <span className="course-title-text">
            {name}
          </span>
        </CardTitle>

        {/* Course number and department with better spacing */}
        <CardSubtitle 
          tag="div" 
          className="mb-3 d-flex align-items-center gap-2"
        >
          <Badge 
            color="light"
            style={{ 
              padding: "0.35em 0.75em",
              backgroundColor: "#f0f0f0",
              color: "#333",
              fontWeight: "600",
              marginRight: "4px"
            }}
          >
            {courseNumber}
          </Badge>
          {course.sectionName && (
            <Badge 
              color="secondary"
              style={{ 
                padding: "0.3em 0.6em",
                fontSize: "0.75rem",
                fontWeight: "500"
              }}
            >
              Section {course.sectionName}
            </Badge>
          )}
          <span style={{ 
            fontSize: "0.9rem", 
            color: cardTextColor || "#555",
            opacity: 0.8
          }}>
            {departmentName}
          </span>
        </CardSubtitle>
        
        {/* Instructors section with improved interactive badges */}
        <div className="mb-4">
          <div className="d-flex flex-wrap gap-1 align-items-center">
            <small style={{
              fontSize: "0.8rem",
              fontWeight: "500",
              color: "#6c757d",
              marginRight: "4px"
            }}>
              Instructor{instructors.length !== 1 ? 's' : ''}:
            </small>
            
            {instructors.length > 0 ? (
              <div className="d-flex flex-wrap gap-1 instructor-badges">
                {instructors.map((instructor, index) => (
                  <Badge
                    key={index}
                    color="light"
                    pill
                    className="instructor-badge"
                    onClick={(e) => handleInstructorClick(instructor, e)} 
                    title={`Search for courses taught by ${instructor}`}
                    style={{
                      padding: "0.25em 0.65em",
                      backgroundColor: "#f8f9fa",
                      color: "#495057",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      fontSize: "0.8rem",
                      border: "1px solid #e9ecef"
                    }}
                  >
                    {instructor}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted" style={{ fontSize: "0.8rem" }}>None listed</span>
            )}
          </div>
        </div>

        {/* Reserves indicator */}
        {/* <div className="reserves-indicator d-flex align-items-center mb-2" style={{ fontSize: "0.85rem" }}>
          <FaBook style={{ 
            color: cardButtonBgColor || accentColor,
            marginRight: "6px",
            fontSize: "0.9rem"
          }} />
          <span>Has course materials</span>
        </div> */}

        {/* View button with enhanced styling and positioning */}
        <Button
          color="primary"
          className="position-absolute view-reserves-btn d-flex align-items-center gap-2"
          onClick={handleRecordsClick}
          aria-label={`View course reserves for ${name}`} // More descriptive label
          style={{
            backgroundColor: cardButtonBgColor || accentColor,
            border: "none",
            bottom: "1rem",
            right: "1rem",
            fontWeight: "500",
            fontSize: "0.85rem",
            padding: "0.5rem 0.85rem",
            transition: "all 0.2s ease"
          }}
        >
          View Reserves
          <FaChevronRight size={12} aria-hidden="true" />
        </Button>
      </CardBody>
    </Card>
  );
}

// PropTypes remain the same
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