import { useCallback } from 'react';
import { notify } from '../../services/notify';
import { adminCourseService } from '../../services/admin/adminCourseService';
import { adminResourceService } from '../../services/admin/adminResourceService';
import { buildProxyUrl } from '../../util/proxyUtil';
import { ResourceFormType } from '../../components/admin/forms/constants/formTypes';

const serializeProxyLink = (link, urlField) => {
  const { loaded, ...data } = link;
  return {
    ...data,
    [urlField]: buildProxyUrl({ url: data[urlField], use_proxy: data.use_proxy }, loaded),
  };
};

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
      const { links, ...resourceData } = formData;
      const payload = {
        ...serializeProxyLink(resourceData, 'link'),
        ...(links && {
          links: links.map((link) => serializeProxyLink(link, 'url')),
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
