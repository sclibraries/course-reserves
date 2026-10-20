import PropTypes from 'prop-types';
import { Alert, Button, Card, CardBody } from 'reactstrap';
import { FaArrowLeft } from 'react-icons/fa';
import SubmissionStatusBadge from './shared/SubmissionStatusBadge';

function DraftSubmissionView({ submission, items, onBack }) {
  const orderedItems = [...items].sort((left, right) => Number(left.displayOrder) - Number(right.displayOrder));

  return (
    <div className="submission-detail">
      <Button color="link" onClick={onBack} className="mb-3 ps-0">
        <FaArrowLeft className="me-2" /> Back to Queue
      </Button>
      <Alert color="warning" role="status">
        Draft - not submitted yet. You can view it; it can&apos;t be processed until the faculty member submits.
      </Alert>
      <Card className="submission-header mb-4">
        <CardBody>
          <h1 className="h3 mb-2">
            {submission.courseCode}{submission.section && ` - ${submission.section}`}: {submission.courseTitle}
          </h1>
          <div className="submission-meta">
            <span><strong>Faculty:</strong> {submission.facultyName}</span>
            <span><strong>Term:</strong> {submission.term}</span>
            <span><strong>Status:</strong> <SubmissionStatusBadge status={submission.status} /></span>
          </div>
        </CardBody>
      </Card>
      <section aria-label="Draft items">
        <ol className="list-group list-group-numbered">
          {orderedItems.map((item) => (
            <li className="list-group-item" key={item.id} data-draft-item-id={item.id}>
              {item.title} · {item.materialType}
            </li>
          ))}
        </ol>
        {!orderedItems.length && <p className="text-muted">This draft has no items yet.</p>}
      </section>
    </div>
  );
}

DraftSubmissionView.propTypes = {
  submission: PropTypes.object.isRequired,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  onBack: PropTypes.func.isRequired,
};

export default DraftSubmissionView;
