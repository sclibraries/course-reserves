export function normalizeCourseMaterials({ allMerged, hasAnyPhysical, crossLinkedCourses }) {
  if (crossLinkedCourses.length > 0) {
    const crossLinkedResources = crossLinkedCourses.map(resource => ({
      _isCrossLinked: true,
      id: resource.resource_id,
      resource_type: 'electronic',
      title: resource.name,
      folder_id: resource.folder_id || null,
      folder_name: resource.folder_name || 'Cross-linked Courses',
      __resource: resource
    }));
    
    allMerged = [...allMerged, ...crossLinkedResources];
  }

  let normalized = allMerged.map(item => {
    if (item._isFallbackPrint) {
      return item.__orig;
    }

    if (item._isCrossLinked) {
      return {
        id: item.id,
        order: item.order != null ? Number(item.order) : null,
        isElectronic: true,
        folder_id: item.folder_id,
        folder_name: item.folder_name,
        resource: {
          resource_id: item.id,
          name: item.title,
          item_url: item.__resource.item_url,
          description: item.__resource.description,
          external_note: item.__resource.external_note,
          internal_note: item.__resource.internal_note,
          start_visibility: item.__resource.start_visibility,
          end_visibility: item.__resource.end_visibility,
          use_proxy: item.__resource.use_proxy,
          use_primary_link_visibility: item.__resource.use_primary_link_visibility,
          primary_link_start_visibility: item.__resource.primary_link_start_visibility,
          primary_link_end_visibility: item.__resource.primary_link_end_visibility,
          links: item.__resource.links || [],
          metadata: item.__resource.metadata || []
        },
        copiedItem: {
          instanceId: item.id,
          title: item.title,
          contributors: [],
          publication: [],
          callNumber: ''
        }
      };
    }
  
    const order = item.order != null ? Number(item.order) : null;
  
    if (item.resource_type === 'electronic') {
      return {
        id: item.id,
        order,
        isElectronic: true,
        folder_id: item.folder_id,
        folder_name: item.folder_name,
        resource: {
          resource_id:     item.id,
          name:            item.title,
          item_url:        item.item_url,
          description:     item.description,
          external_note:   item.external_note,
          internal_note:   item.internal_note,
          start_visibility:item.start_visibility,
          end_visibility:  item.end_visibility,
          use_proxy:       item.use_proxy,
          use_primary_link_visibility: item.use_primary_link_visibility,
          primary_link_start_visibility: item.primary_link_start_visibility,
          primary_link_end_visibility: item.primary_link_end_visibility,
          links:           item.links || [],
          metadata:        item.metadata || []
        },
        copiedItem: {
          instanceId:     item.id,
          title:          item.title,
          contributors:   [],
          publication:    [],
          callNumber:     ''
        }
      };
    } else {
      return {
        id: item.id,
        order,
        isElectronic: false,
        resource: null,
        copiedItem: {
          instanceId:   item.id,
          title:        item.title,
          contributors: [],
          publication:  [],
          callNumber:   item.callNumber  || '',
          barcode:      item.barcode     || '',
          holdingsId:   item.holdingsId  || '',
          instanceHrid: item.instanceHrid|| ''
        }
      };
    }
  });

  return { records: normalized, hasAnyPhysical };
}
