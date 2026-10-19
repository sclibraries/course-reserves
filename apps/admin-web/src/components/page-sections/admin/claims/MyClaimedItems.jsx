import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Spinner } from 'reactstrap';
import { claimsApi } from '../../../../services/admin/workflowClaims/claimsApi';
import { formatExpiry, getClaimsErrorMessage, sortMyClaimedItems } from '../../../../services/admin/workflowClaims/claimsFormatters';
import ClaimItemSummary from './ClaimItemSummary';

function MyClaimedItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState('');
  const [error, setError] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await claimsApi.getMyItems();
      setItems(sortMyClaimedItems(result?.items || []));
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleRelease = async (item) => {
    const key = `${item.kind}/${item.id}`;
    setReleasing(key);
    setError('');
    try {
      await claimsApi.releaseItem(item.kind, item.id);
      await loadItems();
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setReleasing('');
    }
  };

  return (
    <section aria-labelledby="my-items-title">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h1 id="my-items-title" className="h3 mb-1">My items</h1>
          <p className="text-muted mb-0">{items.length} item{items.length === 1 ? '' : 's'} claimed by you</p>
        </div>
        <Button color="outline-primary" onClick={loadItems} disabled={loading}>Refresh</Button>
      </div>

      {error && <Alert color="danger" role="alert">{error}</Alert>}
      {loading && <div className="text-center py-4"><Spinner /><p className="mt-2">Loading your items...</p></div>}
      {!loading && !items.length && <Alert color="info">You have no claimed items.</Alert>}
      {!loading && items.length > 0 && (
        <div className="d-grid gap-2">
          {items.map((item) => {
            const key = `${item.kind}/${item.id}`;
            const expiry = formatExpiry(item.expires_at);
            return (
              <ClaimItemSummary item={item} key={key}>
                <div className="d-flex align-items-center gap-3">
                  <span className={expiry.warning ? 'claim-expiry-warning text-warning fw-semibold' : 'text-muted'}>
                    {expiry.label}
                  </span>
                  <Button
                    color="outline-secondary"
                    aria-label={`Release ${item.title}`}
                    disabled={Boolean(releasing)}
                    onClick={() => handleRelease(item)}
                  >
                    {releasing === key ? 'Releasing...' : 'Release'}
                  </Button>
                </div>
              </ClaimItemSummary>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default MyClaimedItems;
