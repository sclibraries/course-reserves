// AdminEditForm.jsx
import { useEffect, useState} from 'react'; // Import useMemo
import {
  Form,
  Button,
  Container,
  Row,
  Col,
  FormGroup,
  Label,
  Input
} from 'reactstrap';
import { AdditionalCommonFields } from './AdditionalCommonFields';
import { TypeSpecificFields } from './TypeSpecificFields';
import PropTypes from 'prop-types';
import { adminMaterialTypeService } from '../../../services/admin/adminMaterialTypeService'

export const AdminEditForm = ({
  onSubmit,
  resource,
  buttonText = 'Save Changes'
}) => {

  const [materialTypes, setMaterialTypes] = useState([]);
  const [materialTypeFields, setMaterialTypeFields] = useState([]);
  const [error, setError] = useState(null);

  const transformMetadata = (metadata) => {
    // Check if metadata is an array.
    if (!Array.isArray(metadata)) {
      console.error('Expected metadata to be an array but received:', metadata);
      return {};
    }
    // Reduce the array into an object where each key is the field_name.
    return metadata.reduce((acc, item) => {
      // Error checking: Ensure item exists and has a field_name property.
      if (item && item.field_name) {
        acc[item.field_name] = item.field_value;
      } else {
        console.warn('Metadata item missing field_name or is invalid:', item);
      }
      return acc;
    }, {});
  };

  // Main form data for the resource.
  const [formData, setFormData] = useState({
    resource_id: resource.resource_id || null,
    title: resource.name || '',
    link: resource.item_url || '',
    use_proxy: resource.use_proxy || false,
    folder: resource.folder_id || null,
    notes: resource.description || '',
    internal_note: resource.internal_note || '',
    external_note: resource.external_note || '',
    start_visibility: resource.start_visibility || null,
    end_visibility: resource.end_visibility || null,
    material_type_id: resource.material_type_id || null,
    material_type: resource.material_type_name || '',
    order: resource.order || null,
    created_at: resource.created_at || '',
    material_type_name: resource.material_type_name || '',
    course_count: resource.course_count || 0,
    metadata: transformMetadata(resource.metadata)

  });

    useEffect(() => {
      if (formData.material_type) {
        fetchMaterialTypeFields(formData.material_type_id);
      }
    }, [formData.material_type]);


    // Fetch material types on mount.
    useEffect(() => {
      const fetchMaterialTypes = async () => {
        try {
          const { data } = await adminMaterialTypeService.getMaterialTypes();
          setMaterialTypes(data);
        } catch (err) {
          console.error('Error fetching material types:', err);
        }
      };
      fetchMaterialTypes();
    }, []);

        const fetchMaterialTypeFields = async (materialTypeId) => {
          if (!materialTypeId) return;
          try {
            const { data } = await adminMaterialTypeService.getMaterialTypeFields(materialTypeId);
            setMaterialTypeFields(data);
          } catch (err) {
            console.error('Error fetching material type fields:', err);
            setError('Failed to load material type fields');
          }
        };


    const handleFieldChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (type === 'checkbox') {
          setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
          if (name in formData) {
            setFormData(prev => ({ ...prev, [name]: value }));
          } else {
            // For fields inside metadata
            setFormData(prev => ({
              ...prev,
              metadata: { ...prev.metadata, [name]: value }
            }));
          }
        }
      };

      const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
      }

  return (
    <Container fluid className="p-4 bg-light">
      <Form onSubmit={handleSubmit}>
        <h2 className="mb-4 text-center">Edit Resource</h2>
        <Row className="mb-4">
          <Col md={6}>
            <div className="border-bottom pb-3 mb-3">
              <h5>Basic Details</h5>
              <FormGroup>
                          <Label for="title">Title</Label>
                          <Input
                            id="title"
                            name="title"
                            value={formData.title || ''}
                            onChange={handleFieldChange}
                            required
                          />
                        </FormGroup>
                        <FormGroup>
                          <Label for="link">Link (URL)</Label>
                          <Input
                            id="link"
                            name="link"
                            value={formData.link || ''}
                            onChange={handleFieldChange}
                          />
                        </FormGroup>
                        <FormGroup>
                          <Label for="notes">Description / Notes</Label>
                          <Input
                            id="notes"
                            type="textarea"
                            name="notes"
                            value={formData.notes || ''}
                            onChange={handleFieldChange}
                          />
                        </FormGroup>
                        <FormGroup>
                          <Label for="internal_note">Internal Note (Staff Only)</Label>
                          <Input
                            id="internal_note"
                            name="internal_note"
                            type="textarea"
                            value={formData.internal_note || ''}
                            onChange={handleFieldChange}
                          />
                        </FormGroup>
                        <FormGroup>
                          <Label for="external_note">External Note (Visible to User)</Label>
                          <Input
                            id="external_note"
                            name="external_note"
                            type="textarea"
                            value={formData.external_note || ''}
                            onChange={handleFieldChange}
                          />
                        </FormGroup>
                        <AdditionalCommonFields 
                            handleFieldChange={handleFieldChange}
                            formData={formData}
                            setFormData={setFormData}
                        />
            </div>
          </Col>
          <Col md={6}>
                      <div className="border-bottom pb-3 mb-3">
                        <h5>Material Type</h5>
                        <FormGroup>
                          <Label for="material_type">Type</Label>
                          <Input
                            type="select"
                            name="material_type_id"
                            value={formData.material_type_id || ''}
                            onChange={(e) => {
                                handleFieldChange(e)
                                setFormData(prev => ({ ...prev, metadata: {} }))
                                fetchMaterialTypeFields(e.target.value)
                            }}
                          >
                            <option value="">-- Select Material Type --</option>
                            {materialTypes.map((mt) => (
                              <option key={mt.material_type_id} value={mt.material_type_id}>
                                {mt.description}
                              </option>
                            ))}
                          </Input>
                        </FormGroup>
                      </div>
                      <div>
                        <h5>Type-Specific Details</h5>
                        <TypeSpecificFields
                          formData={formData}
                          metadata={formData.metadata}
                          handleFieldChange={handleFieldChange}
                          materialTypeFields={materialTypeFields}
                        />
                      </div>                    
                    </Col>
        </Row>
        <Row>
          <Col className="text-right">
            <Button color="primary" size="lg" type="submit">
              {buttonText}
            </Button>
          </Col>
        </Row>
      </Form>
    </Container>
  );
};

AdminEditForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  resource: PropTypes.object,
  buttonText: PropTypes.string
};