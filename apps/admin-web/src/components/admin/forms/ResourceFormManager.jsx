import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalHeader, ModalBody, Container, Row, Col, Card, CardBody, Table, Spinner, Alert, Button, ListGroup, ListGroupItem } from 'reactstrap';
import { notify } from '../../../services/notify';

// Form components
import BaseResourceForm from './common/BaseResourceForm';
import { AdminReuseForm } from './specialized/AdminReuseForm';
import { CrossLinkForm } from './specialized/CrosslinkForm';

// Constants
import { ResourceFormType } from './constants/formTypes';

// Services
import { adminCourseService } from '../../../services/admin/adminCourseService';
import { getEdsSearchErrorMessage } from '../../../services/admin/course/resourceApi';
import { adminResourceService } from '../../../services/admin/adminResourceService';
import { hitchcockService } from '../../../services/admin/hitchcockService';
import { useAdminCourseStore } from '../../../store/adminCourseStore';
import { adjustProxy, LIBPROXY_PREFIX } from '../../../util/proxyUtil';
import { mapEdsRecordToResource } from '../../../util/mapEDSRecordToRespurce';

/**
 * ResourceFormManager - Unified component for managing all resource forms
 * 
 * This component consolidates all resource forms into a single, manageable interface
 * following DRY and SOLID principles. It handles:
 * - Form type selection and rendering
 * - Data transformation and validation
 * - API interactions
 * - Error handling and user feedback
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} props.onSubmit - Callback when form is successfully submitted
 * @param {string} props.formType - Type of form to display (from ResourceFormType)
 * @param {Object} props.initialData - Initial data for the form
 * @param {Object} props.course - Current course data
 * @param {string} props.title - Modal title override
 */
