import { useState } from 'react';
import { useAdminCourseStore } from '../../store/adminCourseStore';
import { loadProxyLink } from '../../util/proxyUtil';
import {
  getVisibilityFormDefaults,
  getVisibilityTermDates,
  normalizeVisibilityFlag,
  useVisibilityFormState,
} from './useVisibilityFormState';

export const useResourceFormState = ({ initialData = {}, course, sourceType = 'new' }) => {
  const { folioCourseData, termStart, termEnd } = useAdminCourseStore();
  const defaultDates = getVisibilityTermDates({ course, folioCourseData, termStart, termEnd });
  const visibilityDefaults = getVisibilityFormDefaults({ initialData, sourceType, defaultDates });
  const [formData, setFormData] = useState(() => {
    const primaryLink = loadProxyLink({
      link: initialData.link || initialData.item_url || '',
      use_proxy: initialData.use_proxy,
    });

    return {
      title: initialData.title || initialData.name || '',
      link: primaryLink.link,
      use_proxy: primaryLink.use_proxy,
      loaded: primaryLink.loaded,
      notes: initialData.notes || initialData.description || '',
      internal_note: initialData.internal_note || '',
      external_note: initialData.external_note || '',
      folder: initialData.folder || initialData.folder_id || '',
      ...visibilityDefaults,
      material_type_id: initialData.material_type_id || initialData.material_type || '',
      metadata: initialData.metadata || {},
      ...(initialData.resource_id && { resource_id: initialData.resource_id }),
      ...(initialData.order && { order: initialData.order }),
    };
  });
  const [links, setLinks] = useState(() => (
    (initialData.links || [])
      .filter((link) => link.order !== 0 && link.order !== '0')
      .map((link) => ({
        ...loadProxyLink(link),
        use_link_visibility: normalizeVisibilityFlag(link.use_link_visibility),
      }))
  ));
  const [materialTypes, setMaterialTypes] = useState([]);
  const [materialTypeFields, setMaterialTypeFields] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const visibilityState = useVisibilityFormState({
    defaultDates, initialData, sourceType, formData, setFormData, links, setLinks,
  });

  return {
    defaultDates,
    formData,
    setFormData,
    ...visibilityState,
    links,
    setLinks,
    materialTypes,
    setMaterialTypes,
    materialTypeFields,
    setMaterialTypeFields,
    errorMessage,
    setErrorMessage,
  };
};

export default useResourceFormState;
