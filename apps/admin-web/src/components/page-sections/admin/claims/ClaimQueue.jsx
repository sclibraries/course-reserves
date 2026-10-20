import { useCallback, useEffect, useState } from 'react';
import { Button, Form, FormGroup, Input, Label } from 'reactstrap';
import { claimsApi } from '../../../../services/admin/workflowClaims/claimsApi';
import { getClaimsErrorMessage, sortQueueItems } from '../../../../services/admin/workflowClaims/claimsFormatters';
import useMutation from '../../../../hooks/admin/useMutation';
import QueueItemList from './QueueItemList';

function ClaimQueue() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [filters, setFilters] = useState({ term: '', type: '' });
  const [loading, setLoading] = useState(true);
  const { pending: claiming, error, setError, run } = useMutation();

  const loadQueue = useCallback(async (nextFilters, preserveError = false) => {
    setLoading(true);
    if (!preserveError) setError('');
    try {
      const result = await claimsApi.getQueue({ ...nextFilters, page: 1 });
      setItems(sortQueueItems(result.items));
      setCount(Number(result.count) || 0);
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [setError]);

  useEffect(() => { loadQueue({ term: '', type: '' }); }, [loadQueue]);

  const handleFilter = (event) => {
    event.preventDefault();
    loadQueue(filters);
  };

  const handleClaim = async (item) => {
    const key = `${item.kind}/${item.id}`;
    await run(() => claimsApi.claimItem(item.kind, item.id), {
      pendingKey: key,
      reload: () => loadQueue(filters),
      onError: async (requestError) => {
      if (requestError?.payload?.error_code === 'already_claimed') {
        await loadQueue(filters, true);
      }
      },
    });
  };

  return (
    <section aria-labelledby="item-queue-title">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h1 id="item-queue-title" className="h3 mb-1">Item queue</h1>
          <p className="text-muted mb-0">{count} unclaimed item{count === 1 ? '' : 's'}</p>
        </div>
        <div className="d-flex gap-2">
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

      <QueueItemList
        items={items}
        loading={loading}
        error={error}
        emptyMessage="No unclaimed items match these filters."
        claimingKey={claiming || ''}
        onClaim={handleClaim}
      />
    </section>
  );
}

export default ClaimQueue;
