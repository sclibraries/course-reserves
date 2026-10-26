import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { fetchCourseData } from '../components/page-sections/course-record/api';
import StaffInstructorFields from '../components/page-sections/admin/syllabus-request/StaffInstructorFields';
import SyllabusEntryReview from '../components/page-sections/admin/syllabus-request/SyllabusEntryReview';
import SyllabusSourceForm from '../components/page-sections/admin/syllabus-request/SyllabusSourceForm';
import { useStaffSyllabusRequest } from '../hooks/admin/useStaffSyllabusRequest';

export default function StaffSyllabusRequestPage() {
  const { folioCourseId } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    fetchCourseData(folioCourseId)
      .then((courses) => {
        if (!active) return;
        const match = courses.find((item) => String(item.courseListingId) === folioCourseId) || courses[0];
        if (!match) throw new Error('Course details were not found. Return to the course list and try again.');
        setCourse(match);
      })
      .catch((error) => active && setLoadError(error.message || 'Could not load this course.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [folioCourseId]);

  if (loading) return <main className="tw-mx-auto tw-max-w-4xl tw-p-6" role="status">Loading course details…</main>;
  if (loadError) return <main className="tw-mx-auto tw-max-w-4xl tw-p-6"><p role="alert">{loadError}</p><BackToCourse courseId={folioCourseId} /></main>;
  return <LoadedRequestPage course={course} courseId={folioCourseId} />;
}

function LoadedRequestPage({ course, courseId }) {
  const request = useStaffSyllabusRequest(course);
  return (
    <main className="tw-mx-auto tw-grid tw-min-w-0 tw-max-w-4xl tw-gap-6 tw-p-4 sm:tw-p-6">
      <header className="tw-grid tw-min-w-0 tw-gap-3">
        <BackToCourse courseId={courseId} />
        <div>
          <p className="tw-break-words tw-text-sm tw-text-muted-foreground">{course.courseNumber} · {course.name}</p>
          <h1 className="tw-break-words tw-text-2xl tw-font-bold">Start a request from a syllabus</h1>
        </div>
      </header>
      {request.error && <p role="alert" className="tw-break-words tw-rounded-md tw-border tw-border-destructive tw-p-3 tw-text-destructive">{request.error}</p>}
      {request.progress && <p role="status" aria-live="polite" className="tw-text-sm tw-text-muted-foreground">{request.progress}</p>}
      <SyllabusSourceForm {...request} onExtract={request.extractAndSearch} />
      {request.groups.length > 0 && (
        <>
          <SyllabusEntryReview groups={request.groups} decisions={request.decisions} onChoose={request.choose} />
          <StaffInstructorFields course={course} {...request} />
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3">
            <Button type="button" onClick={request.submit} disabled={!request.canSubmit}>Create request</Button>
            {!request.canSubmit && (
              <p className="tw-text-sm tw-text-muted-foreground">
                {request.entriesResolved && !request.hasIncludedEntries
                  ? 'Keep at least one syllabus entry to create a request.'
                  : 'Resolve each entry and provide the instructor name and Smith username.'}
              </p>
            )}
            {request.submissionId && <Link className="tw-break-all tw-text-sm tw-font-medium tw-text-primary tw-underline" to={`/admin/submissions/${request.submissionId}`}>Open staff submission</Link>}
          </div>
        </>
      )}
    </main>
  );
}

function BackToCourse({ courseId }) {
  return (
    <Button asChild variant="ghost" className="tw-w-fit tw-justify-start tw-px-0">
      <Link to={`/admin/electronic/${encodeURIComponent(courseId)}`}><ArrowLeft aria-hidden="true" />Back to course</Link>
    </Button>
  );
}

LoadedRequestPage.propTypes = {
  course: PropTypes.shape({
    courseListingObject: PropTypes.shape({ termObject: PropTypes.shape({ name: PropTypes.string }) }),
    courseNumber: PropTypes.string,
    name: PropTypes.string,
  }).isRequired,
  courseId: PropTypes.string.isRequired,
};

BackToCourse.propTypes = { courseId: PropTypes.string.isRequired };
