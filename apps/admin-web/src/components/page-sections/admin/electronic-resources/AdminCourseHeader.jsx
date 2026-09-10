import PropTypes from 'prop-types';
import { Row, Col, Card, CardBody } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { buildFolioCourseUrl, buildPublicCourseUrl } from '../../../../util/urlHelpers';

function AdminCourseHeader({ 
  folioCourseData, 
  linkedCourses, 
  navigate, 
  copyToClipboard, 
  copyStatus, 
  coursePermalink
}) {
  return (
    <Card className="mb-4 custom-card">
      <CardBody>
        <Row>
          {/* Course Information - Left Side */}
          <Col md={8}>
            {/* Course Metadata Pills */}
            <div className="mb-3 d-flex flex-wrap gap-2">
              {folioCourseData?.departmentObject?.name && (
                <span className="custom-badge dept-badge">
                  <FontAwesomeIcon icon="fa-solid fa-building" className="me-2" />
                  {folioCourseData.departmentObject.name}
                </span>
              )}
              {folioCourseData?.courseListingObject?.locationObject?.name && (
                <span className="custom-badge location-badge">
                  <FontAwesomeIcon icon="fa-solid fa-location-dot" className="me-2" />
                  {folioCourseData.courseListingObject.locationObject.name}
                </span>
              )}
              {folioCourseData?.courseListingObject?.termObject?.name && (
                <span className="custom-badge term-badge">
                  <FontAwesomeIcon icon="fa-solid fa-calendar" className="me-2" />
                  {folioCourseData.courseListingObject.termObject.name}
                </span>
              )}
            </div>

            {/* Course Title */}
            <h2 className="mb-2 course-title">{folioCourseData?.name}</h2>

            {/* Course Number and Section */}
            <div className="d-flex align-items-center gap-2 mb-3">
              <h4 className="text-muted mb-0 course-number">{folioCourseData?.courseNumber}</h4>
              {folioCourseData?.sectionName && (
                <span className="custom-badge section-badge">
                  <FontAwesomeIcon icon="fa-solid fa-hashtag" className="me-2" />
                  Section {folioCourseData.sectionName}
                </span>
              )}
            </div>

            {/* Instructors */}
            <div className="mb-1">
              <label className="text-muted small text-uppercase mb-2 d-block section-label">Instructors</label>
              <div className="d-flex flex-wrap gap-2">
                {folioCourseData?.courseListingObject.instructorObjects?.map((instructor, idx) => (
                  <span key={idx} className="custom-badge instructor-badge">
                    <FontAwesomeIcon icon="fa-solid fa-user" className="me-2" />
                    {instructor.name}
                  </span>
                )) || <span className="text-muted fst-italic">No instructors listed</span>}
              </div>
            </div>

            {/* Linked Courses Badges - shown if any exist */}
            {linkedCourses.length > 0 && (
              <div className="mt-3">
                <label className="text-muted small text-uppercase mb-2 d-block section-label">
                  <FontAwesomeIcon icon="fa-solid fa-link" className="me-2" />
                  Linked Courses ({linkedCourses.length})
                </label>
                <div className="d-flex flex-wrap gap-2">
                  {linkedCourses.slice(0, 3).map((linkedCourse) => (
                    <span 
                      key={linkedCourse.course_id} 
                      className="custom-badge linked-course-badge"
                      onClick={() => navigate(`/admin/electronic/${linkedCourse.folio_course_id}`)}
                    >
                      {linkedCourse.course_name} ({linkedCourse.course_number})
                    </span>
                  ))}
                  {linkedCourses.length > 3 && (
                    <span className="custom-badge more-badge">
                      +{linkedCourses.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </Col>

          {/* Action Buttons - Right Side */}
          <Col md={4} className="d-flex flex-column justify-content-center align-items-end">
            <div className="d-flex flex-column gap-2 w-100" style={{ maxWidth: '240px' }}>
              <a 
                href={buildPublicCourseUrl(folioCourseData?.courseListingId)}
                target="_blank"
                rel="noopener noreferrer" 
                className="custom-btn primary-action-btn"
              >
                <FontAwesomeIcon icon="fa-solid fa-eye" className="me-2" />
                View Public Page
              </a>
              
              <a 
                href={buildFolioCourseUrl(folioCourseData?.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="custom-btn secondary-action-btn"
              >
                <FontAwesomeIcon icon="fa-solid fa-arrow-up-right-from-square" className="me-2" />
                Open in FOLIO
              </a>
              
              <button 
                className="custom-btn tertiary-action-btn"
                onClick={() => copyToClipboard(coursePermalink)}
              >
                <FontAwesomeIcon icon="fa-solid fa-copy" className="me-2" />
                Copy Permalink
                {copyStatus && (
                  <span className="copy-status">
                    {copyStatus}
                  </span>
                )}
              </button>
            </div>
          </Col>
        </Row>
      </CardBody>
    </Card>
  );
}

AdminCourseHeader.propTypes = {
  folioCourseData: PropTypes.object,
  linkedCourses: PropTypes.array,
  navigate: PropTypes.func.isRequired,
  copyToClipboard: PropTypes.func.isRequired,
  copyStatus: PropTypes.string,
  course: PropTypes.object,
  coursePermalink: PropTypes.string
};

export default AdminCourseHeader;
