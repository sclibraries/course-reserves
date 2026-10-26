import { useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, AlertDescription } from '../../../ui/alert';
import { Button } from '../../../ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../../ui/sheet';
import useSubmissionSyllabi from '../../../../hooks/admin/useSubmissionSyllabi';
import {
  getSubmissionSyllabusError,
  submissionSyllabiService,
} from '../../../../services/admin/submissionSyllabiService';

function formatFileSize(byteSize) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = byteSize;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${Number(size.toFixed(1))} ${units[unit]}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function SyllabusEntry({ syllabus, onDownload, downloading }) {
  const isGoogleDoc = syllabus.source === 'google_doc';

  return (
    <article className="tw-min-w-0 tw-rounded-md tw-border tw-p-4">
      <h3 className="tw-break-words tw-font-medium">
        {isGoogleDoc ? 'Google Doc' : syllabus.original_filename}
      </h3>
      <dl className="tw-mt-2 tw-space-y-2 tw-text-sm">
        <div>
          <dt className="tw-inline tw-font-medium">Source: </dt>
          <dd className="tw-inline">
            {isGoogleDoc ? (
              <a href={syllabus.source_url} target="_blank" rel="noopener noreferrer" className="tw-break-words tw-underline">
                Google Doc
              </a>
            ) : (
              <>Uploaded file · {formatFileSize(syllabus.byte_size)}</>
            )}
          </dd>
        </div>
        <div>
          <dt className="tw-sr-only">Added</dt>
          <dd>
            Added by {syllabus.added_by} ({syllabus.added_by_role}) on{' '}
            <time dateTime={syllabus.created_at}>{new Date(syllabus.created_at).toLocaleDateString()}</time>
          </dd>
        </div>
      </dl>
      {!isGoogleDoc && (
        <div className="tw-mt-3 tw-flex tw-flex-wrap tw-items-center tw-gap-3">
          <Button variant="outline" size="sm" disabled={Boolean(downloading)} onClick={() => onDownload(syllabus)}>
            Open original
          </Button>
          {downloading && <p role="status" className="tw-text-sm tw-text-muted-foreground">Downloading {syllabus.original_filename}…</p>}
        </div>
      )}
      <details className="tw-mt-3 tw-min-w-0 tw-text-sm">
        <summary className="tw-cursor-pointer tw-underline">Extracted text</summary>
        <p className="tw-mt-2 tw-break-words tw-whitespace-pre-wrap">{syllabus.extracted_text || 'No extracted text available.'}</p>
      </details>
    </article>
  );
}

SyllabusEntry.propTypes = {
  syllabus: PropTypes.object.isRequired,
  onDownload: PropTypes.func.isRequired,
  downloading: PropTypes.bool,
};

function SubmissionSyllabusSheet({ submissionId }) {
  const { syllabi, error: loadError } = useSubmissionSyllabi(submissionId);
  const [open, setOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState('');

  const downloadOriginal = async (syllabus) => {
    setDownloadingId(syllabus.id);
    setDownloadError('');
    try {
      const file = await submissionSyllabiService.downloadOriginal(submissionId, syllabus.id);
      downloadBlob(file, syllabus.original_filename);
    } catch (error) {
      setDownloadError(getSubmissionSyllabusError(error, 'download'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      {syllabi.length > 0 && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="link"
              className="tw-h-auto tw-p-0"
              aria-label={`Syllabus, ${syllabi.length} ${syllabi.length === 1 ? 'syllabus' : 'syllabi'}`}
            >
              Syllabus <span aria-hidden="true">({syllabi.length})</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="tw-h-dvh tw-w-full tw-overflow-y-auto tw-break-words sm:tw-max-w-xl">
            <SheetHeader>
              <SheetTitle>Submission syllabi</SheetTitle>
              <SheetDescription>Original sources and text extracted from each attached syllabus.</SheetDescription>
            </SheetHeader>
            <div className="tw-mt-6 tw-space-y-4">
              {downloadError && (
                <Alert variant="destructive" className="tw-break-words">
                  <AlertDescription>{downloadError}</AlertDescription>
                </Alert>
              )}
              {syllabi.map((syllabus) => (
                <SyllabusEntry
                  key={syllabus.id}
                  syllabus={syllabus}
                  onDownload={downloadOriginal}
                  downloading={downloadingId === syllabus.id}
                />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
      {loadError && <p role="alert" className="tw-max-w-full tw-break-words tw-text-sm tw-text-destructive">{loadError}</p>}
    </>
  );
}

SubmissionSyllabusSheet.propTypes = { submissionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired };

export default SubmissionSyllabusSheet;
