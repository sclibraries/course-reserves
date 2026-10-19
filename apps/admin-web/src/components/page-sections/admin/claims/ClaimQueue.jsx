import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, FormGroup, Input, Label, Spinner } from 'reactstrap';
import { claimsApi } from '../../../../services/admin/workflowClaims/claimsApi';
import { getClaimsErrorMessage, sortQueueItems } from '../../../../services/admin/workflowClaims/claimsFormatters';
import ClaimItemSummary from './ClaimItemSummary';

function ClaimQueue() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [filters, setFilters] = useState({ term: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState('');
  const [error, setError] = useState('');

  const loadQueue = useCallback(async (nextFilters, preserveError = false) => {
    setLoading(true);
    if (!preserveError) setError('');
    try {
      const result = await claimsApi.getQueue({ ...nextFilters, page: 1 });
      setItems(sortQueueItems(result?.items || []));
      setCount(Number(result?.count) || 0);
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadQueue({ term: '', type: '' }); }, [loadQueue]);

  const handleFilter = (event) => {
    event.preventDefault();
    loadQueue(filters);
  };

  const handleClaim = async (item) => {
    const key = `${item.kind}/${item.id}`;
    setClaiming(key);
    setError('');
    try {
      await claimsApi.claimItem(item.kind, item.id);
      await loadQueue(filters);
    } catch (requestError) {
      const message = getClaimsErrorMessage(requestError);
      if (requestError?.payload?.error_code === 'already_claimed') {
        await loadQueue(filters, true);
      }
      setError(message);
    } finally {
      setClaiming('');
    }
  };

  return (
    <section aria-labelledby="item-queue-title">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h1 id="item-queue-title" className="h3 mb-1">Item queue</h1>
          <p className="text-muted mb-0">{count} unclaimed item{count === 1 ? '' : 's'}</p>
        </div>
        <div className="d-flex gap-2">
          <Button color="outline-secondary" disabled title="My groups are added in AW-051">My groups</Button>
          <Button color="outline-primary" onClick={() => loadQueue(filters)} disabled={loading}>Refresh</Button>
        </div>
      </div>

      <Form className="row g-2 align-items-end mb-3" onSubmit={handleFilter}>
        <FormGroup className="col-sm-4 mb-0">
          <Label for="claim-queue-term">Term</Label>
          <Input id="claim-queue-term" name="term" value={filters.term} onChange={(event) => setFilters({ ...filters, term: event.target.value })} />
        </FormGroup>
        <FormGroup className="col-sm-4 mb-0">
          <Label for="claim-queue-type">Type</Label>
          <Input id="claim-queue-type" name="type" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })} />
        </FormGroup>
        <div className="col-sm-4"><Button type="submit" color="primary" disabled={loading}>Apply filters</Button></div>
      </Form>

      {error && <Alert color="danger" role="alert">{error}</Alert>}
      {loading && <div className="text-center py-4"><Spinner /><p className="mt-2">Loading item queue...</p></div>}
      {!loading && !items.length && <Alert color="success">No unclaimed items match these filters.</Alert>}
      {!loading && items.length > 0 && (
        <div className="d-grid gap-2">
          {items.map((item) => {
            const key = `${item.kind}/${item.id}`;
            return (
              <ClaimItemSummary item={item} key={key}>
                <Button
                  color="primary"
                  aria-label={`Claim ${item.title}`}
                  disabled={Boolean(claiming)}
                  onClick={() => handleClaim(item)}
                >
                  {claiming === key ? 'Claiming...' : 'Claim'}
                </Button>
              </ClaimItemSummary>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ClaimQueue;
