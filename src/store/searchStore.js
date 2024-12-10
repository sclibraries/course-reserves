import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useSearchStore = create(
  persist(
    (set) => ({
      // Initial state
      college: 'all',
      type: 'all',
      query: '',
      limit: '100',
      department: '',    // Add department
      sortOption: '',    // Add sortOption

      // Setters
      setCollege: (college) => set({ college }),
      setType: (type) => set({ type }),
      setQuery: (query) => set({ query }),
      setLimit: (limit) => set({ limit }),

      setDepartment: (department) => set({ department }), // New setter
      setSortOption: (sortOption) => set({ sortOption }), // New setter

      resetSearchParams: () =>
        set({ college: 'all', type: 'all', query: '', limit: '100', department: '', sortOption: '' }),
    }),
    {
      name: 'search-storage', // Name of storage key
      getStorage: () => sessionStorage, // Use sessionStorage to persist data across page refreshes
    }
  )
);

export default useSearchStore;
