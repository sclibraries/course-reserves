import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SyllabusSourceForm({ source, setSource, googleDocUrl, setGoogleDocUrl, file, setFile, busy, onExtract }) {
  return (
    <section className="tw-rounded-lg tw-border tw-bg-card tw-p-5">
      <h2 className="tw-mb-3 tw-text-lg tw-font-semibold">Syllabus source</h2>
      <div className="tw-mb-5 tw-flex tw-flex-wrap tw-gap-2" aria-label="Choose syllabus source">
        <Button type="button" variant={source === 'google' ? 'default' : 'outline'} onClick={() => setSource('google')}>
          Google Doc link
        </Button>
        <Button type="button" variant={source === 'file' ? 'default' : 'outline'} onClick={() => setSource('file')}>
          Upload PDF or DOCX
        </Button>
      </div>
      {source === 'google' ? (
        <div key="google-doc" className="tw-grid tw-gap-2">
          <Label htmlFor="google-doc-url">Google Doc URL</Label>
          <Input id="google-doc-url" type="url" value={googleDocUrl} onChange={(event) => setGoogleDocUrl(event.target.value)} required />
          <p className="tw-text-sm tw-text-muted-foreground">Use a Google Doc shared with the library’s configured service account.</p>
        </div>
      ) : (
        <div key="file-upload" className="tw-grid tw-gap-2">
          <Label htmlFor="syllabus-file">PDF or DOCX file</Label>
          <Input id="syllabus-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          {file && <p className="tw-break-all tw-text-sm tw-text-muted-foreground">Selected: {file.name}</p>}
        </div>
      )}
      <div className="tw-mt-5">
        <Button type="button" onClick={onExtract} disabled={busy || (source === 'google' ? !googleDocUrl.trim() : !file)}>
          {busy ? 'Reading syllabus…' : 'Extract and find matches'}
        </Button>
      </div>
    </section>
  );
}

SyllabusSourceForm.propTypes = {
  source: PropTypes.oneOf(['google', 'file']).isRequired,
  setSource: PropTypes.func.isRequired,
  googleDocUrl: PropTypes.string.isRequired,
  setGoogleDocUrl: PropTypes.func.isRequired,
  file: PropTypes.shape({ name: PropTypes.string }),
  setFile: PropTypes.func.isRequired,
  busy: PropTypes.bool.isRequired,
  onExtract: PropTypes.func.isRequired,
};
