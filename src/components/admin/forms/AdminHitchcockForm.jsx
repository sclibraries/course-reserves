// AdminHitchcockForm.jsx
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
import { AdditionalCommonFields } from './AdditionalCommonFields';
import { TypeSpecificFields } from './TypeSpecificFields';
import { adminMaterialTypeService } from '../../../services/admin/adminMaterialTypeService';
import { adminCourseService } from '../../../services/admin/adminCourseService';
/**
 * AdminHitchcockForm
 *
 * - Provides a simple search input.
 * - Performs a search via the Yii2 endpoint `/hitchcock/search-resources?title=[searchTerm]`
 *   which handles Hitchcock authentication server-side.
 * - Displays the results in a table.
 * - When a result is selected, a modal opens so you can add additional details.
 */
export const AdminHitchcockForm = ({ course, onSubmit }) => {
  // State for the search input and results
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [materialTypeFields, setMaterialTypeFields] = useState([]);
  const [materialTypes, setMaterialTypes] = useState([]);

  // State for loading and error handling
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State for modal visibility
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Form data state for additional details on the resource
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

  // State to handle copy-to-clipboard feedback for API data
  const [copiedField, setCopiedField] = useState(null);

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
   * handleSearch
   * On form submission, calls the Yii2 endpoint to perform a Hitchcock search.
   */
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setError(null);
    setLoading(true);
    try {
      // Build the search URL using the search term (encoded)
      // Adjust the URL if you need to prepend a backend base URL
      const searchUrl = `https://libtools2.smith.edu/course-reserves/backend/web/hitchcock/search-resources?title=${encodeURIComponent(searchTerm)}`;

      // Perform the search. The backend handles Hitchcock authentication.
      const response = await fetch(searchUrl, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }
      const results = await response.json();
      setSearchResults(results);
    } catch (err) {
      console.error('Error during search:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * handleSelectRecord
   * Maps the selected Hitchcock record to our formData and opens the edit modal.
   */
  const handleSelectRecord = (record) => {
    setSelectedRecord(record);
    setFormData({
      title: record.title || '',
      link: record.link || '',
      notes: record.notes || '',
      material_type: '', // Let the user choose material type if necessary
      metadata: {},
      use_proxy: false,
      start_visibility: '',
      end_visibility: '',
      internal_note: '',
      external_note: '',
      folder: ''
    });
    setEditModalOpen(true);
  };

  /**
   * handleFieldChange
   * Updates formData when input values change.
   */
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

  /**
   * handleSubmitResource
   * Submits the resource. Replace the example submission with your actual service call.
   */
  const handleSubmitResource = async () => {
    try {
      setLoading(true);
      // If proxy is enabled, adjust the link accordingly.
      let finalLink = formData.link || '';
      if (formData.use_proxy) {
        const proxyPrefix = "https://libproxy.smith.edu/login?url=";
        if (!finalLink.startsWith(proxyPrefix)) {
          finalLink = proxyPrefix + finalLink;
        }
      }
      const submissionData = { ...formData, link: finalLink };
      await adminCourseService.createResource(course.course_id, submissionData);
      alert('Resource added successfully!');
      setEditModalOpen(false);
      onSubmit();
    } catch (err) {
      console.error('Error submitting resource:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * handleInsertField
   * Copies a field’s value to clipboard and shows feedback.
   */
  const handleInsertField = async (value, fieldName) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      setError('Failed to copy text to clipboard.');
    }
  };

  return (
    <div>
      <h4>Hitchcock Search</h4>
      <Form inline onSubmit={handleSearch} className="mb-3">
        <FormGroup className="mr-2">
          <Label for="hitchcockQuery" className="mr-2">Search Query</Label>
          <Input
            id="hitchcockQuery"
            name="hitchcockQuery"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter title to search..."
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
                <th>ID</th>
                <th>Title</th>
                <th>Form</th>
                <th>Description</th>
                <th>Notes</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map(record => (
                <tr key={record.id}>
                  <td style={{ wordBreak: 'break-all' }}>{record.id}</td>
                  <td>{record.title}</td>
                  <td>{record.form}</td>
                  <td>{record.description || '-'}</td>
                  <td>{record.notes || '-'}</td>
                  <td>
                    <Button color="primary" onClick={() => handleSelectRecord(record)}>
                      Edit &amp; Add
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* Modal for editing and adding additional details */}
      <Modal size="xl" isOpen={editModalOpen} toggle={() => setEditModalOpen(!editModalOpen)}>
        <ModalHeader toggle={() => setEditModalOpen(!editModalOpen)}>
          Edit Resource Details
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
                    <Col className="text-right mt-3">
                      <Button color="primary" onClick={handleSubmitResource} disabled={loading}>
                        Save &amp; Add
                      </Button>
                    </Col>
                  </Row>
                </Container>
              </Col>
              {/* Right Column: Display raw API data from the selected record */}
              <Col md={4}>
                <h5>Available API Data</h5>
                <p>Click "Copy" to copy its value:</p>
                {selectedRecord && (
                  <ListGroup>
                    {Object.entries(selectedRecord).map(([key, value], index) => (
                      <ListGroupItem key={index} className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{key}:</strong>{' '}
                          <span style={{ wordBreak: 'break-all' }}>
                            {typeof value === 'object' ? JSON.stringify(value) : value}
                          </span>
                        </div>
                        <span
                          className="badge text-bg-primary rounded-pill"
                          onClick={() =>
                            handleInsertField(
                              typeof value === 'object' ? JSON.stringify(value) : value,
                              key
                            )
                          }
                        >
                          {copiedField === key ? "✓ Copied" : "Copy"}
                        </span>
                      </ListGroupItem>
                    ))}
                  </ListGroup>
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

AdminHitchcockForm.propTypes = {
  course: PropTypes.object.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

