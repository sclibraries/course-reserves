// store/adminSearchStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { config } from '../config';
import { sortTerms, getCurrentTerm } from '../utils/termSorting';

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
      termSelectionMade: false,

      setTermId: (termId) => set({ termId, termSelectionMade: true }),
      setTerms: (terms) => set({ terms }),
      termsLoading: false,

      // New functions for setting defaults
      // Initialize defaults if not already set
      initializeDefaults: (institution, currentTermId) => {
        const currentState = useAdminSearchStore.getState();
        
        // Only set defaults if we haven't already set them and college is still 'all'
        if (currentState.college === 'all' && !currentState.defaultsSet) {
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
            termId: currentState.termSelectionMade ? currentState.termId : currentTermId,
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
      fetchTerms: async (setDefaultTerm = false) => {
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
          
          const stateUpdate = {
            terms: sortedTerms,
            termsLoading: false,
          };
          
          // A null termId may be an explicit All Terms choice.
          if (
            setDefaultTerm &&
            currentState.termId === null &&
            !currentState.termSelectionMade &&
            !currentState.defaultsSet
          ) {
            // Use 'admin' mode: prefer upcoming term as soon as it starts
            const currentTerm = getCurrentTerm(sortedTerms, 'admin');
            const defaultTermId = currentTerm?.id ?? null;
            stateUpdate.termId = defaultTermId;
          }
          
          set(stateUpdate);
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
