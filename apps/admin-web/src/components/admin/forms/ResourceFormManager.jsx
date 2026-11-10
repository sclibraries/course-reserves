import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { notify } from '../../../services/notify';

// Form components
import ResourceForm from './resource-form/ResourceForm';
import { AdminReuseForm } from './specialized/AdminReuseForm';
import { CrossLinkForm } from './specialized/CrosslinkForm';

// Constants
import { ResourceFormType } from './constants/formTypes';
import ResourceSearchPicker from './search/ResourceSearchPicker';

// Services
import { useAdminCourseStore } from '../../../store/adminCourseStore';
import { mapEdsRecordToResource } from '../../../util/mapEDSRecordToRespurce';
import { useResourceSearch } from '../../../hooks/admin/useResourceSearch';
import { useResourceFormSubmit } from '../../../hooks/admin/useResourceFormSubmit';

const RESOURCE_FORM_TITLES = {
  [ResourceFormType.NEW]: 'Add resource',
  [ResourceFormType.EDIT]: 'Edit resource',
  [ResourceFormType.EDS]: 'Add from EDS',
  [ResourceFormType.HITCHCOCK]: 'Add from Hitchcock',
  [ResourceFormType.REUSE]: 'Reuse resource',
  [ResourceFormType.CROSSLINK]: 'Cross-link to another course',
};

const RESOURCE_SOURCES = {
  [ResourceFormType.NEW]: 'Manual',
  [ResourceFormType.EDIT]: 'Not recorded',
  [ResourceFormType.EDS]: 'EBSCO Discovery',
  [ResourceFormType.HITCHCOCK]: 'Hitchcock',
};

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
 * @param {'course'|'none'} props.mode - Save context for the resource form
 * @param {string} props.title - Modal title override
 */
export const ResourceFormManager = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  formType, 
  initialData = {}, 
  course,
  mode = 'course',
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

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);

  /**
   * Reset all state when modal closes or form type changes
   */
  const resetState = useCallback(() => {
    setLoading(false);
    setError(null);
    resetResourceSearch();
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
      if (formType === ResourceFormType.EDS) notify.success('Resource details filled from EDS');
    } catch (err) {
      console.error('Error selecting record:', err);
      setError('Failed to process selected record');
      if (formType === ResourceFormType.EDS) notify.fromError(err, "Couldn't fill the resource from EDS");
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

  const handleBaseFormSubmit = useResourceFormSubmit({
    formType,
    course,
    folioCourseData,
    onUpdate: additionalProps.onUpdate,
    onSubmit,
    onClose,
    setLoading,
    setError,
  });

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
   * Prepare initial data for ResourceForm based on form type and context
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
          <ResourceForm
            formId="resource-form"
            course={folioCourseData}
            mode={mode}
            initialData={getFormInitialData()}
            onSubmit={handleBaseFormSubmit}
            source={RESOURCE_SOURCES[formType] || 'Not recorded'}
            usageResourceId={formType === ResourceFormType.EDIT ? initialData.resource_id : null}
          />
        </>
      );
    }

    switch (formType) {
      case ResourceFormType.REUSE:
        return (
          <AdminReuseForm
            error={error}
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
        return (
          <div role="alert" className="tw-rounded-md tw-border tw-border-destructive tw-p-3 tw-text-destructive">
            Unknown form type: {formType}
          </div>
        );
    }
  };

  const modalTitle = customTitle || RESOURCE_FORM_TITLES[formType] || RESOURCE_FORM_TITLES[ResourceFormType.NEW];
  const showResourceForm = [ResourceFormType.NEW, ResourceFormType.EDIT].includes(formType) || showEditForm;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent
        aria-describedby={undefined}
        className="tw-flex tw-top-4 tw-bottom-4 tw-h-auto tw-max-h-none tw-box-border tw-translate-y-0 tw-w-[calc(100vw-2rem)] tw-max-w-7xl tw-flex-col tw-overflow-hidden"
      >
        <DialogHeader className="tw-shrink-0">
          <DialogTitle>{modalTitle}</DialogTitle>
        </DialogHeader>
        <div data-testid="resource-form-content" className="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-overscroll-contain">
          {renderFormContent()}
        </div>
        {showResourceForm && (
          <DialogFooter className="tw-shrink-0 tw-border-t tw-pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" form="resource-form" disabled={loading}>Save</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

ResourceFormManager.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  formType: PropTypes.oneOf(Object.values(ResourceFormType)).isRequired,
  initialData: PropTypes.object,
  course: PropTypes.object,
  mode: PropTypes.oneOf(['course', 'none']),
  title: PropTypes.string,
  refreshLinkedCourses: PropTypes.func,
  // Additional props for specific form types
  onReuse: PropTypes.func,
  onUpdate: PropTypes.func,
  resourceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default ResourceFormManager;
