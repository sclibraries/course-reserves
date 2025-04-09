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
import { TypeSpecificFields } from '../TypeSpecificFields';
import ResourceLinks from '../ResourceLinks';

// Import services
import { adminMaterialTypeService } from '../../../../services/admin/adminMaterialTypeService';
import { useAdminCourseStore } from '../../../../store/adminCourseStore';
import { toast } from 'react-toastify';
import '../../../../css/AdminForms.css';

/**
 * BaseResourceForm - Core functionality for resource forms
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
  
  // State for form data
  const [formData, setFormData] = useState({
    title: initialData.title || initialData.name || '',
    link: initialData.link || initialData.item_url || '',
    use_proxy: initialData.use_proxy || false,
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
    setFormData(prev => ({ 
      ...prev, 
      material_type_id: value,
      metadata: {} // Clear existing metadata when type changes
    }));
    
    fetchMaterialTypeFields(value);
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
      
      // Prepare final submission data
      const submissionData = {
        ...formData,
        links: validLinks
      };
      
      // Submit the data
      await onSubmit(submissionData);
      toast.success('Resource saved successfully');
      
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
