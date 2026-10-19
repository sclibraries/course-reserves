import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Spinner } from 'reactstrap';
import { getClaimsErrorMessage } from '../../../../services/admin/workflowClaims/claimsFormatters';
import { staffGroupsApi } from '../../../../services/admin/staffGroupsApi';
import GroupQueue from './GroupQueue';

function MyGroups() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await staffGroupsApi.getMyGroups();
      setGroups(result?.groups || []);
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  if (selectedGroup) {
    return <GroupQueue group={selectedGroup} onBack={() => setSelectedGroup(null)} />;
  }

  return (
    <section aria-labelledby="my-groups-title">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h1 id="my-groups-title" className="h3 mb-1">My groups</h1>
          <p className="text-muted mb-0">Shared queues for your staff groups.</p>
        </div>
        <Button color="outline-primary" onClick={loadGroups} disabled={loading}>Refresh</Button>
      </div>
      {error && <Alert color="danger" role="alert">{error}</Alert>}
      {loading && <div className="text-center py-4"><Spinner /><p className="mt-2">Loading your groups...</p></div>}
      {!loading && !error && groups.length === 0 && <Alert color="info">You are not a member of any staff groups.</Alert>}
      {!loading && groups.length > 0 && (
        <div className="d-grid gap-2">
          {groups.map((group) => {
            const count = Number(group.queue_count) || 0;
            return (
              <div className="border rounded p-3 d-flex justify-content-between align-items-center gap-3" key={group.id}>
                <div>
                  <h2 className="h5 mb-1">{group.name}</h2>
                  <p className="text-muted mb-0">{count} queued item{count === 1 ? '' : 's'}</p>
                </div>
                <Button color="primary" aria-label={`Open ${group.name} queue`} onClick={() => setSelectedGroup(group)}>
                  Open queue
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default MyGroups;
