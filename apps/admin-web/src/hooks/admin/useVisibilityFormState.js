import { useCallback, useEffect } from 'react';
import { isHitchcockVideoUrl } from '../../util/externalLinks';
import { loadProxyLink } from '../../util/proxyUtil';

export const normalizeVisibilityFlag = (value) => (
  value === true || value === 1 || value === '1' || value === 'true' || value === 'TRUE'
);

export const getVisibilityTermDates = ({ course, folioCourseData, termStart, termEnd }) => {
  const courseTerm = course?.courseListingObject?.termObject;
  const folioTerm = folioCourseData?.courseListingObject?.termObject;
  const start = courseTerm?.startDate || (termStart && termEnd ? termStart : folioTerm?.startDate);
  const end = courseTerm?.endDate || (termStart && termEnd ? termEnd : folioTerm?.endDate);
  return {
    startDate: start ? new Date(start).toISOString().split('T')[0] : '',
    endDate: end ? new Date(end).toISOString().split('T')[0] : '',
  };
};

export const getVisibilityFormDefaults = ({ initialData = {}, sourceType = 'new', defaultDates }) => {
  const isEdit = sourceType === 'edit' || Boolean(initialData.resource_id);
  const isReuse = sourceType === 'reuse';
  const primaryUrl = loadProxyLink({
    link: initialData.link || initialData.item_url || '',
    use_proxy: initialData.use_proxy,
  }).link;
  const isHitchcockVideo = isHitchcockVideoUrl(primaryUrl);
  const isVideoType = String(initialData.material_type_id || initialData.material_type || '') === '3';
  const usesTermDates = !isEdit && !isReuse && (isVideoType || isHitchcockVideo);
  const has = (field) => Object.prototype.hasOwnProperty.call(initialData, field);
  const termDate = (field) => defaultDates[field === 'start_visibility' ? 'startDate' : 'endDate'];
  const date = (field) => {
    if (isReuse) return '';
    if (isEdit) return has(field) ? initialData[field] : '';
    return initialData[field] || (usesTermDates ? termDate(field) : '');
  };
  const startVisibility = date('start_visibility');
  const endVisibility = date('end_visibility');
  const primaryVisibility = isReuse
    ? false
    : (isHitchcockVideo && !isEdit
      ? true
      : (has('use_primary_link_visibility') && normalizeVisibilityFlag(initialData.use_primary_link_visibility)));

  return {
    start_visibility: startVisibility,
    end_visibility: endVisibility,
    use_resource_visibility: isReuse
      ? 0
      : (has('use_resource_visibility')
        ? initialData.use_resource_visibility
        : (isEdit ? 0 : (startVisibility || endVisibility ? 1 : 0))),
    use_primary_link_visibility: primaryVisibility,
    primary_link_start_visibility: isReuse
      ? ''
      : (isEdit
        ? (has('primary_link_start_visibility') ? initialData.primary_link_start_visibility : '')
        : (initialData.primary_link_start_visibility || (primaryVisibility && isHitchcockVideo ? defaultDates.startDate : ''))),
    primary_link_end_visibility: isReuse
      ? ''
      : (isEdit
        ? (has('primary_link_end_visibility') ? initialData.primary_link_end_visibility : '')
        : (initialData.primary_link_end_visibility || (primaryVisibility && isHitchcockVideo ? defaultDates.endDate : ''))),
  };
};

