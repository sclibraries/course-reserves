import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SyllabusRequestLauncher({ courseListingId }) {
  return (
    <Button asChild variant="outline" className="tw-w-full tw-justify-start">
      <Link to={`/admin/electronic/${encodeURIComponent(courseListingId)}/syllabus-request`}>
        <FileText aria-hidden="true" />
        Start a request from a syllabus
      </Link>
    </Button>
  );
}

SyllabusRequestLauncher.propTypes = { courseListingId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired };
