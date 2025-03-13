// AdminNewResourceForm.jsx
import { useState, useEffect } from 'react';
import {
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  Container,
  Row,
  Col
} from 'reactstrap';
import PropTypes from 'prop-types';
import { AdditionalCommonFields } from './AdditionalCommonFields';
import { TypeSpecificFields } from './TypeSpecificFields';
import { adminCourseService } from '../../../services/admin/adminCourseService';
import { adminMaterialTypeService } from '../../../services/admin/adminMaterialTypeService';
import { toast } from 'react-toastify';
import { useAdminCourseStore } from '../../../store/adminCourseStore';
import { adjustProxy } from '../../../util/proxyUtil';
/**
 * AdminNewResourceForm
 *
 * This form is used to create a new resource. It uses the same fields as the AdminEDSForm:
 * - Basic details: title (Name), link (URL), description (notes),
 *   internal_note, external_note.
 * - Additional common fields: use_proxy (via radio buttons), folder, start_visibility, end_visibility.
 * - Material type selection and type‑specific details.
 */
export const AdminResourceForm = ({ onSubmit }) => {
  // Initialize form data state to match the fields used in AdminEDSForm.
  const [formData, setFormData] = useState({
    title: '',
    link: '',
    notes: '',
    material_type: '',
    metadata: {},
    use_proxy: false,
    start_visibility: '',
    end_visibility: '',
    internal_note: '',
    external_note: '',
    folder: ''
  });

  const [materialTypeFields, setMaterialTypeFields] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [materialTypes, setMaterialTypes] = useState([]);
  const { course, folioCourseData } = useAdminCourseStore();

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

  /**
   * handleFieldChange
   * Generic change handler for updating form data.
   * Updates top-level properties or, if not present, assumes it's part of metadata.
   */
  const handleFieldChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      // If the field name exists in formData, update it; otherwise, update metadata.
      if (name in formData) {
        setFormData((prev) => ({ ...prev, [name]: value }));
      } else {
        setFormData((prev) => ({
          ...prev,
          metadata: { ...prev.metadata, [name]: value }
        }));
      }
    }
  };

  /**
   * fetchMaterialTypeFields
   * Fetches extra/type-specific fields for the selected material type.
   */
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

  /**
   * handleSubmit
   * Handles form submission, applies proxy URL if needed, and calls the API.
   */
  const handleSubmit = async (e) => {
    const data = course
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const submissionData = { ...formData };
      adjustProxy(submissionData);
      await adminCourseService.createResource(data.offering_id, data.course_id, submissionData, folioCourseData);
      toast.success('Resource created successfully');
      handleReset();
      onSubmit();
    } catch (err) {
      console.error('Error creating resource:', err);
      toast.error('Failed to create resource: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      title: '',
      link: '',
      notes: '',
      material_type: '',
      metadata: {},
      use_proxy: false,
      internal_note: '',
      external_note: '',
      folder: ''
    });
  }


  return (
    <Container fluid className="p-4 bg-light">
      <Form onSubmit={handleSubmit}>
        <h2 className="mb-4 text-center">New Resource</h2>
        {error && <div className="text-danger mb-3">{error}</div>}
        <Row>
          {/* Left column: Basic and common details */}
          <Col md={6}>
          <div className="border-bottom pb-3 mb-3">
                        <h5>Basic Details</h5>
                        <FormGroup>
                          <Label for="title">Name</Label>
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
                          <Label for="notes">Description</Label>
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
                        {/* Include all common fields via AdditionalCommonFields */}
                        <AdditionalCommonFields 
                           handleFieldChange={handleFieldChange}
                           formData={formData}
                           setFormData={setFormData}
                        />
                      </div>
          </Col>
          {/* Right column: Material type and type-specific details */}
          <Col md={6}>
            <div className="border-bottom pb-3 mb-3">
              <h5>Material Type</h5>
              <FormGroup>
                <Label for="material_type">Type</Label>
                <Input
                  type="select"
                  id="material_type"
                  name="material_type"
                  value={formData.material_type || ''}
                  onChange={(e) => {
                    handleFieldChange(e)
                    setFormData(prev => ({ ...prev, metadata: {} }))
                    fetchMaterialTypeFields(e.target.value)
                  }}
                >
                            <option value="">-- Select Material Type --</option>
                            {materialTypes.map((mt) => (
                              <option key={mt.material_type_id} value={mt.material_type_id}>
                                {mt.name}
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
            <Button color="primary" type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </Col>
        </Row>
      </Form>
    </Container>
  );
};

AdminResourceForm.propTypes = {
  course: PropTypes.object.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default AdminResourceForm;
