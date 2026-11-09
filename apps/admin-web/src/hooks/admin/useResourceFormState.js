import { useEffect, useState } from 'react';
import { useAdminCourseStore } from '../../store/adminCourseStore';
import { isHitchcockVideoUrl } from '../../util/externalLinks';

export const useResourceFormState = ({ initialData = {}, course }) => {
  const { folioCourseData, termStart, termEnd } = useAdminCourseStore();

  const getDefaultVisibilityDates = () => {
    if (course?.courseListingObject?.termObject) {
      const termObj = course.courseListingObject.termObject;
      return {
        startDate: new Date(termObj.startDate).toISOString().split('T')[0],
        endDate: new Date(termObj.endDate).toISOString().split('T')[0],
      };
    }

    if (termStart && termEnd) {
      return {
        startDate: new Date(termStart).toISOString().split('T')[0],
        endDate: new Date(termEnd).toISOString().split('T')[0],
      };
    }

    if (folioCourseData?.courseListingObject?.termObject) {
      const termObj = folioCourseData.courseListingObject.termObject;
      return {
        startDate: new Date(termObj.startDate).toISOString().split('T')[0],
        endDate: new Date(termObj.endDate).toISOString().split('T')[0],
      };
    }

    return { startDate: '', endDate: '' };
  };

  const defaultDates = getDefaultVisibilityDates();

  const normalizeProxyValue = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value === '1' || value === 'true' || value === 'TRUE';
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    return false;
  };

  const normalizeBooleanValue = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value === '1' || value === 'true' || value === 'TRUE';
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    return false;
  };

  const [formData, setFormData] = useState(() => {
    const hasPrimaryLinkControl = normalizeBooleanValue(initialData.use_primary_link_visibility);
    const primaryUrl = initialData.link || initialData.item_url || '';
    const isHitchcockVideo = isHitchcockVideoUrl(primaryUrl);

    return {
      title: initialData.title || initialData.name || '',
      link: initialData.link || initialData.item_url || '',
      use_proxy: normalizeProxyValue(initialData.use_proxy),
      notes: initialData.notes || initialData.description || '',
      internal_note: initialData.internal_note || '',
      external_note: initialData.external_note || '',
      folder: initialData.folder || initialData.folder_id || '',
      start_visibility: initialData.start_visibility || defaultDates.startDate,
      end_visibility: initialData.end_visibility || defaultDates.endDate,
      material_type_id: initialData.material_type_id || initialData.material_type || '',
      metadata: initialData.metadata || {},
      use_primary_link_visibility: hasPrimaryLinkControl || (isHitchcockVideo && !initialData.resource_id),
      primary_link_start_visibility: initialData.primary_link_start_visibility || ((isHitchcockVideo && !initialData.resource_id) ? defaultDates.startDate : ''),
      primary_link_end_visibility: initialData.primary_link_end_visibility || ((isHitchcockVideo && !initialData.resource_id) ? defaultDates.endDate : ''),
      ...(initialData.resource_id && { resource_id: initialData.resource_id }),
      ...(initialData.order && { order: initialData.order }),
    };
  });

  const [useVisibilityDates, setUseVisibilityDates] = useState(
    !!(initialData.start_visibility || initialData.end_visibility)
  );
  const [cascadeVisibilityToLinks, setCascadeVisibilityToLinks] = useState(false);

  useEffect(() => {
    if (course?.courseListingObject?.termObject) {
      const termObj = course.courseListingObject.termObject;
      setFormData(prev => ({
        ...prev,
        start_visibility: prev.start_visibility || new Date(termObj.startDate).toISOString().split('T')[0],
        end_visibility: prev.end_visibility || new Date(termObj.endDate).toISOString().split('T')[0],
      }));
    } else if (termStart && termEnd) {
      setFormData(prev => ({
        ...prev,
        start_visibility: prev.start_visibility || new Date(termStart).toISOString().split('T')[0],
        end_visibility: prev.end_visibility || new Date(termEnd).toISOString().split('T')[0],
      }));
    } else if (folioCourseData?.courseListingObject?.termObject) {
      const termObj = folioCourseData.courseListingObject.termObject;
      setFormData(prev => ({
        ...prev,
        start_visibility: prev.start_visibility || new Date(termObj.startDate).toISOString().split('T')[0],
        end_visibility: prev.end_visibility || new Date(termObj.endDate).toISOString().split('T')[0],
      }));
    }
  }, [course, termStart, termEnd, folioCourseData]);

  const [links, setLinks] = useState(() => {
    const existingLinks = (initialData.links || []).filter(link => link.order !== 0 && link.order !== '0');
    return existingLinks.map(link => ({ ...link }));
  });
  const [materialTypes, setMaterialTypes] = useState([]);
  const [materialTypeFields, setMaterialTypeFields] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  return {
    defaultDates,
    formData,
    setFormData,
    useVisibilityDates,
    setUseVisibilityDates,
    cascadeVisibilityToLinks,
    setCascadeVisibilityToLinks,
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
