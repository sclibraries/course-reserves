import { create } from 'zustand';

export const useAdminResourceStore = create((set) => ({
  resources: [],
  setResources: (resources) => set({ resources }),
  addResource: (resource) => set((state) => ({ 
    resources: [...state.resources, resource] 
  })),
  clearResources: () => set({ resources: [] })
}));
