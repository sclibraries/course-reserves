import { useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Spinner } from 'reactstrap';
import { claimsApi } from '../../../../services/admin/workflowClaims/claimsApi';
import { formatSubmissionClaimItems } from '../../../../services/admin/workflowClaims/claimsFormatters';
import useMutation from '../../../../hooks/admin/useMutation';
import ClaimItemCard from './ClaimItemCard';

function resultMessage(result) {
  const claimed = result.claimed;
  const skipped = result.skipped;
  const skippedNames = skipped.map((item) => item.claimed_by_display).filter(Boolean);
  const skippedBy = skippedNames.length ? ` (${skippedNames.join(', ')})` : '';
  return `Claimed ${claimed.length} item${claimed.length === 1 ? '' : 's'}. Skipped ${skipped.length} item${skipped.length === 1 ? '' : 's'}${skippedBy}.`;
}

function SubmissionClaimsPanel({ submission, items, currentUsername = '', onChanged }) {
  const { pending: claimingAll, error, run } = useMutation();
  const [claimAllResult, setClaimAllResult] = useState(null);
  const claimItems = formatSubmissionClaimItems(items, submission);

  const handleClaimAll = async () => {
    setClaimAllResult(null);
    await run(() => claimsApi.claimAllItems(submission.uuid), {
      reload: onChanged,
      onSuccess: setClaimAllResult,
    });
  };

  return (
    <section className="mb-4" aria-labelledby="submission-claims-title">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h2 id="submission-claims-title" className="h4 mb-1">Item claims</h2>
          <p className="text-muted mb-0">Items appear in the faculty&apos;s submitted order.</p>
        </div>
        <div className="d-flex gap-2">
          <Button color="primary" aria-label="Claim all items" onClick={handleClaimAll} disabled={claimingAll || !claimItems.length}>
            {claimingAll ? <Spinner size="sm" /> : 'Claim all items'}
          </Button>
        </div>
      </div>

      {error && <Alert color="danger" role="alert">{error}</Alert>}
      {claimAllResult && <Alert color="info" role="status">{resultMessage(claimAllResult)}</Alert>}
      {!claimItems.length && <Alert color="info">This submission has no items to claim.</Alert>}
      <div className="d-grid gap-3">
        {claimItems.map((item) => (
          <ClaimItemCard
            key={`${item.kind}/${item.id}`}
            item={item}
            currentUsername={currentUsername}
            onChanged={onChanged}
          />
        ))}
      </div>
    </section>
  );
}

SubmissionClaimsPanel.propTypes = {
  submission: PropTypes.object.isRequired,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  currentUsername: PropTypes.string,
  onChanged: PropTypes.func,
};

export default SubmissionClaimsPanel;
