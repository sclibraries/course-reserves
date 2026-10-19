import PropTypes from 'prop-types';
import { Alert, Button, Spinner } from 'reactstrap';
import ClaimItemSummary from './ClaimItemSummary';

function QueueItemList({ items, loading, error, emptyMessage, claimingKey, onClaim }) {
  if (loading) {
    return <div className="text-center py-4"><Spinner /><p className="mt-2">Loading queue...</p></div>;
  }

  return (
    <>
      {error && <Alert color="danger" role="alert">{error}</Alert>}
      {!items.length && !error && <Alert color="success">{emptyMessage}</Alert>}
      {items.length > 0 && (
        <div className="d-grid gap-2">
          {items.map((item) => {
            const key = `${item.kind}/${item.id}`;
            return (
              <ClaimItemSummary item={item} key={key}>
                <Button
                  color="primary"
                  aria-label={`Claim ${item.title}`}
                  disabled={Boolean(claimingKey)}
                  onClick={() => onClaim(item)}
                >
                  {claimingKey === key ? 'Claiming...' : 'Claim'}
                </Button>
              </ClaimItemSummary>
            );
          })}
        </div>
      )}
    </>
  );
}

QueueItemList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  emptyMessage: PropTypes.string.isRequired,
  claimingKey: PropTypes.string,
  onClaim: PropTypes.func.isRequired,
};

export default QueueItemList;
