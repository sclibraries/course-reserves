import PropTypes from 'prop-types';
import { Info } from 'lucide-react';
import { Alert } from '../../../ui/alert';

export const SharedEditWarning = ({ usage, loading, error }) => {
  if (loading) {
    return <p role="status" className="tw-text-sm tw-text-muted-foreground">Checking resource usage...</p>;
  }

  if (error) {
    return <Alert variant="destructive">Resource usage couldn&apos;t be checked.</Alert>;
  }

  if (!usage) return null;

  const terms = usage.terms.map(({ term_name }) => term_name).join(', ');
  const courseCount = `${usage.course_count} ${usage.course_count === 1 ? 'course' : 'courses'}`;
  const termList = terms ? ` (${terms})` : '';
  const linkedPages = usage.linked_page_count > 0
    ? `, and up to ${usage.linked_page_count} linked pages`
    : '';

  return (
    <Alert role="status" className="tw-break-words">
      <Info aria-hidden="true" className="tw-size-4" />
      <p>Used in {courseCount}{termList} - changes apply to all{linkedPages}</p>
    </Alert>
  );
};

SharedEditWarning.propTypes = {
  usage: PropTypes.shape({
    course_count: PropTypes.number.isRequired,
    offering_count: PropTypes.number.isRequired,
    terms: PropTypes.arrayOf(PropTypes.shape({
      term_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      term_name: PropTypes.string.isRequired,
    })).isRequired,
    linked_page_count: PropTypes.number.isRequired,
  }),
  loading: PropTypes.bool,
  error: PropTypes.bool,
};

export default SharedEditWarning;
