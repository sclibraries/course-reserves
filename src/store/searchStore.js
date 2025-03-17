// store/searchStore.js
import { create } from 'zustand';

const useSearchStore = create(
    (set) => ({
      // Existing state
      college: 'all',
      type: 'all',
      query: '',
      limit: '100',
      department: '',
      sortOption: '',
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

      resetSearchParams: () =>
        set({
          college: 'all',
          type: 'all',
          query: '',
          limit: '100',
          department: '',
          sortOption: '',
          termId: null,
        }),

      // NEW: fetchTerms action
      fetchTerms: async () => {
        try {
          set({ termsLoading: true });
          const res = await fetch('https://libtools2.smith.edu/folio/web/search/search-terms');
          if (!res.ok) {
            throw new Error(`Failed to fetch terms: ${res.statusText}`);
          }
          const json = await res.json();
          const termItems = json?.response?.data?.terms?.item || [];

          // Optionally, choose a default term ID or leave it null
          // e.g. pick the one that is "active" by date or just the first in the list:
          const defaultTermId = termItems[0]?.id ?? null;

          set({
            terms: termItems,
            termId: defaultTermId,  // Set the default
            termsLoading: false,
          });
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
