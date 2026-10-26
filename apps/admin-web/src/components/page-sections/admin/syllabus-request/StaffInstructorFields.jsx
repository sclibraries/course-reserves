import PropTypes from 'prop-types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function StaffInstructorFields({ course, instructorName, setInstructorName, instructorUsername, setInstructorUsername }) {
  const instructors = course.courseListingObject?.instructorObjects || [];
  return (
    <section className="tw-grid tw-gap-4 tw-rounded-lg tw-border tw-bg-card tw-p-5" aria-labelledby="instructor-heading">
      <div>
        <h2 id="instructor-heading" className="tw-text-lg tw-font-semibold">Instructor</h2>
        <p className="tw-mt-1 tw-text-sm tw-text-muted-foreground">Choose a listed instructor or enter another name, then add their Smith username.</p>
      </div>
      <div className="tw-grid tw-gap-2">
        <Label htmlFor="instructor-name">Instructor name</Label>
        <Input id="instructor-name" value={instructorName} onChange={(event) => setInstructorName(event.target.value)} required />
        {instructors.length > 0 && (
          <div className="tw-flex tw-flex-wrap tw-gap-2" aria-label="Listed instructors">
            {instructors.map((instructor) => (
              <button key={instructor.name} className="tw-rounded-full tw-border tw-px-3 tw-py-1 tw-text-sm hover:tw-bg-muted focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring" type="button" onClick={() => setInstructorName(instructor.name)}>
                Use {instructor.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="tw-grid tw-gap-2">
        <Label htmlFor="smith-username">Smith username</Label>
        <Input id="smith-username" value={instructorUsername} onChange={(event) => setInstructorUsername(event.target.value)} aria-describedby="smith-username-hint" autoComplete="username" required />
        <p id="smith-username-hint" className="tw-text-sm tw-text-muted-foreground">Enter the instructor’s Smith username, the part before @smith.edu.</p>
      </div>
    </section>
  );
}

StaffInstructorFields.propTypes = {
  course: PropTypes.shape({
    courseListingObject: PropTypes.shape({
      instructorObjects: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string })),
    }),
  }).isRequired,
  instructorName: PropTypes.string.isRequired,
  setInstructorName: PropTypes.func.isRequired,
  instructorUsername: PropTypes.string.isRequired,
  setInstructorUsername: PropTypes.func.isRequired,
};
