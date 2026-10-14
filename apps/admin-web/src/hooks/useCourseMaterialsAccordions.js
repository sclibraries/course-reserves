import { useCallback, useEffect, useState } from 'react';

export function useCourseMaterialsAccordions(records) {
  const [openAccordions, setOpenAccordions] = useState({});

  // Initialize open accordions for print reserves
  useEffect(() => {
    const initialOpen = {};
    records.forEach(recordItem => {
      if (!recordItem.isElectronic && recordItem.copiedItem.instanceId) {
        const instanceId = recordItem.copiedItem.instanceId;
        initialOpen[instanceId] = [`reserves-${instanceId}`];
      }
    });
    setOpenAccordions(initialOpen);
  }, [records]);

  const toggleAccordion = useCallback((instanceId, accordionId) => {
    setOpenAccordions(prev => {
      const isOpen = prev[instanceId]?.includes(accordionId);
      let newOpen;
      if (isOpen) {
        newOpen = prev[instanceId].filter(id => id !== accordionId);
      } else {
        newOpen = [...(prev[instanceId] || []), accordionId];
      }
      return {
        ...prev,
        [instanceId]: newOpen,
      };
    });
  }, []);

  return { openAccordions, toggleAccordion };
}
