import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from '../../../ui/button';
import useMutation from '../../../../hooks/admin/useMutation';
import { claimsApi } from '../../../../services/admin/workflowClaims/claimsApi';
import {
  countReadiness,
  filterNotReadyItems,
  filterSubmissionItems,
} from './submissionPageUtils';
import ReadinessLegend from './ReadinessLegend';
import SubmissionItemRow from './SubmissionItemRow';

const filters = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
  { id: 'unclaimed', label: 'Unclaimed' },
  { id: 'done', label: 'Done' },
];

function claimAllMessage(result) {
  const claimed = result.claimed || [];
  const skipped = result.skipped || [];
  const skippedBy = skipped.map((item) => item.claimed_by_display).filter(Boolean);
  return `Claimed ${claimed.length} item${claimed.length === 1 ? '' : 's'}. Skipped ${skipped.length} item${skipped.length === 1 ? '' : 's'}${skippedBy.length ? ` (${skippedBy.join(', ')})` : ''}.`;
}

function ItemList({ groups, submission, currentUser, selectedItemId, disabled = false, onSelect, onChanged }) {
  const [filter, setFilter] = useState('all');
  const [notReadyOnly, setNotReadyOnly] = useState(false);
  const [claimAllResult, setClaimAllResult] = useState(null);
  const { pending, error, run } = useMutation();
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const readiness = useMemo(() => countReadiness(items), [items]);
  const readinessFilteredItems = useMemo(
    () => (notReadyOnly ? filterNotReadyItems(items) : items),
    [items, notReadyOnly],
  );
  const visibleItems = useMemo(
    () => filterSubmissionItems(readinessFilteredItems, filter, currentUser),
    [currentUser, filter, readinessFilteredItems],
  );
  const visibleKeys = useMemo(() => new Set(visibleItems.map((item) => `${item.kind}/${item.id}`)), [visibleItems]);

  const handleClaimAll = async () => {
    setClaimAllResult(null);
    await run(() => claimsApi.claimAllItems(submission.uuid), {
      reload: onChanged,
      onSuccess: setClaimAllResult,
    });
  };

  return (
    <section
      aria-label="Submission items"
      className="tw-flex tw-min-w-0 tw-flex-col tw-rounded-lg tw-border tw-bg-card"
    >
      <header className="tw-space-y-2 tw-border-b tw-p-3">
        <div className="tw-flex tw-items-baseline tw-justify-between tw-gap-2">
          <h2 className="tw-text-base tw-font-semibold">Items</h2>
          <p className="tw-whitespace-nowrap tw-text-xs tw-text-muted-foreground" aria-label="Readiness count">
            {readiness.ready}/{readiness.total} ready
          </p>
        </div>
        <div role="group" aria-label="Filter items" className="tw-flex tw-flex-wrap tw-gap-1.5">
          {filters.map(({ id, label }) => {
            const count = id === 'all' ? items.length : filterSubmissionItems(items, id, currentUser).length;
            return (
              <Button
                key={id}
                type="button"
                variant={filter === id ? 'secondary' : 'outline'}
                size="sm"
                className="tw-h-8 tw-px-2 tw-text-xs"
                aria-pressed={filter === id}
                disabled={disabled}
                onClick={() => setFilter(id)}
              >
                {label} ({count})
              </Button>
            );
          })}
          <Button
            type="button"
            variant={notReadyOnly ? 'secondary' : 'outline'}
            size="sm"
            className="tw-h-8 tw-px-2 tw-text-xs"
            aria-pressed={notReadyOnly}
            disabled={disabled}
            onClick={() => setNotReadyOnly((current) => !current)}
          >
            Not ready ({readiness.missing + readiness.unknown})
          </Button>
        </div>
      </header>

      {error && <p role="alert" className="tw-px-3 tw-pt-2 tw-text-sm tw-text-destructive">{error}</p>}
      {claimAllResult && <p role="status" className="tw-px-3 tw-pt-2 tw-text-sm">{claimAllMessage(claimAllResult)}</p>}
      <div className="tw-min-w-0 tw-space-y-3 tw-p-2">
        {groups.map((group) => {
          const groupItems = group.items.filter((item) => visibleKeys.has(`${item.kind}/${item.id}`));
          if (!groupItems.length) return null;
          return (
            <section key={group.name} aria-label={group.name} data-item-group={group.name}>
              <h3 className="tw-mb-1 tw-rounded-sm tw-bg-muted/30 tw-px-2 tw-py-1 tw-text-xs tw-font-semibold tw-text-muted-foreground">
                {group.name}
              </h3>
              <div className="tw-space-y-1">
                {groupItems.map((item) => (
                  <SubmissionItemRow
                    key={`${item.kind}/${item.id}`}
                    item={item}
                    currentUser={currentUser}
                    selected={String(item.id) === String(selectedItemId)}
                    disabled={disabled}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {!visibleItems.length && <p className="tw-p-2 tw-text-sm tw-text-muted-foreground">No items match this filter.</p>}
      </div>

      <footer className="tw-mt-auto tw-space-y-3 tw-border-t tw-p-3">
        <ReadinessLegend />
        <Button variant="outline" size="sm" className="tw-w-full" onClick={handleClaimAll} disabled={disabled || pending || !items.length}>
          Claim all
        </Button>
      </footer>
    </section>
  );
}

ItemList.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string, items: PropTypes.arrayOf(PropTypes.object) })).isRequired,
  submission: PropTypes.object.isRequired,
  currentUser: PropTypes.object,
  selectedItemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  disabled: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onChanged: PropTypes.func,
};

export default ItemList;
