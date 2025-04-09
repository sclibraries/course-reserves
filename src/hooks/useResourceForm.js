import { useState, useEffect } from 'react';
import { adminMaterialTypeService } from '../services/admin/adminMaterialTypeService';
import { toast } from 'react-toastify';

/**
 * useResourceForm - Custom hook for handling resource form state and actions
 */
export const useResourceForm = (initialData = {}) => {
  // Form state
  const [formData, setFormData] = useState({
    title: initialData.title || initialData.name || '',
    link: initialData.link || initialData.item_url || '',
    notes: initialData.notes || initialData.description || '',
    internal_note: initialData.internal_note || '',
    external_note: initialData.external_note || '',
    use_proxy: initialData.use_proxy || false,
    material_type_id: initialData.material_type_id || '',
    folder: initialData.folder || initialData.folder_id || '',
    start_visibility: initialData.start_visibility || '',
    end_visibility: initialData.end_visibility || '',
    metadata: initialData.metadata || {},
    ...initialData
  });
  
  // Additional state
  const [links, setLinks] = useState(initialData.links || []);
  const [materialTypes, setMaterialTypes] = useState([]);
  const [materialTypeFields, setMaterialTypeFields] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Fetch material types on mount
  useEffect(() => {
    const fetchMaterialTypes = async () => {
      try {
        const { data } = await adminMaterialTypeService.getMaterialTypes();
        setMaterialTypes(data);
      } catch (err) {
        console.error('Error fetching material types:', err);
        setError('Failed to load material types');
      }
    };
    fetchMaterialTypes();
  }, []);
  
  // Fetch fields when material type changes
  useEffect(() => {
    if (formData.material_type_id) {
      fetchMaterialTypeFields(formData.material_type_id);
    }
  }, [formData.material_type_id]);
  
  // Handle field changes
  const handleFieldChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name in formData) {
      setFormData(prev => ({ ...prev, [name]: value }));
    } else {
      // Metadata field
      setFormData(prev => ({
        ...prev,
        metadata: { ...prev.metadata, [name]: value }
      }));
    }
  };
  
  // Handle material type change
  const handleMaterialTypeChange = (e) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      material_type_id: value,
      metadata: {} // Clear metadata when type changes
    }));
    fetchMaterialTypeFields(value);
  };
  
  // Reset form
  const resetForm = () => {
    setFormData({
      title: '',
      link: '',
      notes: '',
      internal_note: '',
      external_note: '',
      use_proxy: false,
      material_type_id: '',
      folder: '',
      start_visibility: '',
      end_visibility: '',
      metadata: {}
    });
    setLinks([]);
    setError(null);
  };
  
  // Fetch material type fields
  const fetchMaterialTypeFields = async (typeId) => {
    if (!typeId) return;
    
    try {
      const { data } = await adminMaterialTypeService.getMaterialTypeFields(typeId);
      setMaterialTypeFields(data);
    } catch (err) {
      console.error('Error fetching fields:', err);
      toast.error('Failed to load material type fields');
      setError('Failed to load material type fields');
    }
  };
  
  return {
    formData,
    setFormData,
    links,
    setLinks,
    materialTypes,
    materialTypeFields,
    isLoading,
    setIsLoading,
    error,
    setError,
    handleFieldChange,
    handleMaterialTypeChange,
    resetForm
  };
};

export default useResourceForm;
