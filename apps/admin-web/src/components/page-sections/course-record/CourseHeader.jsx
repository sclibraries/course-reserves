import PropTypes from 'prop-types';
import { Button, Badge } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowAltCircleLeft } from '@fortawesome/free-solid-svg-icons';
import CoursePermalink from '../../common/CoursePermalink';
import { useCourseView } from '../../../contexts/CourseViewContext';

export default function CourseHeader({ onBack }) {
  const { courseInfo } = useCourseView();
  if (!courseInfo) return null;
  return (
    <>
      <div className="mb-3 d-flex align-items-center">
        <Button color="link" className="p-0 me-2 text-primary" onClick={onBack} aria-label="Go back">
          <FontAwesomeIcon icon={faArrowAltCircleLeft} size="lg" />
          <span className="visually-hidden">Go Back</span>
        </Button>
        <h1 className="h4 mb-0">Back to results</h1>
      </div>
      <div className="course-info mb-4 container-fluid py-2">
        <h2 className="display-5 fw-bold">
          {courseInfo.courseNumber}
          {courseInfo.sectionName && `-${courseInfo.sectionName}`}: {courseInfo.name}
        </h2>
        {courseInfo.courseListingObject?.instructorObjects?.length > 0 && (
          <h3 className="col-md-8 fs-4">
            <strong>Instructors:</strong>{' '}
            {courseInfo.courseListingObject.instructorObjects.map(instr => instr.name).join(', ')}
          </h3>
        )}
        <div className="d-flex align-items-center gap-3 mt-2">
          <Badge color="primary">{courseInfo?.courseListingObject?.termObject?.name}</Badge>
          {courseInfo?.sectionName && <Badge color="secondary">Section {courseInfo.sectionName}</Badge>}
          <CoursePermalink course={courseInfo} compact />
        </div>
      </div>
    </>
  );
}

CourseHeader.propTypes = {
  onBack: PropTypes.func.isRequired,
};
