import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ArrowLeft } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, Alert } from 'reactstrap';
import { Button } from '../../ui/button';
import { notify } from '../../../services/notify';

// Form components
import BaseResourceForm from './common/BaseResourceForm';
import { AdminReuseForm } from './specialized/AdminReuseForm';
import { CrossLinkForm } from './specialized/CrosslinkForm';

// Constants
import { ResourceFormType } from './constants/formTypes';
import ResourceSearchPicker from './search/ResourceSearchPicker';

// Services
import { adminCourseService } from '../../../services/admin/adminCourseService';
import { adminResourceService } from '../../../services/admin/adminResourceService';
import { useAdminCourseStore } from '../../../store/adminCourseStore';
import { adjustProxy, LIBPROXY_PREFIX } from '../../../util/proxyUtil';
import { mapEdsRecordToResource } from '../../../util/mapEDSRecordToRespurce';
import { useResourceSearch } from '../../../hooks/admin/useResourceSearch';

/**
 * ResourceFormManager - Unified component for managing all resource forms
 * 
 * This component consolidates all resource forms into a single, manageable interface
 * following DRY and SOLID principles. It handles:
 * - Form type selection and rendering
 * - Data transformation and validation
 * - API interactions
 * - Error handling and user feedback
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} props.onSubmit - Callback when form is successfully submitted
 * @param {string} props.formType - Type of form to display (from ResourceFormType)
 * @param {Object} props.initialData - Initial data for the form
 * @param {Object} props.course - Current course data
 * @param {string} props.title - Modal title override
 */
