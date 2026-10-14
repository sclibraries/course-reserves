import { isItemVisible } from '../resourceVisibility';

export function buildCombinedResults(records, filter, searchQuery, canBypassVisibility) {
    const filteredBySearch = searchQuery.trim() !== ''
      ? records.filter(item =>
          item.copiedItem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.copiedItem.contributors?.some(c =>
            c.name?.toLowerCase().includes(searchQuery.toLowerCase())
          ))
        )
      : records;
  
    const filtered = filter === 'all'
      ? filteredBySearch
      : filteredBySearch.filter(item =>
          filter === 'electronic' ? item.isElectronic : !item.isElectronic
        );

    const visibilityFiltered = filtered.filter(item => isItemVisible(item, canBypassVisibility));
  
    const electronicResources = visibilityFiltered.filter(item => item.isElectronic);
    const hasElectronic = electronicResources.length > 0;
    
    const allElectronicHave999 = hasElectronic && 
      electronicResources.every(item => item.order === 999 || item.order === "999");
    
    const hasSpecificOrders = visibilityFiltered.some(item => 
      item.order != null && item.order !== 999 && item.order !== "999"
    );

    if (!hasElectronic || (allElectronicHave999 && !hasSpecificOrders)) {
      console.log('Using original server order - no electronic or all 999 orders');
      
      const groupedTemp = {};
      let ungroupedTemp = [];
    
      visibilityFiltered.forEach(item => {
        if (item.folder_id) {
          const key = item.folder_name;
          (groupedTemp[key] ||= []).push(item);
        } else {
          ungroupedTemp.push(item);
        }
      });
    
      const groupedArray = Object.entries(groupedTemp)
        .map(([folder, items]) => ({
          folder,
          items
        }))
        .sort((a, b) =>
          a.folder.toLowerCase().localeCompare(b.folder.toLowerCase())
        );
    
      const merged = [];
      let i = 0, j = 0;
      while (i < ungroupedTemp.length && j < groupedArray.length) {
        const firstUngrouped = ungroupedTemp[i];
        const firstInGroup = groupedArray[j].items[0];
        
        const ungroupedIndex = visibilityFiltered.indexOf(firstUngrouped);
        const groupedIndex = visibilityFiltered.indexOf(firstInGroup);
        
        if (ungroupedIndex <= groupedIndex) {
          merged.push(ungroupedTemp[i++]);
        } else {
          merged.push(groupedArray[j++]);
        }
      }
      while (i < ungroupedTemp.length) merged.push(ungroupedTemp[i++]);
      while (j < groupedArray.length)   merged.push(groupedArray[j++]);
    
      return merged;
    }
    
    if (hasSpecificOrders) {
      console.log('Using specific order sorting');
      const sortedFiltered = visibilityFiltered
        .slice()
        .sort((a, b) => {
          const ao = a.order != null ? Number(a.order) : Infinity;
          const bo = b.order != null ? Number(b.order) : Infinity;
          
          if (ao === 999 && bo === 999) {
            return 0;
          }
          
          if (ao !== bo) return ao - bo;
          
          return a.copiedItem.title
            .toLowerCase()
            .localeCompare(b.copiedItem.title.toLowerCase());
        });

      const groupedTemp = {};
      let ungroupedTemp = [];
    
      sortedFiltered.forEach(item => {
        if (item.folder_id) {
          const key = item.folder_name;
          (groupedTemp[key] ||= []).push(item);
        } else {
          ungroupedTemp.push(item);
        }
      });
    
      const groupedArray = Object.entries(groupedTemp)
        .map(([folder, items]) => ({
          folder,
          items
        }))
        .sort((a, b) =>
          a.folder.toLowerCase().localeCompare(b.folder.toLowerCase())
        );
    
      const merged = [];
      let i = 0, j = 0;
      while (i < ungroupedTemp.length && j < groupedArray.length) {
        const firstUngrouped = ungroupedTemp[i];
        const firstInGroup = groupedArray[j].items[0];
        
        const ungroupedIndex = sortedFiltered.indexOf(firstUngrouped);
        const groupedIndex = sortedFiltered.indexOf(firstInGroup);
        
        if (ungroupedIndex <= groupedIndex) {
          merged.push(ungroupedTemp[i++]);
        } else {
          merged.push(groupedArray[j++]);
        }
      }
      while (i < ungroupedTemp.length) merged.push(ungroupedTemp[i++]);
      while (j < groupedArray.length)   merged.push(groupedArray[j++]);
    
      return merged;
    }
  
    console.log('Using fallback grouping logic');
    const groupedTemp = {};
    let ungroupedTemp = [];
  
    visibilityFiltered.forEach(item => {
      if (item.folder_id) {
        const key = item.folder_name;
        (groupedTemp[key] ||= []).push(item);
      } else {
        ungroupedTemp.push(item);
      }
    });
  
    ungroupedTemp.sort((a, b) =>
      a.copiedItem.title.toLowerCase()
        .localeCompare(b.copiedItem.title.toLowerCase())
    );
  
    const groupedArray = Object.entries(groupedTemp)
      .map(([folder, items]) => ({
        folder,
        items: items.sort((a, b) =>
          a.copiedItem.title.toLowerCase()
            .localeCompare(b.copiedItem.title.toLowerCase())
        )
      }))
      .sort((a, b) =>
        a.folder.toLowerCase().localeCompare(b.folder.toLowerCase())
      );
  
    const merged = [];
    let i = 0, j = 0;
    while (i < ungroupedTemp.length && j < groupedArray.length) {
      const titleA = ungroupedTemp[i].copiedItem.title.toLowerCase();
      const titleG = groupedArray[j].folder.toLowerCase();
      if (titleA <= titleG) {
        merged.push(ungroupedTemp[i++]);
      } else {
        merged.push(groupedArray[j++]);
      }
    }
    while (i < ungroupedTemp.length) merged.push(ungroupedTemp[i++]);
    while (j < groupedArray.length)   merged.push(groupedArray[j++]);
  
    return merged;
}
