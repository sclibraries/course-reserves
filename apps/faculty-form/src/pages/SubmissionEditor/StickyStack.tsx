import { STICKY_LAYERS } from '@/constants/stickyLayers';
import { useSubmissionEditorContext } from './SubmissionEditorContext';
import ActionBar from './ActionBar';
import Header from './Header';

export default function StickyStack() {
  const { isReadOnly } = useSubmissionEditorContext();

  return (
    <div
      className="sticky top-0"
      data-testid="submission-editor-sticky-stack"
      style={{ zIndex: STICKY_LAYERS.submissionEditor }}
    >
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <fieldset disabled={isReadOnly} className="border-0 p-0 m-0 min-w-0 disabled:opacity-70">
          <ActionBar />
        </fieldset>
      </div>
    </div>
  );
}
