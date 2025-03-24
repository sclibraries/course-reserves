// store/searchStore.js
import { create } from 'zustand';
import { config } from '../config';

const useSearchStore = create(
    (set) => ({
      // Existing state
      college: 'all',
      type: 'all',
      query: '',
      limit: '100',
      department: '',
      sortOption: '',
      displayMode: 'card',
      termId: null,
      terms: [],
      setTermId: (termId) => set({ termId }),
      setTerms: (terms) => set({ terms }),
      termsLoading: false,

      // Existing setters
      setCollege: (college) => set({ college }),
      setType: (type) => set({ type }),
      setQuery: (query) => set({ query }),
      setLimit: (limit) => set({ limit }),
      setDepartment: (department) => set({ department }),
      setSortOption: (sortOption) => set({ sortOption }),
      setDisplayMode: (displayMode) => set({ displayMode }),

      resetSearchParams: () =>
        set({
          college: 'all',
          type: 'all',
          query: '',
          limit: '100',
          department: '',
          sortOption: '',
          displayMode: 'card',
          termId: null,
        }),

      // Modified to use config and not automatically set termId
      fetchTerms: async (setDefaultTerm = false) => {
        try {
          set({ termsLoading: true });
          // Use config for URL
          const url = `${config.api.urls.folio}/search/search-terms`;
          console.log("Fetching terms from:", url);
          
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Failed to fetch terms: ${res.status}`);
          }
          
          const json = await res.json();
          console.log("Terms response:", json);
          
          // Get terms from the response (adjust path if needed)
          const termItems = json?.data?.terms || []; 
          
          // Only set termId if explicitly requested AND no termId is currently set
          const currentState = useSearchStore.getState();
          const stateUpdate = { 
            terms: termItems, 
            termsLoading: false 
          };
          
          // Only set termId if explicitly requested and none is already set
          if (setDefaultTerm && currentState.termId === null) {
            const defaultTermId = termItems[0]?.id ?? null;
            stateUpdate.termId = defaultTermId;
            console.log("Setting default term:", defaultTermId);
          }
          
          set(stateUpdate);
        } catch (error) {
          console.error('Error fetching terms:', error);
          set({ termsLoading: false });
        }
      },
    }),
    {
      name: 'search-storage', // Name of storage key
      getStorage: () => sessionStorage,
    }
);

export default useSearchStore;