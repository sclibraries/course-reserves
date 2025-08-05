import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Form,
  Container,
  Row,
  Col,
  Card,
  CardBody,
  CardHeader,
  Alert
} from 'reactstrap';
import { FaInfoCircle, FaLink, FaFolder } from 'react-icons/fa';

// Import shared components
import ResourceBasicFields from './ResourceBasicFields';
import ResourceTypeSelector from './ResourceTypeSelector';
import FormSection from './FormSection';
import FormActions from './FormActions';
import FolderSelector from './FolderSelector';
import UnifiedVisibilityControl from './UnifiedVisibilityControl';
import FormNavigationAnchor from './FormNavigationAnchor';
import { TypeSpecificFields } from '../fields/TypeSpecificFields';
import ResourceLinks from '../fields/ResourceLinks';

// Import services
import { adminMaterialTypeService } from '../../../../services/admin/adminMaterialTypeService';
import { useAdminCourseStore } from '../../../../store/adminCourseStore';
import { toast } from 'react-toastify';
import '../../../../css/AdminForms.css';

/**
 * BaseResourceForm - Core Resource Form Component
 * ===============================================
 * 
 * **Purpose**: Provides the complete, unified form interface for creating and editing
 * course resources. This is the foundation component that combines all field types
 * and form sections into a cohesive user experience.
 * 
 * **Key Features**:
 * - Complete resource form with all field types
 * - Material type-specific field rendering
 * - Automatic visibility date handling for video content
 * - Integrated folder selection with creation capability
 * - Additional links management
 * - Form validation and error handling
 * - Loading states and user feedback
 * - Responsive design with consistent styling
 * 
 * **Form Sections**:
 * 1. **Basic Fields**: Name, URL, description, notes, proxy settings
 * 2. **Material Type**: Dropdown with dynamic field loading
 * 3. **Folder Selection**: With inline folder creation
 * 4. **Type-Specific Fields**: Dynamic based on material type
 * 5. **Additional Links**: Multiple related URLs
 * 6. **Visibility Settings**: Start/end dates with smart defaults
 * 
 * **Smart Defaults**:
 * - Visibility dates auto-populate from course term dates
 * - Video material types automatically enable visibility controls
 * - Proxy settings inherit from primary URL
 * 
 * **Data Flow**:
 * 1. Receives initialData and transforms to internal format
 * 2. Loads material types and field definitions from API
 * 3. Handles real-time form state and validation
 * 4. Processes submission data and calls onSubmit callback
 * 5. Provides success/error feedback to user
 * 
 * **Usage Context**:
 * - Used directly by ResourceFormManager for NEW/EDIT operations
 * - Used by EDS/Hitchcock forms in modal contexts
 * - Can be used standalone for custom implementations
 * 
 * @component
 * @example
 * <BaseResourceForm
 *   initialData={resource}
 *   onSubmit={handleSave}
 *   title="Edit Resource"
 *   submitButtonText="Save Changes"
 *   onCancel={handleCancel}
 *   showCancel={true}
 * />
 */
