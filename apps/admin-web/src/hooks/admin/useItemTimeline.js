import { useCallback, useState } from 'react';
import { claimsApi } from '../../services/admin/workflowClaims/claimsApi';
import { getClaimsErrorMessage } from '../../services/admin/workflowClaims/claimsFormatters';

function useItemTimeline(item) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await claimsApi.getItemTimeline(item.kind, item.id);
      setEvents(result.items);
      setLoaded(true);
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [item.kind, item.id, loaded, loading]);

  return { events, loading, error, load };
}

export default useItemTimeline;
