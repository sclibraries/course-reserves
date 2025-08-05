import { useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Alert, InputGroup, Input, InputGroupText } from 'reactstrap';
import { FaLink, FaCopy, FaCheck } from 'react-icons/fa';
import { buildShareableCourseUrl } from '../../util/urlHelpers';

/**
 * CoursePermalink component
 * 
 * Displays a user-friendly permalink for a course that can be copied and shared.
 * Shows both the friendly URL format and provides easy copy functionality.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.course - Course information object
 * @param {boolean} props.compact - Whether to show in compact mode (default: false)
 * @param {string} props.className - Additional CSS classes
 * @returns {JSX.Element} The CoursePermalink component
 */
const CoursePermalink = ({ course, compact = false, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  if (!course) {
    return null;
  }

  // Generate the friendly URL for sharing (includes base path)
  const friendlyUrl = buildShareableCourseUrl(course);
  const fullUrl = `${window.location.origin}${friendlyUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setError(null);
      
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError('Failed to copy to clipboard. Please select and copy the URL manually.');
      
      // Reset error after 5 seconds
      setTimeout(() => setError(null), 5000);
    }
  };

  if (compact) {
    return (
      <div className={`course-permalink-compact ${className}`}>
        <div className="d-flex align-items-center gap-2">
          <FaLink className="text-muted" size={14} />
          <Button
            color="link"
            size="sm"
            className="p-0 text-decoration-none"
            onClick={handleCopy}
            title="Copy shareable link"
          >
            Share this course
          </Button>
          {copied && (
            <small className="text-success">
              <FaCheck size={12} className="me-1" />
              Copied!
            </small>
          )}
        </div>
        {error && (
          <small className="text-danger mt-1 d-block">
            {error}
          </small>
        )}
      </div>
    );
  }

  return (
    <div className={`course-permalink ${className}`}>
      <div className="d-flex align-items-center mb-2">
        <FaLink className="me-2 text-muted" />
        <strong>Shareable Link</strong>
      </div>
      
      <InputGroup size="sm">
        <InputGroupText className="bg-light">
          <FaLink size={14} />
        </InputGroupText>
        <Input
          type="text"
          value={fullUrl}
          readOnly
          className="font-monospace"
          onClick={(e) => e.target.select()}
          title="Click to select URL"
        />
        <Button
          color={copied ? 'success' : 'outline-secondary'}
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy to clipboard'}
        >
          {copied ? <FaCheck /> : <FaCopy />}
          <span className="ms-1 d-none d-sm-inline">
            {copied ? 'Copied!' : 'Copy'}
          </span>
        </Button>
      </InputGroup>

      {copied && (
        <Alert color="success" className="mt-2 mb-0 py-2">
          <small>
            <FaCheck className="me-1" />
            URL copied to clipboard! You can now share this link with others.
          </small>
        </Alert>
      )}

      {error && (
        <Alert color="warning" className="mt-2 mb-0 py-2">
          <small>{error}</small>
        </Alert>
      )}

      <small className="text-muted mt-2 d-block">
        This link will take users directly to this course&apos;s materials and can be bookmarked or shared.
      </small>
    </div>
  );
};

CoursePermalink.propTypes = {
  course: PropTypes.shape({
    courseNumber: PropTypes.string,
    name: PropTypes.string,
    courseListingId: PropTypes.string,
    courseListingObject: PropTypes.shape({
      termObject: PropTypes.shape({
        name: PropTypes.string,
      }),
    }),
  }),
  compact: PropTypes.bool,
  className: PropTypes.string,
};

export default CoursePermalink;
