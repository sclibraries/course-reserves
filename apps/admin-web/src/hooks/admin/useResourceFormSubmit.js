import { useCallback } from 'react';
import { notify } from '../../services/notify';
import { adminCourseService } from '../../services/admin/adminCourseService';
import { adminResourceService } from '../../services/admin/adminResourceService';
import { buildProxyUrl } from '../../util/proxyUtil';
import { ResourceFormType } from '../../components/admin/forms/constants/formTypes';

export function useResourceFormSubmit({
  formType,
  course,
  folioCourseData,
  onUpdate,
  onSubmit,
  onClose,
  setLoading,
  setError,
}) {
  return useCallback(async (formData) => {
    try {
      setLoading(true);
      const { raw_link, original_link, original_use_proxy, links, ...resourceData } = formData;
      const payload = {
        ...resourceData,
        link: buildProxyUrl({
          url: formData.link,
          use_proxy: formData.use_proxy,
          raw_url: raw_link,
          original_url: original_link,
          original_use_proxy,
        }),
        ...(links && {
          links: links.map((link) => {
            const {
              raw_url: rawUrl,
              original_url: originalUrl,
              original_use_proxy: originalUseProxy,
              ...data
            } = link;
            return {
              ...data,
              url: buildProxyUrl({
                ...data,
                raw_url: rawUrl,
                original_url: originalUrl,
                original_use_proxy: originalUseProxy,
              }),
            };
          }),
        }),
      };

      let result;
      if (formType === ResourceFormType.EDIT) {
        const { resource_id, ...updateData } = payload;
        result = await onUpdate?.(payload)
          || await adminResourceService.updateResource(resource_id, updateData);
      } else {
        result = await adminCourseService.createResource(
          course.offering_id,
          course.course_id,
          payload,
          folioCourseData,
        );
      }

      if (result !== false) {
        notify.success(formType === ResourceFormType.EDIT ? 'Resource updated' : 'Resource added');
        onSubmit?.(payload);
        onClose();
      }

      return result;
    } catch (err) {
      console.error('Error submitting resource:', err);
      setError("Couldn't save the resource");
      notify.fromError(err, "Couldn't save the resource");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [formType, course, folioCourseData, onUpdate, onSubmit, onClose, setLoading, setError]);
}
