import { useCallback, useState } from 'react';
import { notify } from '../../services/notify';
import { getClaimsErrorMessage } from '../../services/admin/workflowClaims/claimsFormatters';

export default function useMutation(formatError = getClaimsErrorMessage) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async (request, {
    pendingKey = true, successMessage, reload, onSuccess, onError,
  } = {}) => {
    setPending(pendingKey);
    setError('');
    try {
      const result = await request();
      await onSuccess?.(result);
      await reload?.();
      if (successMessage) notify.success(successMessage);
      return result;
    } catch (requestError) {
      await onError?.(requestError);
      setError(formatError(requestError));
      return null;
    } finally {
      setPending(false);
    }
  }, [formatError]);

  return { pending, error, setError, run };
}
