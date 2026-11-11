const normalizeProxyValue = (value) => (
  value === true || value === 1 || value === '1' || value === 'true' || value === 'TRUE'
);

const transformMetadata = (metadata) => (
  Array.isArray(metadata)
    ? metadata.reduce((values, item) => {
      if (item?.field_name) values[item.field_name] = item.field_value;
      return values;
    }, {})
    : (metadata || {})
);

export const resourceToFormData = (resource) => ({
  resource_id: resource.resource_id || null,
  title: resource.name || '',
  link: resource.item_url || '',
  use_proxy: normalizeProxyValue(resource.use_proxy),
  folder: resource.folder_id || null,
  notes: resource.description || '',
  internal_note: resource.internal_note || '',
  external_note: resource.external_note || '',
  start_visibility: resource.start_visibility || null,
  end_visibility: resource.end_visibility || null,
  use_resource_visibility: resource.use_resource_visibility,
  material_type_id: resource.material_type_id || null,
  order: resource.order || null,
  created_at: resource.created_at || '',
  material_type_name: resource.material_type_name || '',
  metadata: transformMetadata(resource.metadata),
  links: resource.links || [],
  use_primary_link_visibility: normalizeProxyValue(resource.use_primary_link_visibility),
  primary_link_start_visibility: resource.primary_link_start_visibility || null,
  primary_link_end_visibility: resource.primary_link_end_visibility || null,
});

export default resourceToFormData;
