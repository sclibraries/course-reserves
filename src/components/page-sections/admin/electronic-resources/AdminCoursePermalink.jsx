import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function AdminCoursePermalink({ copyToClipboard, coursePermalink }) {
  return (
    <Card className="mb-4 custom-card">
      <CardHeader className="custom-card-header">
        <div className="d-flex align-items-center">
          <FontAwesomeIcon icon="fa-solid fa-link" className="me-2 text-primary" />
          <h5 className="m-0">Course Permalink</h5>
        </div>
      </CardHeader>
      <CardBody>
        <p className="mb-3">
          Share this link to provide direct access to the course resources.
        </p>
        <div className="permalink-container">
          <input 
            readOnly 
            value={coursePermalink} 
            className="permalink-input" 
          />
          <button 
            className="permalink-copy-btn"
            onClick={() => copyToClipboard(coursePermalink)}
            disabled={!coursePermalink}
          >
            <FontAwesomeIcon icon="fa-solid fa-copy" className="me-2" />
            Copy
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

AdminCoursePermalink.propTypes = {
  course: PropTypes.object,
  copyToClipboard: PropTypes.func.isRequired,
  coursePermalink: PropTypes.string
};

export default AdminCoursePermalink;
