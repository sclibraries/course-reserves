import { useCallback, useState } from 'react';
import { adminResourceService } from '../../services/admin/adminResourceService';
import { notify } from '../../services/notify';

const toFormRecord = (resource) => ({
  ...resource,
  title: resource.name || '',
  link: resource.item_url || '',
  notes: resource.description || '',
  folder: resource.folder_id || '',
  metadata: Array.isArray(resource.metadata)
    ? resource.metadata.reduce((values, item) => {
      if (item?.field_name) values[item.field_name] = item.field_value;
      return values;
    }, {})
    : (resource.metadata || {}),
});

export const useResourceReuse = () => {
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(false);

  const selectResource = useCallback(async (resourceId) => {
    setLoading(true);
    try {
      setResource(toFormRecord(await adminResourceService.getResourceById(resourceId)));
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
