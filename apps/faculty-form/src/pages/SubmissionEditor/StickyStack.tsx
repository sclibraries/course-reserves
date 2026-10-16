import { useSubmissionEditorContext } from './SubmissionEditorContext';
import ActionBar from './ActionBar';
import Header from './Header';
import StickyTop from '@/components/StickyTop';

export default function StickyStack() {
  const { isReadOnly } = useSubmissionEditorContext();

  return (
    <StickyTop
      header={<Header />}
      toolbar={(
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <fieldset disabled={isReadOnly} className="border-0 p-0 m-0 min-w-0 disabled:opacity-70">
            <ActionBar />
          </fieldset>
        </div>
      )}
    />
  );
}
