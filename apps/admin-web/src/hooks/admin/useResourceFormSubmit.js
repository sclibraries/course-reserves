import { useCallback } from 'react';
import { notify } from '../../services/notify';
import { adminCourseService } from '../../services/admin/adminCourseService';
import { adminResourceService } from '../../services/admin/adminResourceService';
import { serializeResourcePayload } from '../../util/resourcePayload';
import { ResourceFormType } from '../../components/admin/forms/constants/formTypes';

export function useResourceFormSubmit({
  formType,
  course,
  folioCourseData,
  mode = 'course',
  courseResourceId,
  onUpdate,
  onSubmit,
  onClose,
  setLoading,
  setError,
}) {
  return useCallback(async (formData) => {
    try {
      setLoading(true);
      const payload = serializeResourcePayload(formData, {
        isEdit: formType === ResourceFormType.EDIT,
        mode,
        course,
        courseResourceId,
      });

      let result;
      if (formType === ResourceFormType.EDIT) {
        const { resource_id, ...updateData } = payload;
        result = await onUpdate?.({ resource_id, ...updateData })
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
      notify.fromError(err, err.serverMessage || "Couldn't save the resource");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [formType, course, folioCourseData, mode, courseResourceId, onUpdate, onSubmit, onClose, setLoading, setError]);
}
