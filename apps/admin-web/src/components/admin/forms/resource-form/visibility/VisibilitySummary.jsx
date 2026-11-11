import PropTypes from 'prop-types';
import { Alert } from '../../../../ui/alert';

export const VisibilitySummary = ({ summary }) => {
  if (!summary) return null;

  return (
    <Alert
      role="region"
      aria-live="polite"
      aria-label="Visibility summary"
      className="tw-space-y-1"
    >
      <p className="tw-font-medium">Visibility summary</p>
      {summary.citation && <p><strong>Item:</strong> {summary.citation}</p>}
      {summary.primaryLink && <p><strong>Primary link:</strong> {summary.primaryLink}</p>}
      {summary.links.length > 0 && (
        <div>
          <p className="tw-font-medium">Additional links</p>
          <ul className="tw-list-disc tw-space-y-1 tw-pl-5">
            {summary.links.map((link, index) => (
              <li key={`${link.title}-${index}`} className="tw-break-words">
                <strong>{link.title}:</strong> {link.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {summary.sharedDatesMessage && <p>{summary.sharedDatesMessage}</p>}
    </Alert>
  );
};

VisibilitySummary.propTypes = {
  summary: PropTypes.shape({
    citation: PropTypes.string,
    primaryLink: PropTypes.string,
    links: PropTypes.arrayOf(PropTypes.shape({
      title: PropTypes.string.isRequired,
      message: PropTypes.string.isRequired,
    })).isRequired,
    sharedDatesMessage: PropTypes.string,
  }),
};

export default VisibilitySummary;
