import { create } from 'zustand';
import { adminCourseService } from '../services/admin/adminCourseService';
import { fetchRecords } from '../components/page-sections/course-record/api';
import { notify } from '../services/notify';

export const useAdminResourceStore = create((set, get) => ({
  // Electronic resources state
  resources: [],
  setResources: (resources) => set({ resources }),
  addResource: (resource) => set((state) => ({ 
    resources: [...state.resources, resource] 
  })),
  clearResources: () => set({ resources: [] }),

  // Print resources state
  printResources: [],
  setPrintResources: (printResources) => set({ printResources }),
  clearPrintResources: () => set({ printResources: [] }),

  // Linked courses state
  linkedCourses: [],
  setLinkedCourses: (linkedCourses) => set({ linkedCourses }),
  clearLinkedCourses: () => set({ linkedCourses: [] }),

  // Loading and error states
  loading: false,
  error: null,
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // Clear all course-related data
  clearCourseData: () => set({ 
    resources: [], 
    printResources: [], 
    linkedCourses: [],
    loading: false,
    error: null
  }),

  // Fetch electronic resources
  fetchResources: async (offeringId) => {
    if (!offeringId) {
      console.log('fetchResources: No offering ID provided');
      return;
    }

    try {
      const { resources: updated } = await adminCourseService.fetchCourseResources(offeringId);
      set({ resources: updated });
    } catch (err) {
      console.error('Error fetching resources:', err);
      notify.fromError(err, "Couldn't load resources");
      set({ error: "Couldn't load resources" });
      throw err;
    }
  },

  // Fetch print resources with order from FOLIO
  fetchPrintResources: async (folioCourseId, offeringId) => {
    if (!folioCourseId || !offeringId) {
      console.log('fetchPrintResources: Missing required IDs');
      return;
    }

    console.log('Loading print resources with order for offering:', offeringId);
    set({ loading: true, error: null });

    try {
      // 1) Get the raw FOLIO items
      const reserves = await fetchRecords(folioCourseId);

      // 2) Clean up orphaned references by sending current FOLIO resource IDs to backend
      const folioResourceIds = reserves.map(item => item.copiedItem?.instanceId).filter(Boolean);
      if (folioResourceIds.length > 0) {
        try {
          await adminCourseService.cleanupPhysicalResourceReferences(
            offeringId, 
            folioResourceIds
          );
        } catch (cleanupErr) {
          console.warn('Failed to cleanup orphaned physical resource references:', cleanupErr);
          // Don't fail the entire operation if cleanup fails
        }
      }

      // 3) Get local order references (after cleanup)
      const refs = await adminCourseService.getPhysicalResourceReferences(offeringId);

      // 4) Merge .order from refs into each FOLIO item
      const merged = reserves.map((item, idx) => {
        const match = refs.find(r => r.external_resource_id === item.copiedItem?.instanceId);
        return {
          ...item,
          order: match ? match.order : (idx + 1)
        };
      });

      // 5) Sort by that order
      merged.sort((a, b) => (a.order || 999) - (b.order || 999));

      console.log('Print resources loaded and sorted:', merged.map(m => ({ 
        title: m.copiedItem?.title, 
        order: m.order,
        instanceId: m.copiedItem?.instanceId
      })));

      // 6) Store in state
      set({ printResources: merged, loading: false });
    } catch (err) {
      console.error('Error loading print resources:', err);
      const errorMsg = "Couldn't load print resources";
      set({ error: errorMsg, loading: false });
      notify.fromError(err, errorMsg);
      throw err;
    }
  },

  // Fetch linked courses
  fetchLinkedCourses: async (offeringId) => {
    if (!offeringId) {
      console.log('fetchLinkedCourses: No offering ID provided');
      return;
    }

    try {
      const results = await adminCourseService.getLinkedCourses(offeringId);
      if (results) {
        set({ linkedCourses: results });
      }
    } catch (err) {
      console.error('Error fetching linked courses:', err);
      notify.fromError(err, "Couldn't load linked courses");
      set({ error: "Couldn't load linked courses" });
      throw err;
    }
  },

  // Unlink a resource
  unlinkResource: async (courseResourceId, offeringId) => {
    try {
      await adminCourseService.deleteResourceLink(courseResourceId);
      const { resources: updated } = await adminCourseService.fetchCourseResources(offeringId);
      set({ resources: updated });
      
      // Refetch linked courses if needed
      const { linkedCourses } = get();
      if (linkedCourses.length > 0) {
        await get().fetchLinkedCourses(offeringId);
      }
      
      notify.success('Resource unlinked');
    } catch (err) {
      console.error('Error unlinking resource:', err);
      notify.fromError(err, "Couldn't unlink the resource");
      throw err;
    }
  },

  // Update unified resource order (both electronic and print)
  updateUnifiedResourceOrder: async ({ electronic, print }, offeringId, folioCourseId) => {
    try {
      console.log('Starting unified reorder with:', { electronic, print });
      
      // Prepare API payloads - IMPORTANT: backend needs course_resource_id, not resource_id
      const electronicPayload = electronic.map(e => ({ 
        course_resource_id: e.course_resource_id, // This is the key field the backend expects
        order: e.order 
      }));
      
      const printPayload = print.map(p => ({
        external_resource_id: p.copiedItem?.instanceId || p.id?.replace('p-', ''), 
        order: p.order,
        display_name: p.copiedItem?.title || ''
      }));

      console.log('Sending updates:', { electronicPayload, printPayload });

      // 1) Update both batches sequentially to avoid race conditions
      if (electronicPayload.length > 0) {
        await adminCourseService.updateResourceOrder(offeringId, electronicPayload);
      }
      
      if (printPayload.length > 0) {
        await adminCourseService.updatePhysicalResourceOrder(offeringId, printPayload);
      }

      // 2) Wait a brief moment for backend processing
      await new Promise(resolve => setTimeout(resolve, 100));
  
      // 3) Re-fetch all data in the correct sequence
      const [
        { resources: freshElectronic },
        freshPrint,
        refs
      ] = await Promise.all([
        adminCourseService.fetchCourseResources(offeringId),
        fetchRecords(folioCourseId),
        adminCourseService.getPhysicalResourceReferences(offeringId)
      ]);
  
      // 4) Merge the order back into FOLIO items and sort by order
      const mergedPrint = freshPrint.map(item => {
        const ref = refs.find(r => r.external_resource_id === item.copiedItem?.instanceId);
        return {
          ...item,
          order: ref ? ref.order : (item.order || 999)
        };
      }).sort((a, b) => (a.order || 999) - (b.order || 999));
  
      // 5) Sort electronic resources by order
      const sortedElectronic = freshElectronic.sort((a, b) => (a.order || 999) - (b.order || 999));
  
      console.log('Final sorted data:', { 
        electronic: sortedElectronic.map(e => ({ id: e.resource_id, order: e.order })),
        print: mergedPrint.map(p => ({ id: p.copiedItem?.instanceId, order: p.order }))
      });

      // 6) Update state
      set({ resources: sortedElectronic, printResources: mergedPrint });
  
      notify.success('Resource order updated');
    } catch (err) {
      console.error('Error updating unified resource order:', err);
      notify.fromError(err, "Couldn't update the resource order");
      
      // On error, try to refresh the data to get back to a consistent state
      try {
        const { resources: fallbackElectronic } = await adminCourseService.fetchCourseResources(offeringId);
        set({ resources: fallbackElectronic });
        
        const fallbackPrint = await fetchRecords(folioCourseId);
        const fallbackRefs = await adminCourseService.getPhysicalResourceReferences(offeringId);
        const fallbackMerged = fallbackPrint.map(item => {
          const ref = fallbackRefs.find(r => r.external_resource_id === item.copiedItem?.instanceId);
          return { ...item, order: ref ? ref.order : (item.order || 999) };
        });
        set({ printResources: fallbackMerged });
      } catch (fallbackErr) {
        console.error('Error during fallback refresh:', fallbackErr);
      }
      throw err;
    }
  }
}));
