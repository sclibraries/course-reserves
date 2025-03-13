import { useState, useEffect } from 'react';
import {
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  Table,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ListGroup,
  ListGroupItem,
  Container,
  Row,
  Col
} from 'reactstrap';
import PropTypes from 'prop-types';
import { adminCourseService } from '../../../services/admin/adminCourseService';
import { adminMaterialTypeService } from '../../../services/admin/adminMaterialTypeService';
import { mapEdsRecordToResource } from '../../../util/mapEDSRecordToRespurce';
import { EDS_TO_DB_FIELD_MAPPING } from '../../../constants/edsFieldMapping';
import { AdditionalCommonFields } from './AdditionalCommonFields';
import { TypeSpecificFields } from './TypeSpecificFields';
import { useAdminCourseStore } from '../../../store/adminCourseStore';
import { toast } from 'react-toastify';

export const AdminEDSForm = ({ onSubmit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [materialTypes, setMaterialTypes] = useState([]);
  const [materialTypeFields, setMaterialTypeFields] = useState([]);
  const [currentFieldMapping, setCurrentFieldMapping] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const { course, folioCourseData } = useAdminCourseStore();
  const PROXY_PREFIX = "https://libproxy.smith.edu/login?url=";

  // Main form data for the resource.
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

  useEffect(() => {
    if (formData.material_type) {
      fetchMaterialTypeFields(formData.material_type);
      const mapping = EDS_TO_DB_FIELD_MAPPING[formData.material_type] || {};
      setCurrentFieldMapping(mapping);
    }
  }, [formData.material_type]);

  useEffect(() => {
    if (materialTypeFields && materialTypeFields.length > 0) {
      setFormData((prev) => {
        const newMetadata = {};
        materialTypeFields.forEach((field) => {
          newMetadata[field.field_name] = prev.metadata[field.field_name] || '';
        });
        return { ...prev, metadata: newMetadata };
      });
    }
  }, [materialTypeFields]);

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

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const data = await adminCourseService.searchEDS(searchTerm);
      setSearchResults(data?.data?.records || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRecord = async (record) => {
    try {
      const parsedRecord = await mapEdsRecordToResource(record);
      if (!parsedRecord.material_type) {
        console.warn('Material type not detected; please select one manually.');
      }
      setSelectedRecord(record);
      setFormData({
        title: parsedRecord.title || '',
        link: parsedRecord.link || '',
        notes: parsedRecord.notes || '',
        material_type: parsedRecord.material_type || '',
        metadata: parsedRecord.metadata || {},
        use_proxy: false,
        start_visibility: '',
        end_visibility: '',
        internal_note: '',
        external_note: '',
        folder: ''
      });
      await fetchMaterialTypeFields(parsedRecord.material_type);
      setEditModalOpen(true);
    } catch (err) {
      console.error('Error processing record:', err);
      setError('Failed to process selected record.');
    }
  };

  const handleFieldChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
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

  const handleInsertField = async (value, item) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(item.Name);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      setError('Failed to copy text to clipboard.');
    }
  };

  function adjustProxy(data) {
    // Basic error checking
    if (!data || typeof data.link !== "string") {
      throw new Error("Invalid data or missing link property");
    }
    
    // Check explicitly against the numbers 1 or 0.
    if (data.use_proxy == 1) {
      // Add the proxy prefix if it's not already present.
      if (!data.link.startsWith(PROXY_PREFIX)) {
        data.link = PROXY_PREFIX + data.link;
      }
    } else if (data.use_proxy == 0) {
      // Remove the proxy prefix if it's present.
      if (data.link.startsWith(PROXY_PREFIX)) {
        data.link = data.link.replace(PROXY_PREFIX, "");
      }
    }
  }

  const handleSubmitResource = async () => {
    const data = course
    try {
      setLoading(true);
      const submissionData = { ...formData };
      adjustProxy(submissionData);
      await adminCourseService.createResource(data.offering_id, data.course_id, submissionData, folioCourseData);
      toast.success('Resource added successfully');
      setEditModalOpen(false);
      onSubmit();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const buildVerificationUrl = (record) => {
    const accession = record.AccessionNumber;
    const dbId = record.DatabaseId;
    if (!accession) return '#';
    return `https://openurl.ebsco.com/c/4e4lys/openurl?sid=ebsco:plink&id=ebsco:${encodeURIComponent(dbId)}:${encodeURIComponent(accession)}`;
  };


  return (
    <div>
      <h4>EDS Search</h4>
      <Form inline onSubmit={handleSearch} className="mb-3">
        <FormGroup className="mr-2">
          <Label for="edsQuery" className="mr-2">Search Query</Label>
          <Input
            id="edsQuery"
            name="edsQuery"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="e.g. AN smc.FCDWS395578270"
            className="mr-2"
          />
        </FormGroup>
        <Button color="primary" type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </Form>

      {error && <div className="text-danger mb-3">Error: {error}</div>}

      {searchResults.length > 0 && (
        <div className="response-table mb-4">
          <Table bordered hover size="lg">
            <thead>
              <tr>
                <th>Accession Number</th>
                <th>Title</th>
                <th>Author(s)</th>
                <th>Material Type</th>
                <th>Verify</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map((record) => {
                const accessionNumber = record.AccessionNumber;
                const title = record.Items.find((it) => it.Name === 'Title')?.plainText || '(No Title)';
                const author = record.Items.find((it) => it.Name === 'Author')?.plainText || '';
                const typePub = record.Items.find((it) => it.Name === 'TypePub')?.plainText || '';
                return (
                  <tr key={accessionNumber}>
                    <td style={{ wordBreak: 'break-all' }}>{accessionNumber}</td>
                    <td>{title}</td>
                    <td>{author}</td>
                    <td>{typePub}</td>
                    <td>
                      <a href={buildVerificationUrl(record)}>Verify</a>
                    </td>
                    <td>
                      <Button color="primary" onClick={() => handleSelectRecord(record)}>
                        Edit &amp; Add
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      <Modal size="xl" isOpen={editModalOpen} toggle={() => setEditModalOpen(!editModalOpen)}>
        <ModalHeader toggle={() => setEditModalOpen(!editModalOpen)}>
          Edit Resource
        </ModalHeader>
        <ModalBody>
          <Container fluid>
            <Row>
              {/* Left Column: Basic Details and Common Fields */}
              <Col md={8}>
                <Container fluid>
                  <Row>
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
                    <Col md={6}>
                      <div className="border-bottom pb-3 mb-3">
                        <h5>Material Type</h5>
                        <FormGroup>
                          <Label for="material_type">Type</Label>
                          <Input
                            type="select"
                            name="material_type"
                            value={formData.material_type || ''}
                            onChange={(e) => {
                              handleFieldChange(e);
                              const mapping = EDS_TO_DB_FIELD_MAPPING[e.target.value] || {};
                              setCurrentFieldMapping(mapping);
                              setFormData((prev) => ({ ...prev, metadata: {} }));
                              fetchMaterialTypeFields(e.target.value);
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
                    <Col className="text-right mt-3">
                      <Button color="primary" onClick={handleSubmitResource} disabled={loading}>
                        Save &amp; Add
                      </Button>
                    </Col>
                  </Row>
                </Container>
              </Col>
              <Col md={4}>
                <h5>Available API Data</h5>
                <p>Click "Copy" to copy its value:</p>
                {selectedRecord && selectedRecord.Items && selectedRecord.Items.length > 0 ? (
                  <ListGroup>
                    {selectedRecord.Items.map((item, index) => (
                      <ListGroupItem key={index} className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{item.Name}:</strong> 
                          {
                            <span style={{wordBreak: "break-all"}}>{item?.links[0]?.href ? item.links[0].href : item.plainText}</span>
                          }
                        </div>
                        <span className="badge text-bg-primary rounded-pill"  onClick={() => handleInsertField(item?.links[0]?.href ? item.links[0].href : item.plainText, item)}>
                          {copiedField === item.Name ? "✓ Copied" : "Copy"}
                        </span>
                      </ListGroupItem>
                    ))}
                  </ListGroup>
                ) : (
                  <p>No API data available.</p>
                )}
              </Col>
            </Row>
          </Container>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setEditModalOpen(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

AdminEDSForm.propTypes = {
  course: PropTypes.object.isRequired,
  onSubmit: PropTypes.func.isRequired
};

export default AdminEDSForm;
