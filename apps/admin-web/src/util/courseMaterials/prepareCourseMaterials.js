export function prepareCourseMaterials(mergedResources, printReserves) {
  const folioPhysical = printReserves.map(rec => ({
    _isFallbackPrint: true,
    __orig: rec
  }));
  
  const mergedPhysical = mergedResources.filter(r => r.resource_type === 'physical');
  
  const mergedPhysicalIds = new Set(mergedPhysical.map(item => item.id));
  
  const newFolioPhysical = folioPhysical.filter(item => 
    !mergedPhysicalIds.has(item.__orig.instanceId)
  );
  
  let allMerged = [...mergedResources, ...newFolioPhysical];
  
  const hasAnyPhysical = mergedPhysical.length > 0 || newFolioPhysical.length > 0;
  
  console.log(`Physical resources summary:
    - Merged (with backend order): ${mergedPhysical.length}
    - New from FOLIO only: ${newFolioPhysical.length}
    - Total physical: ${hasAnyPhysical ? mergedPhysical.length + newFolioPhysical.length : 0}
    - Electronic + cross-linked: ${mergedResources.filter(r => r.resource_type === 'electronic').length}`);

  return { allMerged, hasAnyPhysical };
}
