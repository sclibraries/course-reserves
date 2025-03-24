// Home.jsx
import { Container, Row, Col } from 'reactstrap';
import '../css/Home.css';

function Home() {
  return (
    <Container className="home-container">
      <Row className="justify-content-center">
        <Col md="8" className="text-center">
          <h1>Welcome to the Course Search Portal</h1>
          <p className="lead">
            Search and explore courses across all colleges. Use the search bar or filters above to find courses by name, code, or instructor.
          </p>
        </Col>
      </Row>
    </Container>
  );
}

export default Home;
