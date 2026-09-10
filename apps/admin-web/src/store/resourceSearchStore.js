import { create } from 'zustand';

// Update useResourceSearchStore.js
const useResourceSearchStore = create((set) => ({
    filters: {},
    results: [],
    pagination: {},
    error: null,
    loading: false,
    setFilters: (filters) => set({ filters }),
    resetFilters: () => set({ filters: {} }),
    setSearchResults: (results) => set({ results }),
    setPagination: (pagination) => set({ pagination }),
    setError: (error) => set({ error }),
    setLoading: (loading) => set({ loading })
  }));

  export default useResourceSearchStore;