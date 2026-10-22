import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  courseCode: string;
  courseTitle: string;
  section: string;
  term: string;
  isReadOnly: boolean;
  onEditCourse: () => void;
}

export default function CourseTitleRow({ courseCode, courseTitle, section, term, isReadOnly, onEditCourse }: Props) {
  return (
    <div className="mb-6 pb-4 border-b">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <h2 className="break-words text-xl font-semibold">{courseCode} · {courseTitle}</h2>
          <p className="mt-1 break-words text-sm text-muted-foreground">Section {section} · {term}</p>
        </div>
        <Button className="shrink-0" variant="outline" size="sm" onClick={onEditCourse} disabled={isReadOnly}>
          <Edit className="mr-2 h-3 w-3" />Edit Course Info
        </Button>
      </div>
    </div>
  );
}
