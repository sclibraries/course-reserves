import { useEffect, useState } from 'react';
import { adminResourceService } from '../../services/admin/adminResourceService';
import { notify } from '../../services/notify';

const isUsageResponse = (usage) => (
  Number.isInteger(usage?.course_count)
  && Array.isArray(usage.terms)
  && usage.terms.every((term) => typeof term?.term_name === 'string')
  && Number.isInteger(usage.linked_page_count)
);

export const useResourceUsage = (resourceId) => {
  const [state, setState] = useState({ usage: null, loading: Boolean(resourceId), error: false });

  useEffect(() => {
    if (!resourceId) return undefined;

    let current = true;
    setState({ usage: null, loading: true, error: false });
    adminResourceService.getUsage(resourceId).then((usage) => {
      if (!isUsageResponse(usage)) {
        throw Object.assign(new Error('Incomplete resource usage response'), {
          reference: usage?.reference || usage?.reference_id,
        });
      }
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
