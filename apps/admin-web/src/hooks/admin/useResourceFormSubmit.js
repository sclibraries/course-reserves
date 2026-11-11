import { useCallback } from 'react';
import { notify } from '../../services/notify';
import { adminCourseService } from '../../services/admin/adminCourseService';
import { adminResourceService } from '../../services/admin/adminResourceService';
import { offeringLinkApi } from '../../services/admin/course/offeringLinkApi';
import { associationSettings, serializeResourcePayload } from '../../util/resourcePayload';
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
      } else if (formType === ResourceFormType.REUSE) {
        result = await offeringLinkApi.reuseResource(
          course.offering_id,
          payload.resource_id,
          associationSettings(payload),
        );
      } else {
        result = await adminCourseService.createResource(
          course.offering_id,
          course.course_id,
          payload,
          folioCourseData,
        );
      }

      if (result !== false) {
        const message = {
          [ResourceFormType.EDIT]: 'Resource updated',
          [ResourceFormType.REUSE]: `Added ${payload.title} to this course`,
        }[formType] || 'Resource added';
        notify.success(message);
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
