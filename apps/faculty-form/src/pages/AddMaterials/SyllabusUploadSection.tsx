import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSyllabusUpload } from '@/hooks/useSyllabusUpload';
import { useSubmissionEditorContext } from '@/pages/SubmissionEditor/SubmissionEditorContext';

const errorId = 'syllabus-upload-error';

interface SyllabusUploadSectionProps {
  onReviewText: (text: string) => void;
}

export default function SyllabusUploadSection({ onReviewText }: SyllabusUploadSectionProps) {
  const { id, reserve, ensureServerUuid, isReadOnly } = useSubmissionEditorContext();
  const [googleDocUrl, setGoogleDocUrl] = useState('');
  const upload = useSyllabusUpload({
    reserveId: id,
    submissionUuid: reserve.submissionUuid || undefined,
    ensureServerUuid,
    onReview: onReviewText,
  });

  return (
    <section aria-label="Add a syllabus" className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="text-lg font-semibold">Add a syllabus</h2>
        <p className="mt-1 text-sm text-muted-foreground">Add a Google Doc or upload a PDF or DOCX.</p>
      </div>

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="syllabus-google-doc-url">Google Docs link</Label>
          <Input
            id="syllabus-google-doc-url"
            type="url"
            value={googleDocUrl}
            onChange={(event) => setGoogleDocUrl(event.target.value)}
            placeholder="https://docs.google.com/document/d/…"
            aria-describedby={upload.error ? `syllabus-google-doc-help ${errorId}` : 'syllabus-google-doc-help'}
            disabled={isReadOnly || upload.isReading}
          />
          <p id="syllabus-google-doc-help" className="text-xs text-muted-foreground">
            Set General access to “Anyone with the link” as Viewer.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => upload.attachGoogleDoc(googleDocUrl)}
          disabled={isReadOnly || upload.isReading || !googleDocUrl.trim()}
        >
          Attach Google Doc
        </Button>
      </div>

      <div className="max-w-full space-y-2">
        <Label htmlFor="syllabus-file">Upload a PDF or DOCX</Label>
        <Input
          id="syllabus-file"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          aria-describedby={upload.error ? errorId : undefined}
          disabled={isReadOnly || upload.isReading}
          onChange={(event) => {
            void upload.attachFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
      </div>

      {upload.isReading && <p role="status" className="text-sm text-muted-foreground">Reading your syllabus…</p>}
      {upload.error && <p id={errorId} role="alert" className="break-words rounded-md bg-destructive/10 p-3 text-sm text-destructive">{upload.error}</p>}

      {upload.syllabi.length > 0 && (
        <ul aria-label="Attached syllabi" className="space-y-2 border-t pt-3">
          {upload.syllabi.map((syllabus) => {
            const name = syllabus.source === 'google_doc' ? 'Google Doc' : syllabus.original_filename;
            return (
              <li key={syllabus.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words text-sm">{name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Review citations from ${name}`}
                  onClick={() => upload.reviewSyllabus(syllabus)}
                >
                  Review citations
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