export const ResourceFormManager = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  formType, 
  initialData = {}, 
  course,
  title: customTitle,
  refreshLinkedCourses,
  ...additionalProps 
}) => {
  // Store access
  const { folioCourseData } = useAdminCourseStore();
  
  // Common state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const resourceSearch = useResourceSearch(formType);
  const { reset: resetResourceSearch } = resourceSearch;

  // Reuse keeps its current search UI until AW-087B.
  const [reuseSearchTerm, setReuseSearchTerm] = useState('');
  const [reuseSearchResults, setReuseSearchResults] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);


  /**
   * Reset all state when modal closes or form type changes
   */
  const resetState = useCallback(() => {
    setLoading(false);
    setError(null);
    resetResourceSearch();
    setReuseSearchTerm('');
    setReuseSearchResults([]);
    setSelectedRecord(null);
    setShowEditForm(false);
  }, [resetResourceSearch]);

  /**
   * Effect to reset state when modal opens/closes or form type changes
   */
  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, formType, resetState]);

  /**
   * Get modal configuration based on form type
   */
  const getModalConfig = () => {
    const configs = {
      [ResourceFormType.NEW]: {
        title: 'Add New Resource',
        size: 'xl',
        fullscreen: true
      },
      [ResourceFormType.EDIT]: {
        title: 'Edit Resource',
        size: 'xl',
        fullscreen: true
      },
      [ResourceFormType.EDS]: {
        title: 'Create Resource from EDS',
        size: 'xl',
        fullscreen: true
      },
      [ResourceFormType.HITCHCOCK]: {
        title: 'Create Resource from Hitchcock',
        size: 'xl',
        fullscreen: true
      },
      [ResourceFormType.REUSE]: {
        title: 'Reuse Existing Resource',
        size: 'xl',
        fullscreen: true
      },
      [ResourceFormType.CROSSLINK]: {
        title: 'Cross-link to Another Course',
        size: 'xl',
        fullscreen: true
      }
    };
    
    return configs[formType] || configs[ResourceFormType.NEW];
  };

  /**
   * Transform resource metadata from array to object format
   */
  const transformMetadata = (metadata) => {
    if (!metadata) {
      return {};
    }
    if (!Array.isArray(metadata)) {
      console.warn('Expected metadata to be an array but received:', metadata);
      return metadata || {};
    }
    return metadata.reduce((acc, item) => {
      if (item && item.field_name) {
        acc[item.field_name] = item.field_value;
      }
      return acc;
    }, {});
  };

  /**
   * Handle base form submission (for new/edit/selected records)
   */
  const handleBaseFormSubmit = async (formData) => {
    try {
      setLoading(true);
      
      // Apply proxy settings
      adjustProxy(formData);
      
      // Apply proxy to additional links
      if (formData.links && formData.links.length > 0) {
        formData.links = formData.links.map(link => {
          if (link.use_proxy) {
            return { 
              ...link, 
              url: link.url.includes('proxy') ? link.url : `${LIBPROXY_PREFIX}${link.url}`
            };
          }
          return link;
        });
      }

      let result;
      if (formType === ResourceFormType.EDIT) {
        // Update existing resource
        const { resource_id, ...updateData } = formData;
        result = await additionalProps.onUpdate?.(formData) || 
                await adminResourceService.updateResource(resource_id, updateData);
      } else {
        // Create new resource
        result = await adminCourseService.createResource(
          course.offering_id, 
          course.course_id, 
          formData, 
          folioCourseData
        );
      }

      if (result !== false) {
        notify.success(formType === ResourceFormType.EDIT ? 'Resource updated' : 'Resource added');
        onSubmit?.(formData);
        onClose();
      }
      
      return result;
    } catch (err) {
      console.error('Error submitting resource:', err);
      setError("Couldn't save the resource");
      notify.fromError(err, "Couldn't save the resource");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleReuseSearch = async (searchQuery = reuseSearchTerm) => {
    if (!searchQuery.trim()) {
      setError('Please enter a search term');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const data = await adminCourseService.searchResources(searchQuery);
      const results = data?.resources || [];
      setReuseSearchResults(results);
      if (results.length === 0) {
        setError('No results found for your search term');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed');
      setReuseSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle record selection (EDS, Hitchcock)
   */
  const handleSelectRecord = async (record) => {
    try {
      setSelectedRecord(record);
      
      if (formType === ResourceFormType.EDS) {
        // Use the same mapping utility as AdminEDSForm
        const mapped = await mapEdsRecordToResource(record);
        setSelectedRecord({ ...record, parsedData: mapped });
      }
      
      setShowEditForm(true);
    } catch (err) {
      console.error('Error selecting record:', err);
      setError('Failed to process selected record');
    }
  };

  const handleReuseResource = async (resourceId) => {
    setError(null);
    setLoading(true);
    try {
      await additionalProps.onReuse?.(resourceId);
      try {
        await onSubmit?.();
      } catch {
        setError('Resource linked, but the list could not be refreshed.');
        return;
      }
      notify.success('Resource linked');
      onClose();
    } catch (err) {
      console.error('Error reusing resource:', err);
      setError("Couldn't add the resource to the course");
      notify.fromError(err, "Couldn't link the resource");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Convert string/number proxy values to boolean
   */
  const normalizeProxyValue = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value === '1' || value === 'true' || value === 'TRUE';
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    return false;
  };

  /**
   * Prepare initial data for BaseResourceForm based on form type and context
   */
  const getFormInitialData = () => {
    if (formType === ResourceFormType.EDIT && initialData) {
      return {
        resource_id: initialData.resource_id || null,
        title: initialData.name || '',
        link: initialData.item_url || '',
        use_proxy: normalizeProxyValue(initialData.use_proxy),
        folder: initialData.folder_id || null,
        notes: initialData.description || '',
        internal_note: initialData.internal_note || '',
        external_note: initialData.external_note || '',
        start_visibility: initialData.start_visibility || null,
        end_visibility: initialData.end_visibility || null,
        material_type_id: initialData.material_type_id || null,
        order: initialData.order || null,
        created_at: initialData.created_at || '',
        material_type_name: initialData.material_type_name || '',
        course_count: initialData.course_count || 0,
        metadata: transformMetadata(initialData.metadata),
        links: initialData.links || [],
        use_primary_link_visibility: normalizeProxyValue(initialData.use_primary_link_visibility),
        primary_link_start_visibility: initialData.primary_link_start_visibility || null,
        primary_link_end_visibility: initialData.primary_link_end_visibility || null,
      };
    }

    if (selectedRecord) {
      const baseData = {
        title: selectedRecord.title || '',
        link: selectedRecord.link || selectedRecord.item_url || '',
        notes: selectedRecord.notes || selectedRecord.description || '',
      };

      // Add form-specific transformations
      if (formType === ResourceFormType.EDS && selectedRecord.parsedData) {
        return {
          ...baseData,
          ...selectedRecord.parsedData,
          metadata: selectedRecord.parsedData?.metadata || {}
        };
      }

      return baseData;
    }

    // Default initial data with course visibility dates
    const defaultData = { ...initialData };
    if (folioCourseData?.courseListingObject?.termObject) {
      const term = folioCourseData.courseListingObject.termObject;
      defaultData.start_visibility = new Date(term.startDate).toISOString().split('T')[0];
      defaultData.end_visibility = new Date(term.endDate).toISOString().split('T')[0];
    }

    return defaultData;
  };

  /**
   * Render the appropriate form content based on form type
   */
  const renderFormContent = () => {
    if ([ResourceFormType.NEW, ResourceFormType.EDIT].includes(formType) || showEditForm) {
      return (
        <>
          {showEditForm && (
            <Button
              type="button"
              variant="outline"
              className="tw-mb-3"
              onClick={() => setShowEditForm(false)}
            >
              <ArrowLeft aria-hidden="true" />
              Back to results
            </Button>
          )}
          <BaseResourceForm
            course={folioCourseData}
            initialData={getFormInitialData()}
            onSubmit={handleBaseFormSubmit}
            title={getModalConfig().title}
            submitButtonText={formType === ResourceFormType.EDIT ? 'Save Changes' : 'Create Resource'}
            onCancel={showEditForm ? () => setShowEditForm(false) : onClose}
            showCancel={!showEditForm && formType !== ResourceFormType.EDIT}
            loading={loading}
          />
        </>
      );
    }

    switch (formType) {
      case ResourceFormType.REUSE:
        return (
          <AdminReuseForm
            error={error}
            searchTerm={reuseSearchTerm}
            searchResults={reuseSearchResults}
            onSearchTermChange={setReuseSearchTerm}
            onSearch={handleReuseSearch}
            onReuse={handleReuseResource}
            isLoading={loading}
          />
        );

      case ResourceFormType.CROSSLINK:
        return (
          <CrossLinkForm
            onSuccess={() => {
              onSubmit?.();
              // Keep the modal open for multiple operations and refresh the parent list.
              if (refreshLinkedCourses) {
                refreshLinkedCourses();
              }
            }}
            courseInfo={course}
            onClose={onClose}
          />
        );

      case ResourceFormType.EDS:
      case ResourceFormType.HITCHCOCK:
        return (
          <ResourceSearchPicker
            formType={formType}
            searchTerm={resourceSearch.searchTerm}
            onSearchTermChange={resourceSearch.setSearchTerm}
            onSearch={resourceSearch.search}
            searchResults={resourceSearch.searchResults}
            hasSearched={resourceSearch.hasSearched}
            loading={resourceSearch.loading}
            totalHits={resourceSearch.totalHits}
            searchTime={resourceSearch.searchTime}
            hasMore={resourceSearch.hasMore}
            onLoadMore={resourceSearch.loadMore}
            onSelectRecord={handleSelectRecord}
          />
        );

      default:
        return <Alert color="warning" fade={false}>Unknown form type: {formType}</Alert>;
    }
  };

  const modalConfig = getModalConfig();

  return (
    <Modal 
      isOpen={isOpen} 
      toggle={onClose}
      size={modalConfig.size}
      fullscreen={modalConfig.fullscreen}
      onClosed={resetState}
    >
      <ModalHeader toggle={onClose}>
        {customTitle || modalConfig.title}
      </ModalHeader>
      <ModalBody>
        {renderFormContent()}
      </ModalBody>
    </Modal>
  );
};

ResourceFormManager.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  formType: PropTypes.oneOf(Object.values(ResourceFormType)).isRequired,
  initialData: PropTypes.object,
  course: PropTypes.object,
  title: PropTypes.string,
  refreshLinkedCourses: PropTypes.func,
  // Additional props for specific form types
  searchTerm: PropTypes.string,
  searchResults: PropTypes.array,
  onSearchTermChange: PropTypes.func,
  onSearch: PropTypes.func,
  onReuse: PropTypes.func,
  onUpdate: PropTypes.func,
  resourceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default ResourceFormManager;
