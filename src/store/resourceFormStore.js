// src/store/useResourceFormStore.js
import { create } from 'zustand';

export const useResourceFormStore = create((set) => ({
  formData: {
    // Direct database field mappings
    resource_id: null,
    name: '',
    item_url: '',
    use_proxy: false,
    folder_id: null,
    description: '',
    internal_note: '',
    external_note: '',
    start_visibility: null,
    end_visibility: null,
    material_type_id: null,
    order: null,
    created_at: ''
  },
  metadata: {},

  // Unified field setter
  setFormField: (fieldName, value) => {
    set((state) => ({
      formData: {
        ...state.formData,
        [fieldName]: value
      }
    }));
  },

  setMetadataField: (fieldName, value) => {
    set((state) => ({
      metadata: {
        ...state.metadata,
        [fieldName]: value
      }
    }));
  },

  resetForm: () => {
    set({
      formData: {
        resource_id: null,
        name: '',
        item_url: '',
        use_proxy: false,
        folder_id: null,
        description: '',
        internal_note: '',
        external_note: '',
        start_visibility: null,
        end_visibility: null,
        material_type_id: null,
        order: null,
        created_at: ''
      },
      metadata: {}
    });
  },

  loadInitialData: (apiResource) => {
    set({
      formData: {
        resource_id: apiResource.resource_id,
        name: apiResource.name,
        item_url: apiResource.item_url,
        use_proxy: Boolean(apiResource.use_proxy),
        folder_id: apiResource.folder_id,
        description: apiResource.description,
        internal_note: apiResource.internal_note,
        external_note: apiResource.external_note,
        start_visibility: apiResource.start_visibility,
        end_visibility: apiResource.end_visibility,
        material_type_id: apiResource.material_type_id,
        order: apiResource.order,
        created_at: apiResource.created_at
      },
      metadata: apiResource.metadata?.reduce((acc, curr) => {
        acc[curr.field_name] = curr.field_value;
        return acc;
      }, {}) || {}
    });
  }
}));