import { useState, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Form, FormGroup, Label, Input, 
  Button, Alert, TabContent, TabPane, Nav, NavItem, NavLink, 
  Spinner, Row, Col
} from 'reactstrap';
import { toast } from 'react-toastify';
import { adminCustomizationService } from '../../../services/admin/adminCustomizationService';
import { useAuth } from '../../../contexts/AuthContext'; // Import the auth context


function AdminCustomizations() {
    const [customizations, setCustomizations] = useState([]);
    const [filteredCustomizations, setFilteredCustomizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [activeTab, setActiveTab] = useState(0);
    const [editedCustomization, setEditedCustomization] = useState(null);
    const [sectionLoading, setSectionLoading] = useState({});
    const { user } = useAuth(); // Get the current user from auth context

    useEffect(() => {
        fetchCustomizations();
    }, []);

    // Filter customizations based on user permissions
    useEffect(() => {
        if (customizations.length > 0 && user) {
            // If user is admin, show all customizations
            if (user.role === 'admin') {
                setFilteredCustomizations(customizations);
            } else {
                // Convert institution domain to campus_location format
                // This mapping should match your actual data format
                const institutionToCampusMap = {
                    'Smith College': 'smith',
                    'Hampshire College': 'hampshire',
                    'Amherst College': 'amherst',
                    'Mount Holyoke College': 'mtholyoke',
                    'UMass Amherst': 'umass'
                };

                const userInstitutionMap = {
                    'Smith College' : 'smith.edu',
                    'Hampshire College' : 'hampshire.edu',
                    'Amherst College' : 'amherst.edu',
                    'Mount Holyoke College' : 'mtholyoke.edu',
                    'UMass Amherst' : 'umass.edu'
                }

                const userCampus = institutionToCampusMap[user.institution] || '';

                
                // Check if user has permission to customize their institution
                const canCustomize = user.permissions && 
                    user.permissions.includes(`customize_${userInstitutionMap[user.institution]}`);

                if (canCustomize) {
                    // Filter to only show the user's institution
                    const userCustomizations = customizations.filter(
                        c => c.campus_location.toLowerCase() === userCampus.toLowerCase()
                    );
                    setFilteredCustomizations(userCustomizations);
                } else {
                    // User doesn't have permission to customize any institution
                    setFilteredCustomizations([]);
                    setError("You don't have permission to customize any institution settings.");
                }
            }

            // Reset active tab and edited customization if needed
            if (filteredCustomizations.length > 0) {
                setActiveTab(0);
                setEditedCustomization({...filteredCustomizations[0]});
            }
        }
    }, [customizations, user, filteredCustomizations]);

    const fetchCustomizations = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await adminCustomizationService.getCustomization();
            setCustomizations(data);
        } catch (error) {
            console.error('Error fetching customizations:', error);
            setError('Failed to load customization data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (tabIndex) => {
        if (filteredCustomizations && filteredCustomizations.length > tabIndex) {
            setEditedCustomization({...filteredCustomizations[tabIndex]});
            setActiveTab(tabIndex);
        }
    };


    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditedCustomization(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleColorChange = (e) => {
        const { name, value } = e.target;
        setEditedCustomization(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSuccess(null);
        setError(null);
        
        try {
            setLoading(true);
            await adminCustomizationService.updateCustomization(
                editedCustomization.id, 
                editedCustomization
            );
            
            // Update the customizations array with the edited version
            const updatedCustomizations = customizations.map(c => 
                c.id === editedCustomization.id ? editedCustomization : c
            );
            
            setCustomizations(updatedCustomizations);
            setSuccess(`Successfully updated ${editedCustomization.campus_location} customizations.`);
            
            // Hide success message after 5 seconds
            setTimeout(() => setSuccess(null), 5000);
        } catch (error) {
            console.error('Error updating customization:', error);
            setError(`Failed to update customizations: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle section-specific updates
    const handleSectionUpdate = async (sectionIndex) => {
        if (!editedCustomization) return;
        
        setSuccess(null);
        setError(null);
        
        // Mark this specific section as loading
        setSectionLoading(prev => ({
            ...prev,
            [sectionIndex]: true
        }));
        
        try {
            // Get the section fields and create a partial update object
            const section = formSections[sectionIndex];
            const sectionData = {
                id: editedCustomization.id
            };
            
            // Only include fields from this section in the update
            section.fields.forEach(field => {
                sectionData[field.name] = editedCustomization[field.name];
            });
            
            // Send the update for just this section
            const update = await adminCustomizationService.updateCustomizationSection(
                editedCustomization.id, 
                sectionData
            );

            if(!update) {
                toast.error('Failed to update section. Please try again.');
                return;
            }
            
            // Update the customizations array with the edited version
            const updatedCustomizations = customizations.map(c => 
                c.id === editedCustomization.id ? { ...c, ...sectionData } : c
            );
            
            setCustomizations(updatedCustomizations);
            toast.success(`Successfully updated ${section.title} for ${editedCustomization.campus_location}.`);
            
            // Hide success message after 5 seconds
            setTimeout(() => setSuccess(null), 5000);
        } catch (error) {
            console.error('Error updating section:', error);
            toast.error(`Failed to update section: ${error.message}`);
        } finally {
            setSectionLoading(prev => ({
                ...prev,
                [sectionIndex]: false
            }));
        }
    };

    // Group form fields into logical sections
    const formSections = [
        {
            title: "General Settings",
            fields: [
                { name: "campus_location", label: "Campus Location", type: "text" },
                { name: "logo_url", label: "Logo URL", type: "text" },
                { name: "secondary_text", label: "Secondary Text", type: "text" },
                { name: "alt_text", label: "Logo Alt Text", type: "text" },
                { name: "additional_header_text", label: "Additional Header Text", type: "text" },
                { name: "moodle_link", label: "Moodle Link", type: "text" }
            ]
        },
        {
            title: "Header Styling",
            fields: [
                { name: "header_bg_color", label: "Header Background Color", type: "color" }
            ]
        },
        {
            title: "Button Styling",
            fields: [
                { name: "search_button_bg_color", label: "Search Button Background Color", type: "color" },
                { name: "reset_button_bg_color", label: "Reset Button Background Color", type: "color" }
            ]
        },
        {
            title: "Card Styling",
            fields: [
                { name: "card_bg_color", label: "Card Background Color", type: "color" },
                { name: "card_border_color", label: "Card Border Color", type: "color" },
                { name: "card_title_text_color", label: "Card Title Text Color", type: "color" },
                { name: "card_title_font_size", label: "Card Title Font Size", type: "text" },
                { name: "card_text_color", label: "Card Text Color", type: "color" },
                { name: "card_button_bg_color", label: "Card Button Background Color", type: "color" }
            ]
        },
        {
            title: "Records Display",
            fields: [
                { name: "records_card_title_text_color", label: "Records Card Title Text Color", type: "color" },
                { name: "records_card_text_color", label: "Records Card Text Color", type: "color" },
                { name: "records_discover_link_text", label: "Records Discover Link Text", type: "text" },
                { name: "records_discover_link_bg_color", label: "Records Discover Link Background Color", type: "color" },
                { name: "records_discover_link_base_url", label: "Records Discover Link Base URL", type: "text" }
            ]
        },
        {
            title: "Accordion Styling",
            fields: [
                { name: "accordion_header_bg_color", label: "Accordion Header Background Color", type: "color" },
                { name: "accordion_header_text_color", label: "Accordion Header Text Color", type: "color" }
            ]
        }
    ];

    if (loading && !editedCustomization) {
        return (
            <div className="text-center my-5">
                <Spinner color="primary" />
                <p className="mt-2">Loading customization data...</p>
            </div>
        );
    }

    return (
        <div className="admin-customizations">
            <h2>Site Customizations</h2>
            <p>Edit branding and UI settings for each campus location.</p>
            
            {error && (
                <Alert color="danger" className="mt-3">
                    {error}
                </Alert>
            )}
            
            {success && (
                <Alert color="success" className="mt-3">
                    {success}
                </Alert>
            )}
            
            {filteredCustomizations && filteredCustomizations.length > 0 ? (
                <div className="mt-4">
                    <Nav tabs className="mb-4">
                        {filteredCustomizations.map((campus, index) => (
                            <NavItem key={campus.id}>
                                <NavLink
                                    className={activeTab === index ? 'active' : ''}
                                    onClick={() => handleTabChange(index)}
                                >
                                    {campus.campus_location.charAt(0).toUpperCase() + campus.campus_location.slice(1)}
                                </NavLink>
                            </NavItem>
                        ))}
                    </Nav>
                    
                    <TabContent activeTab={activeTab}>
                        {filteredCustomizations.map((campus, index) => (
                            <TabPane tabId={index} key={campus.id}>
                                {editedCustomization && activeTab === index && (
                                    <Form onSubmit={handleSubmit}>
                                        {/* Live Preview Section */}
                                        <Card className="mb-4">
                                            <CardHeader style={{
                                                backgroundColor: editedCustomization.header_bg_color,
                                                color: '#fff'
                                            }}>
                                                <h3>Live Preview</h3>
                                            </CardHeader>
                                            <CardBody>
                                                <div className="preview-header" style={{
                                                    backgroundColor: editedCustomization.header_bg_color,
                                                    padding: '15px',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}>
                                                    {editedCustomization.logo_url && (
                                                        <img 
                                                            src={editedCustomization.logo_url} 
                                                            alt={editedCustomization.alt_text || 'Logo'}
                                                            style={{ maxHeight: '50px', marginRight: '10px' }}
                                                        />
                                                    )}
                                                    <span style={{ color: '#fff' }}>{editedCustomization.secondary_text}</span>
                                                </div>
                                                
                                                <div className="mt-3">
                                                    <h4>Search Button</h4>
                                                    <Button 
                                                        style={{ 
                                                            backgroundColor: editedCustomization.search_button_bg_color,
                                                            borderColor: editedCustomization.search_button_bg_color
                                                        }}
                                                    >
                                                        Search
                                                    </Button>
                                                </div>
                                                
                                                <div className="mt-3">
                                                    <h4>Card Example</h4>
                                                    <div style={{
                                                        backgroundColor: editedCustomization.card_bg_color,
                                                        borderColor: editedCustomization.card_border_color,
                                                        padding: '15px',
                                                        borderRadius: '5px',
                                                        border: `1px solid ${editedCustomization.card_border_color}`
                                                    }}>
                                                        <h5 style={{ 
                                                            color: editedCustomization.card_title_text_color,
                                                            fontSize: editedCustomization.card_title_font_size
                                                        }}>
                                                            Sample Course Title
                                                        </h5>
                                                        <p style={{ color: editedCustomization.card_text_color }}>
                                                            Sample course description and details would appear here.
                                                        </p>
                                                        <Button style={{
                                                            backgroundColor: editedCustomization.card_button_bg_color,
                                                            borderColor: editedCustomization.card_button_bg_color
                                                        }}>
                                                            View Course
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardBody>
                                        </Card>
                                        
                                        {/* Form Sections */}
                                        {formSections.map((section, sectionIndex) => (
                                            <Card className="mb-4" key={`section-${sectionIndex}`}>
                                                <CardHeader className="d-flex justify-content-between align-items-center">
                                                    <h3>{section.title}</h3>
                                                    <Button 
                                                        color="primary"
                                                        size="sm"
                                                        onClick={() => handleSectionUpdate(sectionIndex)}
                                                        disabled={sectionLoading[sectionIndex]}
                                                    >
                                                        {sectionLoading[sectionIndex] ? (
                                                            <>
                                                                <Spinner size="sm" className="me-1" />
                                                                Saving...
                                                            </>
                                                        ) : (
                                                            'Save This Section'
                                                        )}
                                                    </Button>
                                                </CardHeader>
                                                <CardBody>
                                                    <Row>
                                                        {section.fields.map((field) => (
                                                            <Col md={6} key={field.name}>
                                                                <FormGroup>
                                                                    <Label for={field.name}>{field.label}</Label>
                                                                    {field.type === 'color' ? (
                                                                        <div className="d-flex">
                                                                            <Input 
                                                                                type="color"
                                                                                name={field.name}
                                                                                id={field.name}
                                                                                value={editedCustomization[field.name] || '#ffffff'}
                                                                                onChange={handleColorChange}
                                                                                className="me-2"
                                                                                style={{ width: '50px', height: '38px' }}
                                                                            />
                                                                            <Input 
                                                                                type="text"
                                                                                name={field.name}
                                                                                placeholder={field.label}
                                                                                value={editedCustomization[field.name] || ''}
                                                                                onChange={handleInputChange}
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <Input 
                                                                            type={field.type}
                                                                            name={field.name}
                                                                            id={field.name}
                                                                            placeholder={field.label}
                                                                            value={editedCustomization[field.name] || ''}
                                                                            onChange={handleInputChange}
                                                                        />
                                                                    )}
                                                                </FormGroup>
                                                            </Col>
                                                        ))}
                                                    </Row>
                                                </CardBody>
                                            </Card>
                                        ))}
                                        
                                        <div className="d-flex justify-content-end mt-4 mb-5">
                                            <Button 
                                                type="button" 
                                                color="secondary" 
                                                className="me-2" 
                                                onClick={() => handleTabChange(activeTab)}
                                                disabled={loading}
                                            >
                                                Reset All Changes
                                            </Button>
                                            <Button 
                                                type="submit" 
                                                color="primary"
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <>
                                                        <Spinner size="sm" className="me-2" />
                                                        Saving All...
                                                    </>
                                                ) : (
                                                    'Save All Changes'
                                                )}
                                            </Button>
                                        </div>
                                    </Form>
                                )}
                            </TabPane>
                        ))}
                    </TabContent>
                </div>
             ) : !loading && (
                <Alert color="info">
                    {filteredCustomizations.length === 0 && customizations.length > 0 ?
                        "You don't have permission to customize any institution settings." :
                        "No customization data found. Please contact your system administrator."
                    }
                </Alert>
            )}
        </div>
    );
}

export default AdminCustomizations;