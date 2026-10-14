export async function enrichCourseMaterials(normalized, hasAnyPhysical, fetchInventoryDetails) {
  if (hasAnyPhysical) {
    const physicalResources = normalized.filter(item => !item.isElectronic);
    
    const detailPromises = physicalResources.map(async (item) => {
      const instanceId = item.id;
      const instanceDetails = await fetchInventoryDetails(instanceId);

      if (instanceDetails) {
        let contributors = [];
        if (instanceDetails.contributors) {
          if (Array.isArray(instanceDetails.contributors)) {
            contributors = instanceDetails.contributors.map(c => ({ name: c.name }));
          } else if (instanceDetails.contributors) {
            contributors = [{ name: instanceDetails.contributors.name }];
          }
        }
        
        let publication = [];
        if (instanceDetails.publication) {
          if (Array.isArray(instanceDetails.publication)) {
            publication = instanceDetails.publication.map(p => ({
              publisher: p.publisher || '',
              place: p.place || '',
              dateOfPublication: p.dateOfPublication || ''
            }));
          } else if (instanceDetails.publication) {
            publication = [{
              publisher: instanceDetails.publication.publisher || '',
              place: instanceDetails.publication.place || '',
              dateOfPublication: instanceDetails.publication.dateOfPublication || ''
            }];
          }
        }
        console.log('Publication:', publication);

        const enhancedItem = {
          ...item,
          copiedItem: {
            ...item.copiedItem,
            contributors,
            publication
          }
        };
        console.log('Enhanced item:', enhancedItem.id, enhancedItem.copiedItem.contributors?.length, enhancedItem.copiedItem.publication?.length);
        return enhancedItem;
      }
      return item;
    });
    
    const enhancedItems = await Promise.all(detailPromises);
    
    normalized = normalized.map(item => {
      if (!item.isElectronic) {
        const enhancedItem = enhancedItems.find(enhanced => enhanced.id === item.id);
        if (enhancedItem) {
          console.log('Using enhanced data for item:', item.id);
          return enhancedItem;
        }
        console.log('No enhanced data found for item:', item.id);
        return item;
      }
      return item;
    });

    console.log('First 3 records after enhancement:', 
      normalized.slice(0, 3).map(r => ({
        id: r.id,
        title: r.copiedItem.title,
        isElectronic: r.isElectronic,
        contributors: r.copiedItem.contributors?.length || 0,
        publication: r.copiedItem.publication?.length || 0
      }))
    );
  }

  {
    const seen = new Set();
    normalized = normalized.filter(item => {
      const instId = item.copiedItem?.instanceId;
      if (!instId || seen.has(instId)) return false;
      seen.add(instId);
      return true;
    });
  }
  
  return normalized;
}
