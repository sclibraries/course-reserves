import PropTypes from 'prop-types';
import { Alert } from '../../../ui/alert';

export const ErrorSummary = ({ errors }) => {
  const fields = Object.entries(errors);
  if (!fields.length) return null;

  return (
    <Alert
      variant="destructive"
      aria-labelledby="resource-form-error-summary-title"
      className="tw-space-y-2"
    >
      <p id="resource-form-error-summary-title" className="tw-font-medium">Please correct the following:</p>
      <ul className="tw-list-inside tw-list-disc">
        {fields.map(([field, message]) => (
          <li key={field}>
            <a
              href={`#${field}`}
              onClick={() => document.getElementById(field)?.focus()}
              className="tw-underline tw-underline-offset-2 focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring focus-visible:tw-ring-offset-2"
            >
              {message}
            </a>
          </li>
        ))}
      </ul>
    </Alert>
  );
};

ErrorSummary.propTypes = { errors: PropTypes.object.isRequired };

export default ErrorSummary;
