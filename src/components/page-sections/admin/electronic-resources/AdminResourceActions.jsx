import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function AdminResourceActions({
  toggleNewResourceModal,
  toggleEDSResourceModal,
  toggleHitchcockModal,
  toggleReuseModal,
  toggleCrossLinkModal
}) {
  return (
    <div className="action-btn-group mb-4">
      <Button color="primary" className="custom-action-btn primary" onClick={toggleNewResourceModal}>
        <FontAwesomeIcon icon="fa-solid fa-plus" className="me-2" />
        Add New Resource
      </Button>
      <Button color="secondary" className="custom-action-btn" onClick={toggleEDSResourceModal}>
        <FontAwesomeIcon icon="fa-solid fa-database" className="me-2" />
        Search EDS
      </Button>
      <Button color="secondary" className="custom-action-btn" onClick={toggleHitchcockModal}>
        <FontAwesomeIcon icon="fa-solid fa-book" className="me-2" />
        Search Hitchcock
      </Button>
      <Button color="secondary" className="custom-action-btn" onClick={toggleReuseModal}>
        <FontAwesomeIcon icon="fa-solid fa-recycle" className="me-2" />
        Reuse Existing
      </Button>
      <Button color="secondary" className="custom-action-btn" onClick={toggleCrossLinkModal}>
        <FontAwesomeIcon icon="fa-solid fa-link" className="me-2" />
        Cross-link Course
      </Button>
    </div>
  );
}

AdminResourceActions.propTypes = {
  toggleNewResourceModal: PropTypes.func.isRequired,
  toggleEDSResourceModal: PropTypes.func.isRequired,
  toggleHitchcockModal: PropTypes.func.isRequired,
  toggleReuseModal: PropTypes.func.isRequired,
  toggleCrossLinkModal: PropTypes.func.isRequired,
};

export default AdminResourceActions;
