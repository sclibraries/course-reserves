import { useEffect } from 'react';
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
import { useResourceFormStore } from '../../../store/resourceFormStore';
import { MATERIAL_TYPE_CONFIG } from '../../../constants/materialTypeConfig';
import { BasicFields } from './BasicFields';
import { AdditionalCommonFields } from './AdditionalCommonFields';
import { TypeSpecificFields } from './TypeSpecificFields';
import PropTypes from 'prop-types';

export const AdminResourceForm = ({
  initialData = {},
  buttonText = 'Save',
  onSubmit
}) => {
  const {
    formData,
    metadata,
    setFormField,
    loadInitialData
  } = useResourceFormStore();

  // Load initial form data if provided
  useEffect(() => {
    if (initialData && initialData.title) {
      loadInitialData(initialData);
    }
  }, [initialData, loadInitialData]);

  // Handler for form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      metadata
    };
    onSubmit(payload);
  };

  // Derive the extra/type-specific fields from the config.
  // If a material type is selected, use its "extraFields" array; otherwise, an empty array.
  const extraFields =
    formData.material_type && MATERIAL_TYPE_CONFIG[formData.material_type]
      ? MATERIAL_TYPE_CONFIG[formData.material_type].extraFields
      : [];

  return (
    <Container fluid className="p-4 bg-light">
      <Form onSubmit={handleSubmit}>
        <h2 className="mb-4 text-center">Resource Information</h2>
        <Row className="mb-4">
          <Col md={6}>
            <div className="border-bottom pb-3 mb-3">
              <h5>Basic Details</h5>
              <BasicFields />
            </div>
            <div className="border-bottom pb-3 mb-3">
              <h5>Additional Information</h5>
              <AdditionalCommonFields />
            </div>
          </Col>
          <Col md={6}>
            <div>
              <h5>Material Type</h5>
              <FormGroup>
                <Label for="material_type">Type</Label>
                <Input
                  type="select"
                  id="material_type"
                  name="material_type"
                  value={formData.material_type}
                  // Call setFormField to update the field in the store
                  onChange={(e) => setFormField(e.target.name, e.target.value)}
                  required
                >
                  <option value="">-- Select Type --</option>
                  {Object.entries(MATERIAL_TYPE_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {cfg.label}
                    </option>
                  ))}
                </Input>
              </FormGroup>
            </div>
            <div>
              <h5>Type-Specific Details</h5>
              {/* Pass required props:
                  - metadata from the store
                  - a change handler that uses setFormField
                  - the extraFields from MATERIAL_TYPE_CONFIG */}
              <TypeSpecificFields
                metadata={metadata}
                handleFieldChange={(e) =>
                  setFormField(e.target.name, e.target.value)
                }
                materialTypeFields={extraFields}
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

AdminResourceForm.propTypes = {
  initialData: PropTypes.object,
  buttonText: PropTypes.string,
  onSubmit: PropTypes.func.isRequired
};
