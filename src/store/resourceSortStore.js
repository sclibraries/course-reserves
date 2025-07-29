import { create } from 'zustand';

/**
 * useResourceSortStore
 * --------------------
 * This store manages sorting state for resource tables across different views:
 * - Unified view: shared sort state for the combined table
 * - Split view: independent sort states for electronic and physical resource tables
 * - Data is always refreshed from backend to ensure consistency
 *
 * Usage:
 * const { 
 *   unifiedSort, setUnifiedSort,
 *   electronicSort, setElectronicSort,
 *   physicalSort, setPhysicalSort
 * } = useResourceSortStore();
 */
export const useResourceSortStore = create((set, get) => ({
  // Unified view sort state (when viewing all resources together)
  unifiedSort: 'manual',
  
  // Split view sort states (independent for each table)
  electronicSort: 'manual',
  physicalSort: 'manual',
  
  // Actions for unified view
  setUnifiedSort: (sortType) => {
    set({ unifiedSort: sortType });
  },
  
  // Actions for split view - electronic resources
  setElectronicSort: (sortType) => {
    set({ electronicSort: sortType });
  },
  
  // Actions for split view - physical resources  
  setPhysicalSort: (sortType) => {
    set({ physicalSort: sortType });
  },
  
  // Reset all sort states
  resetAll: () => {
    set({
      unifiedSort: 'manual',
      electronicSort: 'manual',
      physicalSort: 'manual'
    });
  },
  
  // Get the appropriate sort for a specific table type and view
  getSortForTable: (tableType, view) => {
    const state = get();
    if (view === 'unified') {
      return state.unifiedSort;
    }
    return tableType === 'electronic' ? state.electronicSort : state.physicalSort;
  },
  
  // Get the appropriate setter for a specific table type and view
  getSetterForTable: (tableType, view) => {
    const state = get();
    if (view === 'unified') {
      return state.setUnifiedSort;
    }
    return tableType === 'electronic' ? state.setElectronicSort : state.setPhysicalSort;
  }
}));
