import PropTypes from 'prop-types';
import {
  Card,
  CardBody,
  FormGroup,
  Label,
  Input,
  Button,
  Alert,
  Row,
  Col
} from 'reactstrap';
import { FaPlus, FaTrash, FaLink, FaTags, FaFileAlt, FaInfoCircle } from 'react-icons/fa';
import '../../../../css/AdminForms.css';

/**
 * ResourceLinks Component
 * =======================
 * 
 * **Purpose**: Manages additional URL links for resources, allowing multiple
 * related links beyond the primary resource URL.
 * 
 * **Key Features**:
 * - Dynamic addition/removal of link entries
 * - Individual proxy settings per link
 * - Structured data with URL, title, and description
 * - Responsive card-based layout
 * - Validation for required fields
 * - Empty state with helpful messaging
 * - Clean, focused interface (visibility controls handled elsewhere)
 * 
 * **Use Cases**:
 * - Related articles or resources
 * - Alternative access points (e.g., different databases)
 * - Supplementary materials
 * - Help or instruction pages
 * 
 * **Data Structure**:
 * Each link object contains:
 * - `url` (required): The link URL
 * - `title` (optional): Display name for the link
 * - `description` (optional): Brief description
 * - `use_proxy` (boolean): Whether to apply proxy for off-campus access
 * 
 * **Note**: Visibility settings are now handled by the UnifiedVisibilityControl component
 * 
 * @component
 * @example
 * <ResourceLinks
 *   links={formData.links}
 *   setLinks={updateLinks}
 * />
 */
const ResourceLinks = ({ 
  links, 
  setLinks, 
  resourceVisibilityDates = { startDate: '', endDate: '' }
}) => {
  // Function to add a new empty link
  const addLink = () => {
    // Default to resource visibility dates if they exist
    const defaultStartDate = resourceVisibilityDates.startDate || '';
    const defaultEndDate = resourceVisibilityDates.endDate || '';
    
    setLinks([...links, { 
      url: '', 
      title: '', 
      description: '', 
      use_proxy: false,
      start_visibility: defaultStartDate,
      end_visibility: defaultEndDate,
      use_link_visibility: false // Never auto-enable, let user choose
    }]);
  };

  // Function to remove a link at a specific index
  const removeLink = (indexToRemove) => {
    setLinks(links.filter((_, index) => index !== indexToRemove));
  };

  // Function to update a specific link's property
  const updateLink = (index, field, value) => {
    const newLinks = [...links];
    newLinks[index][field] = value;
    setLinks(newLinks);
  };

  return (
    <div className="resource-links">
      <div className="mb-3 d-flex justify-content-between align-items-center">
        <h5 className="mb-0 text-primary">
          <FaLink className="me-2" />
          Additional Resource Links
        </h5>
        <Button 
          color="primary" 
          size="sm" 
          className="add-link-button"
          onClick={addLink}
        >
          <FaPlus className="me-1" /> Add Link
        </Button>
      </div>

      {links.length === 0 ? (
        <Alert color="light" className="text-center p-4 border" fade={false}>
          <FaInfoCircle className="mb-2" size={24} />
          <p className="mb-0">No additional links added. Click &quot;Add Link&quot; to include related resources.</p>
        </Alert>
      ) : (
        <div className="links-container">
          {links.map((link, index) => (
            <Card key={index} className="link-card mb-3">
              <CardBody>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="card-title mb-0">
                    Link #{index + 1}
                  </h6>
                  <Button
                    color="link"
                    className="text-danger p-0"
                    onClick={() => removeLink(index)}
                  >
                    <FaTrash /> Remove
                  </Button>
                </div>
                
                <Row>
                  <Col md={12}>
                    <FormGroup>
                      <Label for={`url-${index}`}>
                        <FaLink className="me-1" /> URL <span className="text-danger">*</span>
                      </Label>
                      <Input
                        id={`url-${index}`}
                        type="url"
                        placeholder="https://example.com"
                        value={link.url}
                        onChange={(e) => updateLink(index, 'url', e.target.value)}
                        required={index === 0}
                        className="link-url-input"
                      />
                    </FormGroup>
                  </Col>
                  
                  <Col md={6}>
                    <FormGroup>
                      <Label for={`title-${index}`}>
                        <FaTags className="me-1" /> Title
                      </Label>
                      <Input
                        id={`title-${index}`}
                        type="text"
                        placeholder="Link title"
                        value={link.title}
                        onChange={(e) => updateLink(index, 'title', e.target.value)}
                      />
                    </FormGroup>
                  </Col>
                  
                  <Col md={6}>
                    <FormGroup>
                      <Label for={`use-proxy-${index}`}>Proxy Settings</Label>
                      <div className="mt-2">
                        <div className="form-check form-switch">
                          <input
                            id={`use-proxy-${index}`}
                            type="checkbox"
                            className="form-check-input"
                            checked={link.use_proxy}
                            onChange={(e) => updateLink(index, 'use_proxy', e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor={`use-proxy-${index}`}>
                            Use proxy for this link
                          </label>
                        </div>
                      </div>
                    </FormGroup>
                  </Col>
                  
                  <Col md={12}>
                    <FormGroup>
                      <Label for={`description-${index}`}>
                        <FaFileAlt className="me-1" /> Description
                      </Label>
                      <Input
                        id={`description-${index}`}
                        type="textarea"
                        rows="2"
                        placeholder="Link description"
                        value={link.description}
                        onChange={(e) => updateLink(index, 'description', e.target.value)}
                      />
                    </FormGroup>
                  </Col>
                </Row>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {links.length > 0 && (
        <div className="text-center mt-3">
          <Button
            color="light"
            outline
            className="add-more-button"
            onClick={addLink}
          >
            <FaPlus className="me-1" /> Add Another Link
          </Button>
        </div>
      )}
    </div>
  );
};

ResourceLinks.propTypes = {
  links: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string.isRequired,
      title: PropTypes.string,
      description: PropTypes.string,
      use_proxy: PropTypes.bool,
      start_visibility: PropTypes.string,
      end_visibility: PropTypes.string,
      use_link_visibility: PropTypes.bool
    })
  ).isRequired,
  setLinks: PropTypes.func.isRequired,
  resourceVisibilityDates: PropTypes.shape({
    startDate: PropTypes.string,
    endDate: PropTypes.string
  })
};

export default ResourceLinks;