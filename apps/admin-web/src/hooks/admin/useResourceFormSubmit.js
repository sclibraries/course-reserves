import { useCallback } from 'react';
import { notify } from '../../services/notify';
import { adminCourseService } from '../../services/admin/adminCourseService';
import { adminResourceService } from '../../services/admin/adminResourceService';
import { adjustProxy, LIBPROXY_PREFIX } from '../../util/proxyUtil';
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
      adjustProxy(formData);

      if (formData.links && formData.links.length > 0) {
        formData.links = formData.links.map((link) => {
          if (link.use_proxy) {
            return {
              ...link,
              url: link.url.includes('proxy') ? link.url : `${LIBPROXY_PREFIX}${link.url}`,
            };
          }
          return link;
        });
      }

      let result;
      if (formType === ResourceFormType.EDIT) {
        const { resource_id, ...updateData } = formData;
        result = await onUpdate?.(formData)
          || await adminResourceService.updateResource(resource_id, updateData);
      } else {
        result = await adminCourseService.createResource(
          course.offering_id,
          course.course_id,
          formData,
          folioCourseData,
        );
      }

      if (result !== false) {
        notify.success(formType === ResourceFormType.EDIT ? 'Resource updated' : 'Resource added');
        onSubmit?.(formData);
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
