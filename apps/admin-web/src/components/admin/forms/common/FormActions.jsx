import PropTypes from 'prop-types';
import { Button, Spinner } from 'reactstrap';
import { FaSave } from 'react-icons/fa';

/**
 * FormActions - Standard form action buttons
 */
export const FormActions = ({ 
  isSubmitting = false,
  onCancel,
  submitText = 'Save',
  showCancel = true,
  cancelText = 'Cancel'
}) => {
  return (
    <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
      {showCancel && (
        <Button 
          type="button"
          color="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {cancelText}
        </Button>
      )}
      
      <Button
        type="submit"
        color="primary"
        disabled={isSubmitting}
        className="d-flex align-items-center"
      >
        {isSubmitting ? (
          <>
            <Spinner size="sm" className="me-2" /> Saving...
          </>
        ) : (
          <>
            <FaSave className="me-2" /> {submitText}
          </>
        )}
      </Button>
    </div>
  );
};

FormActions.propTypes = {
  isSubmitting: PropTypes.bool,
  onCancel: PropTypes.func,
  submitText: PropTypes.string,
  showCancel: PropTypes.bool,
  cancelText: PropTypes.string
};

export default FormActions;
