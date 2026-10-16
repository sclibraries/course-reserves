import PropTypes from 'prop-types';
import { Card, CardBody, Button, Badge, Spinner } from 'reactstrap';
import { FaBook } from 'react-icons/fa';

export const courseMatchesSubmissionTerm = (course, submission) => {
  const submissionTerm = submission?.term;
  if (!submissionTerm) return true;

  const courseListing = course?.courseListingObject || {};
  const termObject = courseListing.termObject || {};
  const courseTerms = [
    courseListing.termId,
    termObject.id,
    termObject.name,
    termObject.code,
  ].filter(Boolean);

  return courseTerms.includes(submissionTerm);
};

/**
 * CourseVerificationCard - Gate component for linking FOLIO courses
 */
const CourseVerificationCard = ({ 
  submission, 
  onSearch, 
  onVerify, 
  searchResults, 
  isSearching, 
  searchQuery, 
  setSearchQuery,
  verifyingCourseId 
}) => {
  // Filter courses to only show those matching the submitted term
  const filteredCourses = searchResults?.courses?.filter(course => courseMatchesSubmissionTerm(course, submission)) || [];
  return (
    <Card className="mb-4 shadow-sm border-warning">
      <CardBody className="py-5">
        <div className="text-center mb-4">
          <div className="mb-3 text-warning">
            <FaBook size="3em" />
          </div>
          <h3 className="mb-2">Course Verification Required</h3>
          <p className="text-muted" style={{ maxWidth: '600px', margin: '0 auto' }}>
            This submission (<strong>{submission.courseCode}</strong>) is not yet linked to a valid FOLIO course offering. 
            Search for the course in FOLIO to link it and unlock the workflow.
          </p>
        </div>
        
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Search Bar */}
          <div className="d-flex gap-2 mb-4">
            <div className="flex-grow-1">
              <input 
                type="text" 
                className="form-control form-control-lg" 
                placeholder="Search by Course Name or Number (e.g. ENG 100)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              />
            </div>
            <Button 
              color="primary" 
              size="lg"
              onClick={() => onSearch()}
              disabled={isSearching || !searchQuery.trim()}
              style={{ minWidth: '120px' }}
            >
              {isSearching ? <Spinner size="sm" /> : 'Search'}
            </Button>
          </div>

          {/* Results Table */}
          {searchResults?.courses?.length > 0 && (
            <>
              {filteredCourses.length === 0 && (
                <div className="alert alert-warning" role="alert">
                  No courses found matching the submitted term: <strong>{submission.term}</strong>
                </div>
              )}
              {filteredCourses.length > 0 && (
                <div className="table-responsive border rounded">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Course Name</th>
                        <th>Course Code</th>
                        <th>Term</th>
                        <th className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCourses.map(course => {
                        const isThisCourseVerifying = verifyingCourseId === course.id;
                        return (
                          <tr key={course.id}>
                            <td className="fw-bold">{course.name}</td>
                            <td>
                              {course.courseNumber}
                              {course.sectionName && <span className="text-muted ms-1">- {course.sectionName}</span>}
                            </td>
                            <td>
                              <Badge color="info" pill>
                                {course.courseListingObject?.termObject?.name || 'No Term'}
                              </Badge>
                            </td>
                            <td className="text-end">
                              <Button 
                                color="success" 
                                size="sm"
                                onClick={() => onVerify(course)}
                                disabled={verifyingCourseId !== null}
                              >
                                {isThisCourseVerifying ? 'Linking...' : 'Select & Link'}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

CourseVerificationCard.propTypes = {
  submission: PropTypes.object.isRequired,
  onSearch: PropTypes.func.isRequired,
  onVerify: PropTypes.func.isRequired,
  searchResults: PropTypes.array.isRequired,
  isSearching: PropTypes.bool.isRequired,
  searchQuery: PropTypes.string.isRequired,
  setSearchQuery: PropTypes.func.isRequired,
  verifyingCourseId: PropTypes.string
};

export default CourseVerificationCard;
