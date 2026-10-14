import PropTypes from 'prop-types';
import { Alert, Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function ChecklistCompletion({ saving, allRequiredComplete, onComplete }) {
  return (
    <div className="mt-4 pt-3 border-top">
      {allRequiredComplete ? (
        <Alert color="success" className="mb-3">
          <FontAwesomeIcon icon="fa-solid fa-check-circle" className="me-2" />
          All required tasks are complete! You can now mark this item as done.
        </Alert>
      ) : (
        <Alert color="warning" className="mb-3">
          <FontAwesomeIcon icon="fa-solid fa-exclamation-triangle" className="me-2" />
          Please complete all required tasks before marking this item as done.
        </Alert>
      )}
      <div className="d-flex gap-2">
        <Button
          color="success"
          onClick={onComplete}
          disabled={saving || !allRequiredComplete}
          className="flex-grow-1"
        >
          {saving ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              Processing...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon="fa-solid fa-check" className="me-2" />
              Mark Item as Complete
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

ChecklistCompletion.propTypes = {
  saving: PropTypes.bool.isRequired,
  allRequiredComplete: PropTypes.bool.isRequired,
  onComplete: PropTypes.func.isRequired
};

export default ChecklistCompletion;
