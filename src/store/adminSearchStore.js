// store/adminSearchStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { config } from '../config';
import { sortTerms } from '../utils/termSorting';

const useAdminSearchStore = create(
  persist(
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
      sort: 'name', // Default sort by name ascending
      defaultsSet: false, // Track whether defaults have been set

      setTermId: (termId) => set({ termId }),
      setTerms: (terms) => set({ terms }),
      termsLoading: false,

      // New functions for setting defaults
      // Initialize defaults if not already set
      initializeDefaults: (institution, currentTermId) => {
        const currentState = useAdminSearchStore.getState();
        
        // Only set defaults if this appears to be a fresh session
        // (college is 'all' and termId is null)
        if (currentState.college === 'all' && currentState.termId === null) {
          const institutionToCollegeKey = {
            'Smith College': 'smith',
            'Hampshire College': 'hampshire',
            'Mount Holyoke College': 'mtholyoke',
            'Amherst College': 'amherst',
            'UMass Amherst': 'umass'
          };
          
          const collegeKey = institutionToCollegeKey[institution] || 'all';
          
          set({ 
            college: collegeKey,
            termId: currentTermId,
            defaultsSet: true 
          });
        }
      },

      // Existing setters
      setCollege: (college) => set({ college }),
      setType: (type) => set({ type }),
      setQuery: (query) => set({ query }),
      setLimit: (limit) => set({ limit }),
      setDepartment: (department) => set({ department }),
      setSortOption: (sortOption) => set({ sortOption }),
      setSort: (sort) => set({ sort }),

      resetSearchParams: () => {
        const currentState = useAdminSearchStore.getState();
        set({
          // Preserve college and term selections
          college: currentState.college,
          type: 'all',
          query: '',
          limit: '100',
          department: '',
          sortOption: '',
          termId: currentState.termId, // Preserve current term selection
          // Keep defaultsSet as is to preserve user's established defaults
        });
      },

      // NEW: fetchTerms action
      fetchTerms: async () => {
        try {
          set({ termsLoading: true });
          // Use config for URL like searchStore does
          const url = `${config.api.urls.folio}/search/search-terms`;
          
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Failed to fetch terms: ${res.status}`);
          }
          
          const json = await res.json();
          
          // Use the same response structure as searchStore
          const termItems = json?.data?.terms || [];

          // Sort terms using utility function
          const sortedTerms = sortTerms(termItems);

          // Get current state to avoid overriding termId if it's already set
          const currentState = useAdminSearchStore.getState();
          
          set({
            terms: sortedTerms,
            // Only set termId to null if it wasn't already set to something else
            termId: currentState.termId !== null ? currentState.termId : null,
            termsLoading: false,
          });
        } catch (error) {
          console.error('Error fetching terms:', error);
          set({ termsLoading: false });
        }
      },
    }),
    {
      name: 'admin-search-storage', // Name of storage key
      getStorage: () => sessionStorage,
    }
  )
);

export default useAdminSearchStore;