export const useVisibilityFormState = ({
  defaultDates, initialData, sourceType, formData, setFormData, setLinks,
}) => {
  const isEdit = sourceType === 'edit' || Boolean(initialData.resource_id);
  const isReuse = sourceType === 'reuse';
  const useVisibilityDates = normalizeVisibilityFlag(formData.use_resource_visibility);

  useEffect(() => {
    const isVideoType = String(formData.material_type_id) === '3';
    const isHitchcockVideo = isHitchcockVideoUrl(formData.link);
    if (isEdit || isReuse || (!isVideoType && !isHitchcockVideo)) return;

    setFormData((current) => {
      const start = current.start_visibility || defaultDates.startDate || current.start_visibility;
      const end = current.end_visibility || defaultDates.endDate || current.end_visibility;
      const shouldEnablePrimary = isHitchcockVideo && !normalizeVisibilityFlag(current.use_primary_link_visibility);
      const primaryStart = shouldEnablePrimary
        ? (current.primary_link_start_visibility || defaultDates.startDate || current.primary_link_start_visibility)
        : current.primary_link_start_visibility;
      const primaryEnd = shouldEnablePrimary
        ? (current.primary_link_end_visibility || defaultDates.endDate || current.primary_link_end_visibility)
        : current.primary_link_end_visibility;
      const resourceFlag = start || end ? 1 : current.use_resource_visibility;
      if (
        start === current.start_visibility
        && end === current.end_visibility
        && resourceFlag === current.use_resource_visibility
        && !shouldEnablePrimary
        && primaryStart === current.primary_link_start_visibility
        && primaryEnd === current.primary_link_end_visibility
      ) return current;
      return {
        ...current,
        start_visibility: start,
        end_visibility: end,
        use_resource_visibility: resourceFlag,
        ...(shouldEnablePrimary && {
          use_primary_link_visibility: true,
          primary_link_start_visibility: primaryStart,
          primary_link_end_visibility: primaryEnd,
        }),
      };
    });
  }, [defaultDates.endDate, defaultDates.startDate, formData.link, formData.material_type_id, isEdit, isReuse, setFormData]);

  const handleResourceVisibilityToggle = useCallback((enabled) => {
    setFormData((current) => ({
      ...current,
      use_resource_visibility: enabled ? 1 : 0,
      start_visibility: enabled ? (current.start_visibility || defaultDates.startDate) : '',
      end_visibility: enabled ? (current.end_visibility || defaultDates.endDate) : '',
    }));
  }, [defaultDates, setFormData]);

  const handleItemDateChange = useCallback((event) => {
    const { name, value } = event.target;
    const start = name === 'start_visibility' ? value : formData.start_visibility;
    const end = name === 'end_visibility' ? value : formData.end_visibility;
    const enabled = Boolean(start || end);
    setFormData((current) => ({
      ...current,
      [name]: value,
      use_resource_visibility: enabled ? 1 : 0,
    }));
  }, [formData.end_visibility, formData.start_visibility, setFormData]);

  const handlePrimaryLinkVisibilityToggle = useCallback((enabled) => setFormData((current) => ({
    ...current,
    use_primary_link_visibility: enabled,
    primary_link_start_visibility: enabled ? (current.primary_link_start_visibility || defaultDates.startDate) : '',
    primary_link_end_visibility: enabled ? (current.primary_link_end_visibility || defaultDates.endDate) : '',
  })), [defaultDates, setFormData]);

  const handlePrimaryLinkDateChange = useCallback(({ target: { name, value } }) => {
    setFormData((current) => ({ ...current, [name]: value }));
  }, [setFormData]);

  const handleLinkVisibilityChange = useCallback((index, enabled) => {
    setLinks((current) => current.map((link, linkIndex) => (
      linkIndex === index ? {
        ...link,
        use_link_visibility: enabled,
        start_visibility: enabled ? (link.start_visibility || defaultDates.startDate) : link.start_visibility,
        end_visibility: enabled ? (link.end_visibility || defaultDates.endDate) : link.end_visibility,
      } : link
    )));
  }, [defaultDates, setLinks]);

  const handleLinkDateChange = useCallback((index, field, value) => {
    setLinks((current) => current.map((link, linkIndex) => (
      linkIndex === index ? { ...link, [field]: value } : link
    )));
  }, [setLinks]);

  return {
    useVisibilityDates,
    handleResourceVisibilityToggle,
    handleItemDateChange,
    handlePrimaryLinkVisibilityToggle,
    handlePrimaryLinkDateChange,
    handleLinkVisibilityChange,
    handleLinkDateChange,
  };
};
