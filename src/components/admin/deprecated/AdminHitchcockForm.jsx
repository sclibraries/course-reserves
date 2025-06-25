// AdminHitchcockForm.jsx
import { useState } from 'react';
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
  Card,
  CardBody,
  Container,
  Row,
  Col,
  ListGroup,
  ListGroupItem
} from 'reactstrap';
import PropTypes from 'prop-types';
import { adminCourseService } from '../../../services/admin/adminCourseService';
import { useAdminCourseStore } from '../../../store/adminCourseStore';
import { adjustProxy } from '../../../util/proxyUtil';
import { toast } from 'react-toastify';
import BaseResourceForm from './common/BaseResourceForm';

/**
 * AdminHitchcockForm
 *
 * - Provides a search interface for Hitchcock resources
 * - Uses BaseResourceForm for the editing interface
 */
export const AdminHitchcockForm = ({ onSubmit }) => {
  // Store values
  const { course, folioCourseData } = useAdminCourseStore();

  // State for the search input and results
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  
  // State for loading and error handling
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State for modal visibility
  const [editModalOpen, setEditModalOpen] = useState(false);
  
  // State to handle copy-to-clipboard feedback for API data
  const [copiedField, setCopiedField] = useState(null);

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
   * Maps the selected Hitchcock record to our form data and opens the edit modal.
   */
  const handleSelectRecord = (record) => {
    setSelectedRecord(record);
    setEditModalOpen(true);
  };

  /**
   * handleSubmitResource
   * Submits the resource.
   */
  const handleSubmitResource = async (formData) => {
    try {
      adjustProxy(formData); // Apply proxy if needed
      
      // Apply proxy to any additional links
      if (formData.links && formData.links.length > 0) {
        formData.links = formData.links.map(link => {
          if (link.use_proxy) {
            return { 
              ...link, 
              url: link.url.includes('proxy') ? link.url : `https://libproxy.smith.edu/login?url=${link.url}` 
            };
          }
          return link;
        });
      }
      
      // Create the resource
      await adminCourseService.createResource(
        course.offering_id, 
        course.course_id, 
        formData, 
        folioCourseData
      );
      
      toast.success('Resource added successfully');
      setEditModalOpen(false);
      onSubmit();
      return true;
    } catch (err) {
      console.error('Error submitting resource:', err);
      toast.error('Failed to add resource');
      throw err;
    }
  };

  /**
   * handleInsertField
   * Copies a field's value to clipboard and shows feedback.
   */
  const handleInsertField = async (value, fieldName) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      toast.error('Failed to copy text');
    }
  };

  return (
    <Container fluid className="py-4">
      <Card className="shadow-sm mb-4">
        <CardBody>
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
        </CardBody>
      </Card>

      {/* Modal for editing and adding additional details */}
      <Modal size="xl" isOpen={editModalOpen} toggle={() => setEditModalOpen(!editModalOpen)}>
        <ModalHeader toggle={() => setEditModalOpen(!editModalOpen)}>
          Edit Resource Details
        </ModalHeader>
        <ModalBody>
          <Container fluid className="p-0">
            <Row>
              {/* Left Column: Resource Form */}
              <Col md={8}>
                {selectedRecord && (
                  <BaseResourceForm
                    initialData={{
                      title: selectedRecord.title || '',
                      link: selectedRecord.link || '',
                      notes: selectedRecord.notes || selectedRecord.description || '',
                    }}
                    onSubmit={handleSubmitResource}
                    title="Edit Resource"
                    submitButtonText="Save & Add Resource"
                    onCancel={() => setEditModalOpen(false)}
                    showCancel={true}
                  />
                )}
              </Col>
              
              {/* Right Column: Display raw API data from the selected record */}
              <Col md={4}>
                <Card className="shadow-sm">
                  <CardBody>
                    <h5>Available API Data</h5>
                    <p>Click on a value to copy:</p>
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
                              className="badge bg-primary rounded-pill cursor-pointer"
                              onClick={() =>
                                handleInsertField(
                                  typeof value === 'object' ? JSON.stringify(value) : value,
                                  key
                                )
                              }
                              style={{ cursor: 'pointer' }}
                            >
                              {copiedField === key ? "✓ Copied" : "Copy"}
                            </span>
                          </ListGroupItem>
                        ))}
                      </ListGroup>
                    )}
                  </CardBody>
                </Card>
              </Col>
            </Row>
          </Container>
        </ModalBody>
      </Modal>
    </Container>
  );
};

AdminHitchcockForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
};

export default AdminHitchcockForm;

