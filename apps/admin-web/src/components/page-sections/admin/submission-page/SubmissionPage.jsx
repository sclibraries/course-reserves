import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useSearchParams } from 'react-router-dom';
import ItemList from './ItemList';
import SubmissionPageHeader from './SubmissionPageHeader';
import WorkPane from './WorkPane';
import {
  buildSubmissionItemGroups,
  countSubmissionItems,
  isItemDone,
} from './submissionPageUtils';

function SubmissionPage({
  submission,
  folders,
  unfolderedItems,
  currentUser,
  onBack,
  onLock,
  onUnlock,
  onChanged,
  linking,
  unlinkedContent,
  renderSelectedItem,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isLinked = submission.linkState === 'linked';
  const groups = useMemo(
    () => buildSubmissionItemGroups(folders, unfolderedItems, submission),
    [folders, submission, unfolderedItems],
  );
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const counts = useMemo(() => countSubmissionItems(items), [items]);
  const selectedItem = items.find((item) => String(item.id) === searchParams.get('item'))
    || items.find((item) => !isItemDone(item))
    || null;
  const selectedItemId = selectedItem?.id;
  const [mobilePaneOpen, setMobilePaneOpen] = useState(
    () => !isLinked || Boolean(searchParams.get('item')),
  );

  useEffect(() => {
    const nextId = selectedItemId == null ? null : String(selectedItemId);
    const currentId = searchParams.get('item');
    if (nextId === currentId) return;

    const nextParams = new URLSearchParams(searchParams);
    if (nextId) nextParams.set('item', nextId);
    else nextParams.delete('item');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, selectedItemId, setSearchParams]);

  const handleSelect = (item) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('item', String(item.id));
    setSearchParams(nextParams);
    setMobilePaneOpen(true);
  };

  return (
    <div>
      <SubmissionPageHeader
        submission={submission}
        counts={counts}
        isLinked={isLinked}
        onBack={onBack}
        onLock={onLock}
        onUnlock={onUnlock}
        linking={linking}
      />
      <div className="tw-grid tw-grid-cols-1 tw-gap-4 lg:tw-grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <aside
          className={`tw-min-w-0 ${isLinked && mobilePaneOpen ? 'tw-hidden lg:tw-block' : ''} ${isLinked ? '' : 'tw-pointer-events-none tw-rounded-lg tw-bg-muted/30 tw-p-2 tw-saturate-50'}`}
          data-testid="submission-item-list-pane"
        >
          <ItemList
            groups={groups}
            submission={submission}
            currentUser={currentUser}
            selectedItemId={selectedItem?.id}
            disabled={!isLinked}
            onSelect={handleSelect}
            onChanged={onChanged}
          />
        </aside>
        <div className={`tw-min-w-0 ${isLinked && !mobilePaneOpen ? 'tw-hidden lg:tw-block' : ''}`}>
          <WorkPane
            isLinked={isLinked}
            selectedItem={selectedItem}
            onBack={() => setMobilePaneOpen(false)}
            unlinkedContent={unlinkedContent}
          >
            {selectedItem && renderSelectedItem?.(selectedItem)}
          </WorkPane>
        </div>
      </div>
    </div>
  );
}

SubmissionPage.propTypes = {
  submission: PropTypes.object.isRequired,
  folders: PropTypes.arrayOf(PropTypes.object).isRequired,
  unfolderedItems: PropTypes.arrayOf(PropTypes.object).isRequired,
  currentUser: PropTypes.object,
  onBack: PropTypes.func.isRequired,
  onLock: PropTypes.func.isRequired,
  onUnlock: PropTypes.func.isRequired,
  onChanged: PropTypes.func,
  linking: PropTypes.object.isRequired,
  unlinkedContent: PropTypes.node,
  renderSelectedItem: PropTypes.func,
};

export default SubmissionPage;
