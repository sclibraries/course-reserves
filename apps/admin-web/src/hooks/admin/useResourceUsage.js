import { useEffect, useState } from 'react';
import { adminResourceService } from '../../services/admin/adminResourceService';
import { notify } from '../../services/notify';

export const useResourceUsage = (resourceId) => {
  const [state, setState] = useState({ usage: null, loading: Boolean(resourceId), error: false });

  useEffect(() => {
    if (!resourceId) return undefined;

    let current = true;
    setState({ usage: null, loading: true, error: false });
    adminResourceService.getUsage(resourceId).then((usage) => {
      if (current) setState({ usage, loading: false, error: false });
    }).catch((error) => {
      if (current) {
        setState({ usage: null, loading: false, error: true });
        notify.fromError(error, "Couldn't check resource usage");
      }
    });

    return () => { current = false; };
  }, [resourceId]);

  return state;
};

export default useResourceUsage;