export const BaseResourceForm = ({ 
  initialData = {}, 
  onSubmit,
  title = 'Resource Form',
  submitButtonText = 'Save Resource',
  onCancel,
  showCancel = true
}) => {
  // Get course data from store to access semester dates
  const { folioCourseData } = useAdminCourseStore();
  
  // Get default visibility dates from folio course data
  const getDefaultVisibilityDates = () => {
    if (folioCourseData?.courseListingObject?.termObject) {
      const termObj = folioCourseData.courseListingObject.termObject;
      return {
        startDate: new Date(termObj.startDate).toISOString().split('T')[0],
        endDate: new Date(termObj.endDate).toISOString().split('T')[0]
      };
    }
    return { startDate: '', endDate: '' };
  };
  
  const defaultDates = getDefaultVisibilityDates();
  
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
   * Convert string/number boolean values to boolean (same logic as proxy)
   */
  const normalizeBooleanValue = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value === '1' || value === 'true' || value === 'TRUE';
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    return false;
  };
  
  // State for form data
  const [formData, setFormData] = useState(() => {
    // Check if primary link visibility is enabled directly from the resource
    // Use the normalize function for consistency
    const hasPrimaryLinkControl = normalizeBooleanValue(initialData.use_primary_link_visibility);
    
    // Check if URL matches Hitchcock video pattern
    const primaryUrl = initialData.link || initialData.item_url || '';
    const isHitchcockVideo = primaryUrl.startsWith('https://ereserves.smith.edu/hitchcock/videos/');
    
    // Debug logging - show all related fields
    console.log('BaseResourceForm initialData:', initialData);
    console.log('use_primary_link_visibility raw value:', initialData.use_primary_link_visibility);
    console.log('use_primary_link_visibility type:', typeof initialData.use_primary_link_visibility);
    console.log('primary_link_start_visibility:', initialData.primary_link_start_visibility);
    console.log('primary_link_end_visibility:', initialData.primary_link_end_visibility);
    console.log('item_url:', initialData.link);
    console.log('Has primary link control (calculated):', hasPrimaryLinkControl);
    console.log('Is Hitchcock video URL:', isHitchcockVideo);
    
    return {
      title: initialData.title || initialData.name || '',
      link: initialData.link || initialData.item_url || '',
      use_proxy: normalizeProxyValue(initialData.use_proxy),
      notes: initialData.notes || initialData.description || '',
      internal_note: initialData.internal_note || '',
      external_note: initialData.external_note || '',
      folder: initialData.folder || initialData.folder_id || '',
      start_visibility: initialData.start_visibility || defaultDates.startDate,
      end_visibility: initialData.end_visibility || defaultDates.endDate,
      material_type_id: initialData.material_type_id || initialData.material_type || '',
      metadata: initialData.metadata || {},
      // Primary link visibility fields - auto-enable for NEW Hitchcock videos only
      use_primary_link_visibility: hasPrimaryLinkControl || (isHitchcockVideo && !initialData.resource_id),
      primary_link_start_visibility: initialData.primary_link_start_visibility || ((isHitchcockVideo && !initialData.resource_id) ? defaultDates.startDate : ''),
      primary_link_end_visibility: initialData.primary_link_end_visibility || ((isHitchcockVideo && !initialData.resource_id) ? defaultDates.endDate : ''),
      // Keep any existing data that might be needed later
      ...(initialData.resource_id && { resource_id: initialData.resource_id }),
      ...(initialData.order && { order: initialData.order }),
      ...(initialData.course_count && { course_count: initialData.course_count })
    };
  });

  // State for visibility dates toggle
  const [useVisibilityDates, setUseVisibilityDates] = useState(
    // Only enable by default if dates were previously set (not for new video types)
    !!(initialData.start_visibility || initialData.end_visibility)
  );

  // State for cascade visibility settings
  const [cascadeVisibilityToLinks, setCascadeVisibilityToLinks] = useState(false);

  // Update visibility dates if they're not set and folioCourseData changes
  useEffect(() => {
    if (folioCourseData?.courseListingObject?.termObject) {
      const termObj = folioCourseData.courseListingObject.termObject;
      setFormData(prev => ({
        ...prev,
        start_visibility: prev.start_visibility || new Date(termObj.startDate).toISOString().split('T')[0],
        end_visibility: prev.end_visibility || new Date(termObj.endDate).toISOString().split('T')[0]
      }));
    }
  }, [folioCourseData]);

  // State for links - filter out primary link (order = 0) since it's handled separately
  const [links, setLinks] = useState(() => {
    const existingLinks = (initialData.links || []).filter(link => link.order !== 0 && link.order !== '0');
    return existingLinks;
  });
  
  // State for additional data
  const [materialTypes, setMaterialTypes] = useState([]);
  const [materialTypeFields, setMaterialTypeFields] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch material types on component mount
  useEffect(() => {
    const fetchMaterialTypes = async () => {
      try {
        const { data } = await adminMaterialTypeService.getMaterialTypes();
        setMaterialTypes(data);
      } catch (err) {
        console.error('Error fetching material types:', err);
        setErrorMessage('Failed to load material types');
      }
    };
    
    fetchMaterialTypes();
  }, []);

  // Fetch material type fields when material type changes
  useEffect(() => {
    if (formData.material_type_id) {
      fetchMaterialTypeFields(formData.material_type_id);
    }
  }, [formData.material_type_id]);

  const fetchMaterialTypeFields = async (typeId) => {
    if (!typeId) return;
    
    try {
      const { data } = await adminMaterialTypeService.getMaterialTypeFields(typeId);
      setMaterialTypeFields(data);
    } catch (err) {
      console.error('Error fetching material type fields:', err);
      setErrorMessage('Failed to load material type fields');
    }
  };

  // Handle form field changes
  const handleFieldChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name in formData) {
      const updatedFormData = { ...formData, [name]: value };
      
      // Check if the link field changed and it's a Hitchcock video URL
      if (name === 'link') {
        const isHitchcockVideo = value.startsWith('https://ereserves.smith.edu/hitchcock/videos/');
        if (isHitchcockVideo && !updatedFormData.use_primary_link_visibility) {
          // Only auto-enable if not already configured
          updatedFormData.use_primary_link_visibility = true;
          updatedFormData.primary_link_start_visibility = updatedFormData.primary_link_start_visibility || defaultDates.startDate;
          updatedFormData.primary_link_end_visibility = updatedFormData.primary_link_end_visibility || defaultDates.endDate;
        }
      }
      
      setFormData(prev => ({ ...prev, ...updatedFormData }));
    } else {
      // For fields inside metadata
      setFormData(prev => ({
        ...prev,
        metadata: { ...prev.metadata, [name]: value }
      }));
    }
  };

  // Handle material type change specifically to clear metadata
  const handleMaterialTypeChange = (e) => {
    const { value } = e.target;
    
    setFormData(prev => ({ 
      ...prev, 
      material_type_id: value,
      metadata: {} // Clear existing metadata when type changes
    }));
    
    fetchMaterialTypeFields(value);
  };

  // Handle visibility dates toggle
  const handleVisibilityToggle = (e) => {
    const { checked } = e.target;
    setUseVisibilityDates(checked);
    
    // If enabling visibility dates and they're empty, set to term dates
    if (checked && (!formData.start_visibility || !formData.end_visibility)) {
      setFormData(prev => ({
        ...prev,
        start_visibility: prev.start_visibility || defaultDates.startDate,
        end_visibility: prev.end_visibility || defaultDates.endDate
      }));
    }
    
    // If disabling visibility dates, clear the dates
    if (!checked) {
      setFormData(prev => ({
        ...prev,
        start_visibility: '',
        end_visibility: ''
      }));
    }
  };

  // Handle primary link visibility changes
  const handlePrimaryLinkVisibilityToggle = (enabled) => {
    setFormData(prev => ({ 
      ...prev, 
      use_primary_link_visibility: enabled,
      // Clear primary link dates when disabling visibility
      ...(enabled ? {} : {
        primary_link_start_visibility: '',
        primary_link_end_visibility: ''
      })
    }));
  };

  const handlePrimaryLinkDateChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Auto-cascade primary link dates to additional links if they have visibility enabled
    if (name === 'primary_link_start_visibility' || name === 'primary_link_end_visibility') {
      const dateField = name === 'primary_link_start_visibility' ? 'start_visibility' : 'end_visibility';
      
      setLinks(prevLinks => 
        prevLinks.map(link => 
          link.use_link_visibility 
            ? { ...link, [dateField]: value }
            : link
        )
      );
    }
  };

  // Handle link visibility changes
  const handleLinkVisibilityChange = (index, field, value) => {
    const newLinks = [...links];
    newLinks[index][field] = value;
    setLinks(newLinks);
  };

  const handleLinkDateChange = (index, field, value) => {
    const newLinks = [...links];
    newLinks[index][field] = value;
    setLinks(newLinks);
  };

  // Handle cascade toggle
  const handleCascadeToggle = (enabled) => {
    setCascadeVisibilityToLinks(enabled);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    
    try {
      // Validate required fields
      if (!formData.title) {
        throw new Error('Resource name is required');
      }
      
      // Filter out empty links
      const validLinks = links.filter(link => link.url && link.url.trim() !== '');
      
      // For link visibility mode, ensure all links have use_link_visibility enabled
      // Also convert boolean values to integers for backend compatibility
      const processedLinks = validLinks.map(link => ({
        ...link,
        use_link_visibility: link.use_link_visibility ? 1 : 0,
        use_proxy: link.use_proxy ? 1 : 0
      }));
      
      // Determine if visibility dates should be included
      const isVideoType = formData.material_type_id === '3' || formData.material_type_id === 3;
      const shouldIncludeVisibilityDates = useVisibilityDates || isVideoType;
      
      // Prepare final submission data
      const submissionData = {
        ...formData,
        // Convert boolean use_proxy to integer for backend compatibility
        use_proxy: formData.use_proxy ? 1 : 0,
        // Convert primary link visibility to integer
        use_primary_link_visibility: formData.use_primary_link_visibility ? 1 : 0,
        links: processedLinks,
        // Only include visibility dates if they should be active, otherwise clear them
        start_visibility: shouldIncludeVisibilityDates ? formData.start_visibility : '',
        end_visibility: shouldIncludeVisibilityDates ? formData.end_visibility : ''
      };
      
      // Submit the data
      await onSubmit(submissionData);
      // Success toast is handled by ResourceFormManager
      
    } catch (error) {
      console.error('Error saving resource:', error);
      setErrorMessage(error.message || 'Failed to save resource');
      toast.error(error.message || 'Failed to save resource');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container fluid className="py-4">
      <Card className="shadow-sm">
        <CardHeader className="bg-white">
          <h3 className="mb-0">{title}</h3>
        </CardHeader>
        <CardBody>
          {errorMessage && (
            <div className="alert alert-danger" role="alert">
              {errorMessage}
            </div>
          )}
          
          <Form onSubmit={handleSubmit}>
            {/* Hitchcock Video Automatic Visibility Alert */}
            {formData.link && 
             formData.link.startsWith('https://ereserves.smith.edu/hitchcock/videos/') && 
             formData.use_primary_link_visibility && (
              <Alert color="warning" className="mb-4">
                <FaInfoCircle className="me-2" />
                <strong>Automatic Link Visibility Applied:</strong> The primary link to this Hitchcock video can only be displayed during the current term. 
                Link visibility dates have been automatically set to ensure compliance.
              </Alert>
            )}
            
            {/* Form Navigation */}
            <FormNavigationAnchor
              hasMaterialTypeFields={!!formData.material_type_id && materialTypeFields.length > 0}
              hasAdditionalLinks={links.length > 0}
            />
            
            {/* Basic Resource Information */}
            <div id="basic-information">
              <FormSection title="Basic Information" icon={FaInfoCircle}>
                <ResourceBasicFields 
                  formData={formData}
                  handleFieldChange={handleFieldChange}
                />
              </FormSection>
            </div>
            
            {/* Material Type and Folder - Side by Side */}
            <div id="classification-organization">
              <FormSection title="Classification & Organization" icon={FaFolder}>
                <Row>
                  <Col md={6}>
                    <ResourceTypeSelector 
                      materialTypes={materialTypes}
                      selectedTypeId={formData.material_type_id}
                      onTypeChange={handleMaterialTypeChange}
                    />
                  </Col>
                  
                  <Col md={6}>
                    <FolderSelector 
                      selectedFolder={formData.folder}
                      handleFolderChange={handleFieldChange}
                      setFormData={setFormData}
                    />
                  </Col>
                </Row>
              </FormSection>
            </div>
            
            {/* Type-Specific Fields */}
            {formData.material_type_id && (
              <div id="type-specific-details">
                <FormSection title="Type-Specific Details" icon={FaInfoCircle}>
                  <TypeSpecificFields
                    formData={formData}
                    metadata={formData.metadata}
                    handleFieldChange={handleFieldChange}
                    materialTypeFields={materialTypeFields}
                  />
                </FormSection>
              </div>
            )}
            
            {/* Additional Links */}
            <div id="additional-links">
              <FormSection title="Additional Links" icon={FaLink}>
                <ResourceLinks 
                  links={links}
                  setLinks={setLinks}
                  materialTypeId={formData.material_type_id}
                  resourceVisibilityDates={{
                    startDate: formData.start_visibility,
                    endDate: formData.end_visibility
                  }}
                />
              </FormSection>
            </div>
            
            {/* Unified Visibility Settings */}
            <div id="visibility-settings">
              <UnifiedVisibilityControl
                // Resource-level visibility
                resourceStartDate={formData.start_visibility}
                resourceEndDate={formData.end_visibility}
                useResourceVisibility={useVisibilityDates}
                onResourceVisibilityToggle={handleVisibilityToggle}
                onResourceDateChange={handleFieldChange}
                
                // Primary link visibility
                primaryLinkStartDate={formData.primary_link_start_visibility}
                primaryLinkEndDate={formData.primary_link_end_visibility}
                usePrimaryLinkVisibility={formData.use_primary_link_visibility}
                onPrimaryLinkVisibilityToggle={handlePrimaryLinkVisibilityToggle}
                onPrimaryLinkDateChange={handlePrimaryLinkDateChange}
                hasPrimaryLink={!!(formData.link && formData.link.trim())}
                primaryUrl={formData.link}
                
                // Additional links visibility
                links={links}
                onLinkVisibilityChange={handleLinkVisibilityChange}
                onLinkDateChange={handleLinkDateChange}
                
                // General settings
                materialTypeId={formData.material_type_id}
                cascadeVisibilityToLinks={cascadeVisibilityToLinks}
                onCascadeToggle={handleCascadeToggle}
              />
            </div>
            
            {/* Form Actions */}
            <FormActions 
              isSubmitting={isLoading}
              onCancel={onCancel}
              submitText={submitButtonText}
              showCancel={showCancel}
            />
          </Form>
        </CardBody>
      </Card>
    </Container>
  );
};

BaseResourceForm.propTypes = {
  initialData: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  title: PropTypes.string,
  submitButtonText: PropTypes.string,
  onCancel: PropTypes.func,
  showCancel: PropTypes.bool
};

export default BaseResourceForm;
