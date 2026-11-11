import { buildProxyUrl } from './proxyUtil';

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

export const serializeResourcePayload = (
  formData,
  { isEdit = false, mode = 'course', course, courseResourceId } = {},
) => {
  const { links, ...resourceData } = formData;
  const payload = {
    ...serializeProxyLink(resourceData, 'link'),
    ...(links && { links: links.map((link) => serializeProxyLink(link, 'url')) }),
  };
  if (!isEdit) return payload;

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
  return { resource_id, ...updateData };
};
