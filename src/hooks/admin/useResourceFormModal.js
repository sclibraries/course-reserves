import { useState, useCallback } from 'react';
import { ResourceFormType } from '../../components/admin/forms/constants/formTypes';

/**
 * useResourceFormModal - Custom hook for managing resource form modal state
 * 
 * This hook provides a clean interface for managing multiple resource form modals
 * while maintaining state consistency and providing useful utilities.
 * 
 * @returns {Object} Modal management object
 */
export const useResourceFormModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [formType, setFormType] = useState(ResourceFormType.NEW);
  const [initialData, setInitialData] = useState({});
  const [additionalProps, setAdditionalProps] = useState({});

  /**
   * Open modal with specific form type and data
   */
  const openModal = useCallback((type, data = {}, props = {}) => {
    setFormType(type);
    setInitialData(data);
    setAdditionalProps(props);
    setIsOpen(true);
  }, []);

  /**
   * Close modal and reset state
   */
  const closeModal = useCallback(() => {
    setIsOpen(false);
    setFormType(ResourceFormType.NEW);
    setInitialData({});
    setAdditionalProps({});
  }, []);

  /**
   * Convenience methods for specific form types
   */
  const openNewResourceForm = useCallback((data = {}) => {
    openModal(ResourceFormType.NEW, data);
  }, [openModal]);

  const openEditResourceForm = useCallback((resource) => {
    openModal(ResourceFormType.EDIT, resource);
  }, [openModal]);

  const openEDSForm = useCallback(() => {
    openModal(ResourceFormType.EDS);
  }, [openModal]);

  const openHitchcockForm = useCallback(() => {
    openModal(ResourceFormType.HITCHCOCK);
  }, [openModal]);

  const openReuseForm = useCallback((searchProps = {}) => {
    openModal(ResourceFormType.REUSE, {}, searchProps);
  }, [openModal]);

  const openCrosslinkForm = useCallback((resourceId, courseInfo = {}) => {
    openModal(ResourceFormType.CROSSLINK, courseInfo, { resourceId });
  }, [openModal]);

  /**
   * Check if specific form type is open
   */
  const isFormTypeOpen = useCallback((type) => {
    return isOpen && formType === type;
  }, [isOpen, formType]);

  return {
    // State
    isOpen,
    formType,
    initialData,
    additionalProps,
    
    // Actions
    openModal,
    closeModal,
    
    // Convenience methods
    openNewResourceForm,
    openEditResourceForm,
    openEDSForm,
    openHitchcockForm,
    openReuseForm,
    openCrosslinkForm,
    
    // Utilities
    isFormTypeOpen
  };
};

export default useResourceFormModal;