export const ResourceFormManager = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  formType, 
  initialData = {}, 
  course,
  title: customTitle,
  refreshLinkedCourses,
  ...additionalProps 
}) => {
  // Store access
  const { folioCourseData } = useAdminCourseStore();
  
  // Common state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Search-specific state (for EDS, Hitchcock, Reuse)
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  
  // Additional state for API data display
  const [copiedField, setCopiedField] = useState(null);
  
  // Pagination state for EDS search
  const [currentPage, setCurrentPage] = useState(1);
  const [totalHits, setTotalHits] = useState(0);
  const [searchTime, setSearchTime] = useState(0);
  const [ebscoQueryString, setEbscoQueryString] = useState('');


  /**
   * Reset all state when modal closes or form type changes
   */
  const resetState = () => {
    setLoading(false);
    setError(null);
    setSearchTerm('');
    setSearchResults([]);
    setSelectedRecord(null);
    setShowEditForm(false);
    setCopiedField(null);
    setCurrentPage(1);
    setTotalHits(0);
    setSearchTime(0);
    setEbscoQueryString('');
  };

  /**
   * Effect to reset state when modal opens/closes or form type changes
   */
  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, formType]);

  /**
   * Get modal configuration based on form type
   */
  const getModalConfig = () => {
    const configs = {
      [ResourceFormType.NEW]: {
        title: 'Add New Resource',
        size: 'xl',
        fullscreen: true
      },
      [ResourceFormType.EDIT]: {
        title: 'Edit Resource',
        size: 'xl',
        fullscreen: true
      },
      [ResourceFormType.EDS]: {
        title: 'Create Resource from EDS',
        size: 'xl',
        fullscreen: true
      },
      [ResourceFormType.HITCHCOCK]: {
        title: 'Create Resource from Hitchcock',
        size: 'xl',
        fullscreen: true
      },
      [ResourceFormType.REUSE]: {
        title: 'Reuse Existing Resource',
        size: 'xl',
        fullscreen: true
      },
      [ResourceFormType.CROSSLINK]: {
        title: 'Cross-link to Another Course',
        size: 'xl',
        fullscreen: true
      }
    };
    
    return configs[formType] || configs[ResourceFormType.NEW];
  };

  /**
   * Transform resource metadata from array to object format
   */
  const transformMetadata = (metadata) => {
    if (!metadata) {
      return {};
    }
    if (!Array.isArray(metadata)) {
      console.warn('Expected metadata to be an array but received:', metadata);
      return metadata || {};
    }
    return metadata.reduce((acc, item) => {
      if (item && item.field_name) {
        acc[item.field_name] = item.field_value;
      }
      return acc;
    }, {});
  };

  /**
   * Handle base form submission (for new/edit/selected records)
   */
  const handleBaseFormSubmit = async (formData) => {
    try {
      setLoading(true);
      
      // Apply proxy settings
      adjustProxy(formData);
      
      // Apply proxy to additional links
      if (formData.links && formData.links.length > 0) {
        formData.links = formData.links.map(link => {
          if (link.use_proxy) {
            return { 
              ...link, 
              url: link.url.includes('proxy') ? link.url : `${LIBPROXY_PREFIX}${link.url}`
            };
          }
          return link;
        });
      }

      let result;
      if (formType === ResourceFormType.EDIT) {
        // Update existing resource
        const { resource_id, ...updateData } = formData;
        result = await additionalProps.onUpdate?.(formData) || 
                await adminResourceService.updateResource(resource_id, updateData);
      } else {
        // Create new resource
        result = await adminCourseService.createResource(
          course.offering_id, 
          course.course_id, 
          formData, 
          folioCourseData
        );
      }

      if (result !== false) {
        notify.success(formType === ResourceFormType.EDIT ? 'Resource updated' : 'Resource added');
        onSubmit?.(formData);
        onClose();
      }
      
      return result;
    } catch (err) {
      console.error('Error submitting resource:', err);
      setError("Couldn't save the resource");
      notify.fromError(err, "Couldn't save the resource");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle search operations (EDS, Hitchcock)
   */
  const handleSearch = async (searchQuery = searchTerm, page = 1) => {
    if (!searchQuery.trim() && page === 1) {
      setError('Please enter a search term');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      let results = [];
      
      if (formType === ResourceFormType.EDS) {
        const data = await adminCourseService.searchEDS(searchQuery);
        
        // Handle new backend response structure
        if (data.status !== 'success' || data.code !== 200) {
          throw new Error(getEdsSearchErrorMessage());
        }
        
        results = data.data?.records || [];
        
        // Update pagination state
        setTotalHits(data.data?.statistics?.TotalHits || 0);
        setSearchTime(data.data?.statistics?.TotalSearchTime || 0);
        setEbscoQueryString(data.data?.request?.QueryString || '');
        setCurrentPage(page);
        
        if (page === 1) {
          setSearchResults(results);
        } else {
          setSearchResults(prev => [...prev, ...results]);
        }
      } else if (formType === ResourceFormType.HITCHCOCK) {
        const response = await hitchcockService.searchResources(searchQuery);

        if (!response.ok) {
          throw new Error(`Search failed with status ${response.status}`);
        }

        results = await response.json();
        setSearchResults(results);
      } else if (formType === ResourceFormType.REUSE) {
        const data = await adminCourseService.searchResources(searchQuery);
        results = data?.resources || [];
        setSearchResults(results);
      }
      
      if (results.length === 0 && page === 1) {
        setError('No results found for your search term');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed');
      if (page === 1) {
        setSearchResults([]);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle record selection (EDS, Hitchcock)
   */
  const handleSelectRecord = async (record) => {
    try {
      setSelectedRecord(record);
      
      if (formType === ResourceFormType.EDS) {
        // Use the same mapping utility as AdminEDSForm
        const mapped = await mapEdsRecordToResource(record);
        setSelectedRecord({ ...record, parsedData: mapped });
      }
      
      setShowEditForm(true);
    } catch (err) {
      console.error('Error selecting record:', err);
      setError('Failed to process selected record');
    }
  };

  const handleReuseResource = async (resourceId) => {
    setError(null);
    setLoading(true);
    try {
      await additionalProps.onReuse?.(resourceId);
      try {
        await onSubmit?.();
      } catch {
        setError('Resource linked, but the list could not be refreshed.');
        return;
      }
      notify.success('Resource linked');
      onClose();
    } catch (err) {
      console.error('Error reusing resource:', err);
      setError("Couldn't add the resource to the course");
      notify.fromError(err, "Couldn't link the resource");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async (value, fieldName) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      notify.fromError(err, "Couldn't copy the text");
    }
  };

  /**
   * Build verification URL for EDS records
   */
  const buildVerificationUrl = (record) => {
    // Use new field names from robust backend
    const accession = record.An;
    const dbId = record.DbId;
    if (!accession) return record.PLink || '#';
    return `https://openurl.ebsco.com/c/4e4lys/openurl?sid=ebsco:plink&id=ebsco:${encodeURIComponent(dbId)}:${encodeURIComponent(accession)}`;
  };
  
  /**
   * Decode HTML entities in text
   */
  const decodeHtmlEntities = (text) => {
    if (!text) return text;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  };
  
  /**
   * Load more EDS search results (pagination)
   */
  const handleLoadMore = async () => {
    if (loading || !ebscoQueryString) return;
    
    const nextPage = currentPage + 1;
    setLoading(true);
    
    try {
      const data = await adminCourseService.searchEDSPage(ebscoQueryString, nextPage);
      
      if (data.status !== 'success' || data.code !== 200) {
        throw new Error(getEdsSearchErrorMessage());
      }
      
      const newResults = data.data?.records || [];
      setSearchResults(prev => [...prev, ...newResults]);
      setCurrentPage(nextPage);
    } catch (err) {
      console.error('Error loading more results:', err);
      notify.fromError(err, "Couldn't load more library results");
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Extract title from new EDS record structure
   */
  const extractTitle = (record) => {
    const titleData = record.Items?.Ti?.[0]?.CleanData;
    const title = (typeof titleData === 'string' ? titleData : titleData?.[0]) ||
                  record.RecordInfo?.BibEntity?.Titles?.[0]?.TitleFull ||
                  '(No Title)';
    return decodeHtmlEntities(title);
  };
  
  /**
   * Extract authors from new EDS record structure
   */
  const extractAuthors = (record) => {
    const authorData = record.Items?.Au?.[0]?.CleanData;
    const authors = Array.isArray(authorData) ? authorData :
                   (typeof authorData === 'string' ? [authorData] : []);
    const authorString = authors.join('; ') || '';
    return decodeHtmlEntities(authorString);
  };
  
  /**
   * Extract publication type from new EDS record structure
   */
  const extractPubType = (record) => {
    return record.pubType || 'Unknown';
  };

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
   * Prepare initial data for BaseResourceForm based on form type and context
   */
  const getFormInitialData = () => {
    if (formType === ResourceFormType.EDIT && initialData) {
      return {
        resource_id: initialData.resource_id || null,
        title: initialData.name || '',
        link: initialData.item_url || '',
        use_proxy: normalizeProxyValue(initialData.use_proxy),
        folder: initialData.folder_id || null,
        notes: initialData.description || '',
        internal_note: initialData.internal_note || '',
        external_note: initialData.external_note || '',
        start_visibility: initialData.start_visibility || null,
        end_visibility: initialData.end_visibility || null,
        material_type_id: initialData.material_type_id || null,
        order: initialData.order || null,
        created_at: initialData.created_at || '',
        material_type_name: initialData.material_type_name || '',
        course_count: initialData.course_count || 0,
        metadata: transformMetadata(initialData.metadata),
        links: initialData.links || [],
        use_primary_link_visibility: normalizeProxyValue(initialData.use_primary_link_visibility),
        primary_link_start_visibility: initialData.primary_link_start_visibility || null,
        primary_link_end_visibility: initialData.primary_link_end_visibility || null,
      };
    }

    if (selectedRecord) {
      const baseData = {
        title: selectedRecord.title || '',
        link: selectedRecord.link || selectedRecord.item_url || '',
        notes: selectedRecord.notes || selectedRecord.description || '',
      };

      // Add form-specific transformations
      if (formType === ResourceFormType.EDS && selectedRecord.parsedData) {
        return {
          ...baseData,
          ...selectedRecord.parsedData,
          metadata: selectedRecord.parsedData?.metadata || {}
        };
      }

      return baseData;
    }

    // Default initial data with course visibility dates
    const defaultData = { ...initialData };
    if (folioCourseData?.courseListingObject?.termObject) {
      const term = folioCourseData.courseListingObject.termObject;
      defaultData.start_visibility = new Date(term.startDate).toISOString().split('T')[0];
      defaultData.end_visibility = new Date(term.endDate).toISOString().split('T')[0];
    }

    return defaultData;
  };

  /**
   * Render the appropriate form content based on form type
   */
  const renderFormContent = () => {
    // Show BaseResourceForm for direct form types or when editing a selected record
    if ([ResourceFormType.NEW, ResourceFormType.EDIT].includes(formType) || showEditForm) {
      return (
        <BaseResourceForm
          course={folioCourseData}
          initialData={getFormInitialData()}
          onSubmit={handleBaseFormSubmit}
          title={getModalConfig().title}
          submitButtonText={formType === ResourceFormType.EDIT ? 'Save Changes' : 'Create Resource'}
          onCancel={showEditForm ? () => setShowEditForm(false) : onClose}
          showCancel={showEditForm || formType !== ResourceFormType.EDIT}
          loading={loading}
        />
      );
    }

    // Handle specialized forms
    switch (formType) {
      case ResourceFormType.REUSE:
        return (
            <AdminReuseForm
              error={error}
              searchTerm={searchTerm}
              searchResults={searchResults}
              onSearchTermChange={setSearchTerm}
              onSearch={handleSearch}
              onReuse={handleReuseResource}
              isLoading={loading}
            />
        );

      case ResourceFormType.CROSSLINK:
        return (
          <CrossLinkForm
            onSuccess={() => {
              onSubmit?.();
              // Don't call onClose() - keep modal open for multiple operations
              // Refresh linked courses in parent component
              if (refreshLinkedCourses) {
                refreshLinkedCourses();
              }
            }}
            courseInfo={course}
            onClose={onClose}
          />
        );

      case ResourceFormType.EDS:
      case ResourceFormType.HITCHCOCK:
        return renderSearchInterface();

      default:
        return <Alert color="warning" fade={false}>Unknown form type: {formType}</Alert>;
    }
  };

  /**
   * Render search interface for EDS and Hitchcock
   */
  const renderSearchInterface = () => (
    <Container fluid className="p-0">
      {error && (
        <Alert color="danger" className="mb-3" fade={false} style={{ whiteSpace: 'pre-line' }}>
          {error}
        </Alert>
      )}

      {/* Search Form */}
      <Card className="mb-4">
        <CardBody>
          <h5>Search {formType === ResourceFormType.EDS ? 'EDS' : 'Hitchcock'}</h5>
          <div className="d-flex gap-2">
            <input
              type="text"
              className="form-control"
              placeholder="Enter search term..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              disabled={loading}
            />
            <Button
              color="primary"
              onClick={() => handleSearch()}
              disabled={loading || !searchTerm.trim()}
            >
              {loading ? <Spinner size="sm" /> : 'Search'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Search Stats */}
      {formType === ResourceFormType.EDS && totalHits > 0 && (
        <Alert color="info" className="mb-3" fade={false}>
          <div className="d-flex justify-content-between align-items-center">
            <span>
              Found <strong>{totalHits.toLocaleString()}</strong> results in {searchTime}ms
              {searchResults.length < totalHits && (
                <span className="text-muted ms-2">
                  • Showing {searchResults.length} of {totalHits.toLocaleString()}
                </span>
              )}
            </span>
            <span className="text-muted small">EBSCO Discovery</span>
          </div>
        </Alert>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardBody>
            <h5>Search Results</h5>
            <Table responsive striped>
              <thead>
                <tr>
                  {formType === ResourceFormType.EDS ? (
                    <>
                      <th>Accession #</th>
                      <th>Title</th>
                      <th>Author</th>
                      <th>Type</th>
                      <th>Database</th>
                      <th>Verification</th>
                      <th>Action</th>
                    </>
                  ) : (
                    <>
                      <th>Title</th>
                      <th>Link</th>
                      <th>Notes</th>
                      <th>Action</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {searchResults.map((record) => {
                  const key = formType === ResourceFormType.EDS ? record.An : record.id || Math.random();
                  return (
                  <tr key={key}>
                    {formType === ResourceFormType.EDS ? (
                      <>
                        <td style={{ wordBreak: 'break-all', fontSize: '0.85rem' }}>
                          {record.An || 'N/A'}
                        </td>
                        <td>{extractTitle(record)}</td>
                        <td>{extractAuthors(record)}</td>
                        <td>
                          <span className="badge bg-secondary">
                            {extractPubType(record)}
                          </span>
                        </td>
                        <td className="text-muted small">{record.DbLabel || 'EBSCO'}</td>
                        <td>
                          <a 
                            href={buildVerificationUrl(record)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline-secondary"
                          >
                            Verify
                          </a>
                        </td>
                        <td>
                          <Button color="primary" size="sm" onClick={() => handleSelectRecord(record)}>
                            Edit & Add
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{record.title || 'N/A'}</td>
                        <td>
                          {record.link ? (
                            <a href={record.link} target="_blank" rel="noopener noreferrer">
                              {record.link}
                            </a>
                          ) : 'N/A'}
                        </td>
                        <td>{record.notes || record.description || 'N/A'}</td>
                        <td>
                          <Button color="primary" size="sm" onClick={() => handleSelectRecord(record)}>
                            Edit & Add
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </Table>
            
            {/* Load More Button for EDS */}
            {formType === ResourceFormType.EDS && searchResults.length < totalHits && (
              <div className="text-center mt-3">
                <Button 
                  color="secondary" 
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner size="sm" className="me-2" />
                      Loading...
                    </>
                  ) : (
                    `Load More Results (${searchResults.length} of ${totalHits.toLocaleString()})`
                  )}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Show API data for selected record */}
      {selectedRecord && formType === ResourceFormType.EDS && selectedRecord.Items && (
        <Row className="mt-4">
          <Col md={8}>
            {/* Form will be rendered here when showEditForm is true */}
          </Col>
          <Col md={4}>
            <Card>
              <CardBody>
                <h5>Available Metadata</h5>
                <p className="text-muted small">Click &quot;Copy&quot; to copy field values</p>
                <ListGroup className="small">
                  {/* Display cleaned data from new structure */}
                  {Object.entries(selectedRecord.Items).map(([key, items]) => {
                    if (!items || !items[0]) return null;
                    const item = items[0];
                    const rawValue = typeof item.CleanData === 'string' ? 
                                 item.CleanData : 
                                 (Array.isArray(item.CleanData) ? item.CleanData.join('; ') : item.Data);
                    
                    if (!rawValue) return null;
                    
                    const value = decodeHtmlEntities(rawValue);
                    
                    return (
                      <ListGroupItem key={key} className="d-flex justify-content-between align-items-center py-2">
                        <div className="flex-grow-1 me-2">
                          <strong>{item.Label || key}:</strong>{' '}
                          <span style={{ wordBreak: 'break-all' }}>
                            {value}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          color={copiedField === key ? "success" : "outline-primary"}
                          onClick={() => handleCopyToClipboard(value, key)}
                          style={{ minWidth: '70px' }}
                        >
                          {copiedField === key ? "✓ Copied" : "Copy"}
                        </Button>
                      </ListGroupItem>
                    );
                  })}
                  
                  {/* Additional metadata */}
                  {selectedRecord.An && (
                    <ListGroupItem className="d-flex justify-content-between align-items-center py-2">
                      <div className="flex-grow-1 me-2">
                        <strong>Accession:</strong> {selectedRecord.An}
                      </div>
                      <Button
                        size="sm"
                        color={copiedField === 'An' ? "success" : "outline-primary"}
                        onClick={() => handleCopyToClipboard(selectedRecord.An, 'An')}
                        style={{ minWidth: '70px' }}
                      >
                        {copiedField === 'An' ? "✓ Copied" : "Copy"}
                      </Button>
                    </ListGroupItem>
                  )}
                  
                  {selectedRecord.PLink && (
                    <ListGroupItem className="d-flex justify-content-between align-items-center py-2">
                      <div className="flex-grow-1 me-2">
                        <strong>Permalink:</strong>{' '}
                        <a href={selectedRecord.PLink} target="_blank" rel="noopener noreferrer" className="text-truncate d-inline-block" style={{ maxWidth: '200px' }}>
                          {selectedRecord.PLink}
                        </a>
                      </div>
                      <Button
                        size="sm"
                        color={copiedField === 'PLink' ? "success" : "outline-primary"}
                        onClick={() => handleCopyToClipboard(selectedRecord.PLink, 'PLink')}
                        style={{ minWidth: '70px' }}
                      >
                        {copiedField === 'PLink' ? "✓ Copied" : "Copy"}
                      </Button>
                    </ListGroupItem>
                  )}
                </ListGroup>
              </CardBody>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );

  const modalConfig = getModalConfig();

  return (
    <Modal 
      isOpen={isOpen} 
      toggle={onClose}
      size={modalConfig.size}
      fullscreen={modalConfig.fullscreen}
      onClosed={resetState}
    >
      <ModalHeader toggle={onClose}>
        {customTitle || modalConfig.title}
      </ModalHeader>
      <ModalBody>
        {renderFormContent()}
      </ModalBody>
    </Modal>
  );
};

ResourceFormManager.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  formType: PropTypes.oneOf(Object.values(ResourceFormType)).isRequired,
  initialData: PropTypes.object,
  course: PropTypes.object,
  title: PropTypes.string,
  refreshLinkedCourses: PropTypes.func,
  // Additional props for specific form types
  searchTerm: PropTypes.string,
  searchResults: PropTypes.array,
  onSearchTermChange: PropTypes.func,
  onSearch: PropTypes.func,
  onReuse: PropTypes.func,
  onUpdate: PropTypes.func,
  resourceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default ResourceFormManager;
