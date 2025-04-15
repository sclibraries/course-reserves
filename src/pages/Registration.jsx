import { useState, useEffect } from 'react';
import { Card, Form, FormGroup, Label, Input, Button, Alert, Container, Row, Col } from 'reactstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { config } from '../config';

/**
 * Registration page for users who need to create an account
 * 
 * @component
 * @returns {JSX.Element} Registration form component
 */
const Registration = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract username from URL if provided by Shibboleth redirect
  const queryParams = new URLSearchParams(location.search);
  const shibUsername = queryParams.get('username');
  
  // Form state
  const [formData, setFormData] = useState({
    username: shibUsername || '',
    full_name: '',
    email: '',
    department: 'Libraries',
    institution: 'Smith College',
    role: 'user',
  });
  
  // UI state
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState({ status: null, message: null });

  // Update username if provided in URL params
  useEffect(() => {
    if (shibUsername) {
      setFormData(prev => ({ ...prev, username: shibUsername }));
    }
  }, [shibUsername]);

  // Validation function
  const validateForm = () => {
    const newErrors = {};
    
    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    
    // Full name validation
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    }
    
    // Email validation - must end with allowed domains
    const validDomains = ['smith.edu', 'hampshire.edu', 'amherst.edu', 'mtholyoke.edu', 'umass.edu'];
    const emailRegex = new RegExp(`^[\\w.-]+@(${validDomains.join('|')})$`, 'i');
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Email must be from a Five College institution';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field if user is correcting it
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    setSubmitResult({ status: null, message: null });
    
    try {
      const response = await fetch(`${config.api.urls.courseReserves}${config.api.endpoints.auth.register}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSubmitResult({
          status: 'success',
          message: 'Registration successful! Your account is pending approval by an administrator.'
        });
        
        // Clear the form after successful submission
        setFormData({
          username: shibUsername || '',
          full_name: '',
          email: '',
          department: 'Libraries',
          institution: 'Smith College',
          role: 'user',
        });
        
        // Redirect to a confirmation page after a delay
        setTimeout(() => {
          navigate('/registration-confirmation');
        }, 3000);
      } else {
        setSubmitResult({
          status: 'error',
          message: data.message || 'Registration failed. Please try again.'
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      setSubmitResult({
        status: 'error',
        message: 'An unexpected error occurred. Please try again later.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card className="shadow">
            <div className="card-body p-4">
              <h1 className="card-title text-center mb-4">Create Account</h1>
              
              {submitResult.status === 'success' && (
                <Alert color="success" className="mb-4">
                  {submitResult.message}
                </Alert>
              )}
              
              {submitResult.status === 'error' && (
                <Alert color="danger" className="mb-4">
                  {submitResult.message}
                </Alert>
              )}
              
              <p className="mb-4">
                Please fill in this form to request access to the Course Reserves system. 
                All accounts require approval before access is granted.
              </p>
              
              <Form onSubmit={handleSubmit}>
                <FormGroup>
                  <Label for="username">Username (Shibboleth ID)</Label>
                  <Input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    invalid={!!errors.username}
                    disabled={!!shibUsername} // Disable if provided by Shibboleth
                    placeholder="Your institutional username"
                  />
                  {errors.username && <div className="text-danger">{errors.username}</div>}
                </FormGroup>
                
                <FormGroup>
                  <Label for="full_name">Full Name</Label>
                  <Input
                    type="text"
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    invalid={!!errors.full_name}
                    placeholder="Your full name"
                  />
                  {errors.full_name && <div className="text-danger">{errors.full_name}</div>}
                </FormGroup>
                
                <FormGroup>
                  <Label for="email">Institutional Email</Label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    invalid={!!errors.email}
                    placeholder="your.email@institution.edu"
                  />
                  {errors.email && <div className="text-danger">{errors.email}</div>}
                  <small className="text-muted">
                    Must be from smith.edu, hampshire.edu, amherst.edu, mtholyoke.edu, or umass.edu
                  </small>
                </FormGroup>
                
                <FormGroup>
                  <Label for="department">Department</Label>
                  <Input
                    type="select"
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                  >
                    <option value="Libraries">Libraries</option>
                    <option value="IT">IT</option>
                    <option value="Other">Other</option>
                  </Input>
                </FormGroup>
                
                <FormGroup>
                  <Label for="institution">Institution</Label>
                  <Input
                    type="select"
                    id="institution"
                    name="institution"
                    value={formData.institution}
                    onChange={handleChange}
                  >
                    <option value="Smith College">Smith College</option>
                    <option value="Amherst College">Amherst College</option>
                    <option value="Hampshire College">Hampshire College</option>
                    <option value="Mount Holyoke College">Mount Holyoke College</option>
                    <option value="UMass Amherst">UMass Amherst</option>
                  </Input>
                </FormGroup>
                
                {/* Hidden role field that defaults to "user" */}
                <Input type="hidden" name="role" value="user" />
                
                <div className="mt-4 text-center">
                  <Button
                    type="submit"
                    color="primary"
                    size="lg"
                    className="px-5"
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : 'Request Access'}
                  </Button>
                </div>
                
                <div className="mt-3 text-center">
                  <small className="text-muted">
                    All account requests are subject to review and approval.
                  </small>
                </div>
              </Form>
            </div>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Registration;
