import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { claimsApi } from '../../../../services/admin/workflowClaims/claimsApi';
import { getClaimsErrorMessage, sortQueueItems } from '../../../../services/admin/workflowClaims/claimsFormatters';
import { staffGroupsApi } from '../../../../services/admin/staffGroupsApi';
import useMutation from '../../../../hooks/admin/useMutation';
import QueueItemList from '../claims/QueueItemList';

function GroupQueue({ group, onBack }) {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { pending: claimingKey, error, setError, run } = useMutation();

  const loadQueue = useCallback(async (preserveError = false) => {
    setLoading(true);
    if (!preserveError) setError('');
    try {
      const result = await staffGroupsApi.getGroupQueue(group.id);
      setItems(sortQueueItems(result.items));
      setCount(Number(result.count) || 0);
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [group.id, setError]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const handleClaim = async (item) => {
    const key = `${item.kind}/${item.id}`;
    await run(() => claimsApi.claimItem(item.kind, item.id), {
      pendingKey: key,
      reload: loadQueue,
      onError: async (requestError) => {
      if (requestError?.payload?.error_code === 'already_claimed') await loadQueue(true);
      },
    });
  };

  return (
    <section aria-labelledby="group-queue-title">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <Button color="link" className="p-0 mb-2" onClick={onBack}>Back to My groups</Button>
          <h1 id="group-queue-title" className="h3 mb-1">{group.name} queue</h1>
          <p className="text-muted mb-0">{count} item{count === 1 ? '' : 's'}</p>
        </div>
        <Button color="outline-primary" onClick={() => loadQueue()} disabled={loading}>Refresh</Button>
      </div>
      <QueueItemList
        items={items}
        loading={loading}
        error={error}
        emptyMessage="This group has no queued items."
        claimingKey={claimingKey || ''}
        onClaim={handleClaim}
      />
    </section>
  );
}

GroupQueue.propTypes = {
  group: PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, name: PropTypes.string.isRequired }).isRequired,
  onBack: PropTypes.func.isRequired,
};

export default GroupQueue;
