import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Card,
  CardBody,
  CardTitle,
  CardText,
  ListGroup,
  ListGroupItem,
  Row,
  Col,
  Button,
  Spinner,
  Alert,
  Accordion,
  AccordionBody,
  AccordionHeader,
  AccordionItem,
} from 'reactstrap';
import useRecordStore from '../store/recordStore';
import useCustomizationStore from '../store/customizationStore';
import { useCurrentCollege } from '../hooks/useCustomization';

function CourseRecords() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentCollege = useCurrentCollege(); // Set the active college

  const searchParams = new URLSearchParams(location.search);
  const collegeParam = searchParams.get('college');

  const { record, setRecord } = useRecordStore();
  const [records, setRecords] = useState([]);
  const [course, setCourse] = useState([]);
  const [springShare, setSpringShare] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availability, setAvailability] = useState({});
  const [openAccordions, setOpenAccordions] = useState({});
  const [customization, setCustomization] = useState(
    useCustomizationStore.getState().getCustomization()
  );

  useEffect(() => {
    const param = searchParams.get('courseListingId');
    if (param && param !== record) {
      setRecord(param);
    }
  }, [location.search, record, setRecord, searchParams]);

  useEffect(() => {
    if (record) {
      fetchAllData();
    }
  }, [record]);

  useEffect(() => {
    if (course && course.length > 0) {
      fetchSpringShare(course[0].courseNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course]);

  const fetchAllData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([fetchData(), fetchCourse()]);
    } catch {
      setError('Failed to fetch data.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const response = await fetch(
        `https://libtools2.smith.edu/folio/web/search/search-course-listings?courseListingId=${record}`
      );
      const results = await response.json();
      setRecords(results.data?.reserves || []);
    } catch {
      setError('Error fetching print resources.');
    }
  };

  const fetchCourse = async () => {
    try {
      const response = await fetch(
        `https://libtools2.smith.edu/folio/web/search/search-courses?query=(courseListingId=${record})`
      );
      const results = await response.json();
      setCourse(results.data?.courses || []);
    } catch {
      setError('Error fetching course details.');
    }
  };

  const fetchSpringShare = async (course_code) => {
    try {
      const response = await fetch(
        `https://libtools2.smith.edu/folio/web/springshare-course/search?course_code=${course_code}`
      );
      const results = await response.json();
      setSpringShare(results);
    } catch {
      setError('Error fetching electronic resources.');
    }
  };

  const fetchItemAvailability = async (instanceId) => {
    try {
      const response = await fetch(
        `https://libtools2.smith.edu/folio/web/search/search-rtac?id=${instanceId}`
      );
      const results = await response.json();
      let { holding } = results.data;

      if (!Array.isArray(holding)) {
        holding = holding ? [holding] : [];
      }

      setAvailability((prev) => ({
        ...prev,
        [instanceId]: {
          holdings: holding,
        },
      }));
    } catch (error) {
      console.error('Error fetching item availability:', error);
    }
  };

  useEffect(() => {
    records.forEach((item) => fetchItemAvailability(item.copiedItem.instanceId));
  }, [records]);

  useEffect(() => {
    const initialOpenAccordions = {};
    records.forEach((recordItem) => {
      const instanceId = recordItem.copiedItem.instanceId;
      initialOpenAccordions[instanceId] = [`reserves-${instanceId}`];
    });
    setOpenAccordions(initialOpenAccordions);
  }, [records]);

  const toggleAccordion = (instanceId, accordionId) => {
    setOpenAccordions((prevState) => {
      const isOpen = prevState[instanceId]?.includes(accordionId);
      let newOpenAccordions;
      if (isOpen) {
        newOpenAccordions = prevState[instanceId].filter(
          (id) => id !== accordionId
        );
      } else {
        newOpenAccordions = [...(prevState[instanceId] || []), accordionId];
      }
      return {
        ...prevState,
        [instanceId]: newOpenAccordions,
      };
    });
  };

  const courseInfo = course && course.length > 0 ? course[0] : null;
  const courseUrl = springShare && springShare.length > 0
    ? springShare[0].course_url
    : null;

    useEffect(() => {
      if (availability && Object.keys(availability).length > 0 && !collegeParam) {
        // Iterate through availability data to find the first reserve location
        let reserveLocation = null;
        for (const instanceId in availability) {
          const holdings = availability[instanceId]?.holdings || [];
          const firstReserveHolding = holdings.find((holding) =>
            holding.location && holding.location.includes('Reserve')
          );
          if (firstReserveHolding) {
            reserveLocation = firstReserveHolding.location;
            break; // Stop searching after finding the first reserve location
          }
        }
    
        // Get customization based on reserve location or default
        const newCustomization = useCustomizationStore.getState().getCustomizationByReserve(reserveLocation);
        setCustomization(newCustomization);
      } else if (collegeParam) {
        // If college param is present, use it for customization
        const newCustomization = useCustomizationStore.getState().getCustomization();
        setCustomization(newCustomization);
      }
    }, [availability, collegeParam]);

  // Pull the new custom fields from the store
  const {
    recordsCardTitleTextColor = customization.cardTextColor,
    recordsCardTextColor = customization.cardTextColor,
    recordsDiscoverLinkText = 'View in Discover Advanced',
    recordsDiscoverLinkBgColor = customization.buttonSecondaryColor,
    recordsDiscoverLinkBaseUrl = customization.discoverLinkBaseUrl,
    accordionHeaderBgColor = customization.buttonPrimaryColor,
    accordionHeaderTextColor = customization.cardTextColor,
    moodleLink = customization.moodleLink,
  } = customization;

  return (
    <div className="container mt-4">
      {courseInfo && (
        <div className="mb-3 d-flex align-items-center">
          <Button
            color="link"
            className="p-0 me-2"
            onClick={() => navigate(-1)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="currentColor"
              className="bi bi-arrow-left-circle"
              viewBox="0 0 16 16"
            >
              <path
                fillRule="evenodd"
                d="M8 15A7 7 0 1 1 8 .999a7 7 0 0 1 0 14.002ZM8 1.999A6 6 0 1 0 8 13.999a6 6 0 0 0 0-11.998Zm.146 3.646a.5.5 0 0 1 .708.708L6.707 
                  7.5H12.5a.5.5 0 1 1 0 
                  1H6.707l2.147 2.146a.5.5 0 0 
                  1-.708.708l-3-3a.5.5 0 0 
                  1 0-.708l3-3Z"
              />
            </svg>
          </Button>
          <h1 className="h4 mb-0">Back to results</h1>
        </div>
      )}

      {courseInfo && (
        <div className="course-info mb-4 container-fluid py-2">
          <h2 className="display-5 fw-bold">
            {courseInfo.courseNumber}: {courseInfo.name}
          </h2>
          {courseInfo.courseListingObject &&
            courseInfo.courseListingObject.instructorObjects && (
              <p className="col-md-8 fs-4">
                <strong>Instructors:</strong>{' '}
                {courseInfo.courseListingObject.instructorObjects
                  .map((instr) => instr.name)
                  .join(', ')}
              </p>
            )}
        </div>
      )}

      {courseUrl && (
        <Alert color="info">
          <h4>Electronic Reserves</h4>
          <p>
            PDFs of articles, E-Books, and other course readings are available
            through the
            <a href={courseUrl} target="_blank" rel="noopener noreferrer">
              {' '}
              {courseInfo.courseNumber}: {courseInfo.name}{' '}
            </a>
            course page or directly in your{' '}
            <a href={moodleLink} target="_blank" rel="noopener noreferrer">
              Moodle
            </a>
            course.
          </p>
          <p>
            To comply with copyright law, materials are only accessible to
            enrolled students for the duration of the course. Please log in with
            your institutional credentials if prompted.
          </p>
          <p>
            The U.S. Copyright Act (Title 17, U.S. Code) governs photocopying
            and other reproductions of copyrighted materials. “Fair use”
            generally limits use of these materials to private study,
            scholarship, or research.{' '}
            <a
              href="https://www.copyright.gov/fair-use/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more about copyright and fair use
            </a>
            .
          </p>
        </Alert>
      )}

      {isLoading ? (
        <div className="text-center">
          <Spinner color="primary" />
          <p className="mt-2">Loading records...</p>
        </div>
      ) : error ? (
        <Alert color="danger">{error}</Alert>
      ) : records && records.length > 0 ? (
        <Row className="g-4" style={{ alignItems: 'stretch' }}>
          <Col xs="12">
            <h2 id="print-resources">Print Reserves</h2>
            {records.map((recordItem) => {
              const { id, copiedItem } = recordItem;
              const {
                instanceId,
                title,
                contributors,
                publication,
                callNumber,
              } = copiedItem;

              const edsLink = instanceId.replace(/-/g, '.');
              const finalDiscoverUrl = `${recordsDiscoverLinkBaseUrl}${edsLink}`;
              const availabilityData = availability[instanceId];
              const holdings = availabilityData?.holdings || [];

              const reserves = holdings.filter((h) =>
                h.location.includes('Reserve')
              );
              const otherHoldings = holdings.filter(
                (h) => !h.location.includes('Reserve')
              );

              return (
                <Card
                  key={id}
                  className="mb-4 flex-grow-0 shadow-sm p-3 mb-5 bg-body-tertiary rounded"
                >
                  <CardBody>
                    <CardTitle
                      tag="h5"
                      style={{ color: recordsCardTitleTextColor }}
                    >
                      {title}
                    </CardTitle>
                    {contributors && contributors.length > 0 && (
                      <CardText style={{ color: recordsCardTextColor }}>
                        <strong>Authors:</strong>{' '}
                        {contributors
                          .map((contributor) => contributor.name)
                          .join(', ')}
                      </CardText>
                    )}
                    {callNumber && (
                      <CardText style={{ color: recordsCardTextColor }}>
                        <strong>Call Number:</strong> {callNumber}
                      </CardText>
                    )}
                    {publication && publication.length > 0 && (
                      <CardText style={{ color: recordsCardTextColor }}>
                        <strong>Publication:</strong>{' '}
                        {publication
                          .map((pub) => {
                            let parts = [];
                            if (pub.publisher) parts.push(pub.publisher);
                            if (pub.place) parts.push(pub.place);
                            if (pub.dateOfPublication)
                              parts.push(pub.dateOfPublication);
                            return parts.join('; ');
                          })
                          .join(' / ')}
                      </CardText>
                    )}
                    <div className="mb-3">
                      <a
                        className="btn justify-content-center"
                        style={{
                          backgroundColor: recordsDiscoverLinkBgColor,
                          color: '#fff',
                        }}
                        href={finalDiscoverUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {recordsDiscoverLinkText}{' '}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          fill="currentColor"
                          className="bi bi-box-arrow-up-right"
                          viewBox="0 0 16 16"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.636 3.5a.5.5 0 0 
                              0-.5-.5H1.5A1.5 1.5 0 0 
                              0 0 4.5v10A1.5 1.5 0 0 
                              0 1.5 16h10a1.5 1.5 0 0 
                              0 1.5-1.5V7.864a.5.5 0 0 
                              0-1 0V14.5a.5.5 0 0 
                              1-.5.5h-10a.5.5 0 0 
                              1-.5-.5v-10a.5.5 0 0 
                              1 .5-.5h6.636a.5.5 0 0 
                              0 .5-.5ZM16 .5a.5.5 0 0 
                              0-.5-.5h-5a.5.5 0 0 0 0 
                              1h3.793L6.146 9.146a.5.5 0 1 0 
                              .708.708L15 1.707V5.5a.5.5 0 0 
                              0 1 0V.5Z"
                          />
                        </svg>
                      </a>
                    </div>
                    {holdings.length > 0 ? (
                      <Accordion
                        flush
                        open={openAccordions[instanceId]}
                        toggle={(id) => toggleAccordion(instanceId, id)}
                      >
                        {reserves.length > 0 && (
                          <AccordionItem>
                            <AccordionHeader
                              targetId={`reserves-${instanceId}`}
                              style={{
                                backgroundColor: accordionHeaderBgColor,
                                color: accordionHeaderTextColor,
                              }}
                            >
                              Reserves
                            </AccordionHeader>
                            <AccordionBody
                              accordionId={`reserves-${instanceId}`}
                            >
                              <ListGroup className="mb-3">
                                {reserves.map((holding) => (
                                  <ListGroupItem key={holding.id}>
                                    <p>
                                      <strong>Location:</strong>{' '}
                                      {holding.location}
                                    </p>
                                    <p>
                                      <strong>Status:</strong> {holding.status}
                                    </p>
                                    <p>
                                      <strong>Temporary Loan Type:</strong>{' '}
                                      {holding.temporaryLoanType}
                                    </p>
                                    <p>
                                      <strong>Library:</strong>{' '}
                                      {holding.library.name}
                                    </p>
                                  </ListGroupItem>
                                ))}
                              </ListGroup>
                            </AccordionBody>
                          </AccordionItem>
                        )}
                        {otherHoldings.length > 0 && (
                          <AccordionItem>
                            <AccordionHeader
                              targetId={`holdings-${instanceId}`}
                              style={{
                                backgroundColor: accordionHeaderBgColor,
                                color: accordionHeaderTextColor,
                              }}
                            >
                              Other Holdings
                            </AccordionHeader>
                            <AccordionBody
                              accordionId={`holdings-${instanceId}`}
                            >
                              <ListGroup>
                                {otherHoldings.map((holding) => (
                                  <ListGroupItem key={holding.id}>
                                    <p>
                                      <strong>Location:</strong>{' '}
                                      {holding.location}
                                    </p>
                                    <p>
                                      <strong>Status:</strong> {holding.status}
                                    </p>
                                    <p>
                                      <strong>Permanent Loan Type:</strong>{' '}
                                      {holding.permanentLoanType}
                                    </p>
                                    <p>
                                      <strong>Library:</strong>{' '}
                                      {holding.library.name}
                                    </p>
                                  </ListGroupItem>
                                ))}
                              </ListGroup>
                            </AccordionBody>
                          </AccordionItem>
                        )}
                      </Accordion>
                    ) : (
                      <p>Loading availability...</p>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </Col>
        </Row>
      ) : (
        <p>No records found.</p>
      )}
    </div>
  );
}

export default CourseRecords;