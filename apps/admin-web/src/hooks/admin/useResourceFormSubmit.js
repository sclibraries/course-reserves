import { useCallback } from 'react';
import { notify } from '../../services/notify';
import { adminCourseService } from '../../services/admin/adminCourseService';
import { adminResourceService } from '../../services/admin/adminResourceService';
import { buildProxyUrl } from '../../util/proxyUtil';
import { ResourceFormType } from '../../components/admin/forms/constants/formTypes';

const RESOURCE_ASSOCIATION_FIELDS = [
  'start_visibility', 'end_visibility', 'use_resource_visibility',
  'primary_link_start_visibility', 'primary_link_end_visibility', 'use_primary_link_visibility',
];

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
        RESOURCE_ASSOCIATION_FIELDS.forEach((field) => {
          if (updateData[field] === '') updateData[field] = null;
        });
        if (mode === 'none') {
          RESOURCE_ASSOCIATION_FIELDS.forEach((field) => delete updateData[field]);
          delete updateData.offering_id;
          delete updateData.course_resource_id;
        } else {
          updateData.offering_id = course?.offering_id;
          updateData.course_resource_id = courseResourceId;
        }
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
