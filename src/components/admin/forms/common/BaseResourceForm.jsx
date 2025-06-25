import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Form,
  Container,
  Row,
  Col,
  Card,
  CardBody,
  CardHeader
} from 'reactstrap';
import { FaInfoCircle, FaLink, FaFolder } from 'react-icons/fa';

// Import shared components
import ResourceBasicFields from './ResourceBasicFields';
import ResourceTypeSelector from './ResourceTypeSelector';
import FormSection from './FormSection';
import FormActions from './FormActions';
import FolderSelector from './FolderSelector';
import VisibilityDates from './VisibilityDates';
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
  
  // State for form data
  const [formData, setFormData] = useState({
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
    // Keep any existing data that might be needed later
    ...(initialData.resource_id && { resource_id: initialData.resource_id }),
    ...(initialData.order && { order: initialData.order }),
    ...(initialData.course_count && { course_count: initialData.course_count })
  });

  // State for visibility dates toggle
  const [useVisibilityDates, setUseVisibilityDates] = useState(
    // Enable by default if it's a video type or if dates were previously set
    initialData.material_type_id === '3' || 
    initialData.material_type_id === 3 ||
    !!(initialData.start_visibility || initialData.end_visibility)
  );

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

  // State for links
  const [links, setLinks] = useState(initialData.links || []);
  
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
      setFormData(prev => ({ ...prev, [name]: value }));
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
    const isVideoType = value === '3' || value === 3;
    
    setFormData(prev => ({ 
      ...prev, 
      material_type_id: value,
      metadata: {}, // Clear existing metadata when type changes
      // Set visibility dates to term dates if it's a video type
      ...(isVideoType && {
        start_visibility: prev.start_visibility || defaultDates.startDate,
        end_visibility: prev.end_visibility || defaultDates.endDate
      })
    }));
    
    // Auto-enable visibility dates for video types
    if (isVideoType) {
      setUseVisibilityDates(true);
    }
    
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
    
    // If disabling visibility dates (and not a video type), clear the dates
    if (!checked && formData.material_type_id !== '3' && formData.material_type_id !== 3) {
      setFormData(prev => ({
        ...prev,
        start_visibility: '',
        end_visibility: ''
      }));
    }
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
      
      // Determine if visibility dates should be included
      const isVideoType = formData.material_type_id === '3' || formData.material_type_id === 3;
      const shouldIncludeVisibilityDates = useVisibilityDates || isVideoType;
      
      // Prepare final submission data
      const submissionData = {
        ...formData,
        links: validLinks,
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
            {/* Basic Resource Fields */}
            <ResourceBasicFields 
              formData={formData}
              handleFieldChange={handleFieldChange}
            />
            
            {/* Material Type and Folder - Side by Side */}
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
            
            {/* Type-Specific Fields */}
            {formData.material_type_id && (
              <FormSection title="Type-Specific Details" icon={FaInfoCircle}>
                <TypeSpecificFields
                  formData={formData}
                  metadata={formData.metadata}
                  handleFieldChange={handleFieldChange}
                  materialTypeFields={materialTypeFields}
                />
              </FormSection>
            )}
            
            {/* Additional Links */}
            <FormSection title="Additional Links" icon={FaLink}>
              <ResourceLinks 
                links={links}
                setLinks={setLinks}
              />
            </FormSection>
            
            {/* Visibility Settings */}
            <FormSection title="Visibility Settings" icon={FaFolder}>
              <VisibilityDates 
                startDate={formData.start_visibility}
                endDate={formData.end_visibility}
                handleChange={handleFieldChange}
                materialTypeId={formData.material_type_id}
                useVisibilityDates={useVisibilityDates}
                onVisibilityToggle={handleVisibilityToggle}
              />
            </FormSection>
            
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
