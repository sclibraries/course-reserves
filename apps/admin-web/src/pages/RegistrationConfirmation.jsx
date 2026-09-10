import { Link } from 'react-router-dom';
import { Container, Row, Col, Card } from 'reactstrap';

/**
 * Registration confirmation page shown after successful account request
 * 
 * @component
 * @returns {JSX.Element} Confirmation page component
 */
const RegistrationConfirmation = () => {
  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card className="shadow">
            <div className="card-body text-center p-5">
              <div className="mb-4">
                <i className="fas fa-check-circle text-success" style={{ fontSize: '4rem' }}></i>
              </div>
              
              <h1 className="card-title mb-4">Registration Submitted</h1>
              
              <p className="card-text mb-4">
                Thank you for your registration request. Your account is now pending administrator approval.
              </p>
              
              <p className="card-text mb-4">
                Once your account is approved, you&apos;ll be able to access the Course Reserves system.
                You will not receive a notification when your account is approved, so please check back later.
              </p>
              
              <div className="mt-5">
                <Link to="/" className="btn btn-primary btn-lg px-5">
                  Return to Home
                </Link>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default RegistrationConfirmation;
