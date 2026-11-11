import { useCallback, useState } from 'react';
import { adminResourceService } from '../../services/admin/adminResourceService';
import { notify } from '../../services/notify';
import { resourceToFormData } from '../../util/resourceFormData';

export const useResourceReuse = () => {
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(false);

  const selectResource = useCallback(async (resourceId) => {
    setLoading(true);
    try {
      setResource(resourceToFormData(await adminResourceService.getResourceById(resourceId)));
    } catch (error) {
      notify.fromError(error, "Couldn't load the resource");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResource(null);
    setLoading(false);
  }, []);

  return { resource, loading, selectResource, reset };
};

export default useResourceReuse;
