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
  Container,
  Row,
  Col,
  Card,
  CardBody,
  ListGroup,
  ListGroupItem
} from 'reactstrap';
import PropTypes from 'prop-types';
import { adminCourseService } from '../../../services/admin/adminCourseService';
import { mapEdsRecordToResource } from '../../../util/mapEDSRecordToRespurce';
import { useAdminCourseStore } from '../../../store/adminCourseStore';
import { adjustProxy } from '../../../util/proxyUtil';
import { toast } from 'react-toastify';
import BaseResourceForm from './common/BaseResourceForm';

export const AdminEDSForm = ({ onSubmit }) => {
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // Selected record state
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [parsedRecord, setParsedRecord] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  
  // Course state
  const { course, folioCourseData } = useAdminCourseStore();


  // Handle search
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

  // Handle selection of a record
  const handleSelectRecord = async (record) => {
    try {
      const mapped = await mapEdsRecordToResource(record);
      console.log(mapped)
      setSelectedRecord(record);
      setParsedRecord(mapped);
      setEditModalOpen(true);
    } catch (err) {
      console.error('Error processing record:', err);
      setError('Failed to process selected record.');
    }
  };

  // Handle submit
  const handleSubmitResource = async (formData) => {
    try {
      // Make sure material_type_id is set for server submission
      // This ensures the material type is preserved when editing
      if (parsedRecord && parsedRecord.material_type && !formData.material_type_id) {
        formData.material_type_id = parsedRecord.material_type;
      }
      
      // Apply proxy settings
      adjustProxy(formData);
      
      console.log(formData)
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
      
      // Submit the resource
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

  // Copy field to clipboard
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

  // Build verification URL
  const buildVerificationUrl = (record) => {
    const accession = record.AccessionNumber;
    const dbId = record.DatabaseId;
    if (!accession) return '#';
    return `https://openurl.ebsco.com/c/4e4lys/openurl?sid=ebsco:plink&id=ebsco:${encodeURIComponent(dbId)}:${encodeURIComponent(accession)}`;
  };

  return (
    <Container fluid className="py-4">
      <Card className="shadow-sm mb-4">
        <CardBody>
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
                          <a href={buildVerificationUrl(record)} target="_blank" rel="noopener noreferrer">Verify</a>
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
                {parsedRecord && (
                  <BaseResourceForm
                    initialData={{
                      title: parsedRecord.title || '',
                      link: parsedRecord.link || '',
                      notes: parsedRecord.notes || '',
                      material_type_id: parsedRecord.material_type || '',
                      metadata: parsedRecord.metadata || {},
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
                    <p>Click &quot;Copy&quot; to copy its value:</p>
                    {selectedRecord && selectedRecord.Items && selectedRecord.Items.length > 0 ? (
                      <ListGroup>
                        {selectedRecord.Items.map((item, index) => (
                          <ListGroupItem key={index} className="d-flex justify-content-between align-items-center">
                            <div>
                              <strong>{item.Name}:</strong> 
                              <span style={{wordBreak: "break-all"}}>
                                {item?.links?.[0]?.href ? item.links[0].href : item.plainText}
                              </span>
                            </div>
                            <span 
                              className="badge bg-primary rounded-pill" 
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleInsertField(item?.links?.[0]?.href ? item.links[0].href : item.plainText, item)}
                            >
                              {copiedField === item.Name ? "✓ Copied" : "Copy"}
                            </span>
                          </ListGroupItem>
                        ))}
                      </ListGroup>
                    ) : (
                      <p>No API data available.</p>
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

AdminEDSForm.propTypes = {
  onSubmit: PropTypes.func.isRequired
};

export default AdminEDSForm;
