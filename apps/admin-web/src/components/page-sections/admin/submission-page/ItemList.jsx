import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import useMutation from '../../../../hooks/admin/useMutation';
import { claimsApi } from '../../../../services/admin/workflowClaims/claimsApi';
import {
  countReadiness,
  filterNotReadyItems,
  filterSubmissionItems,
  getReadinessLabel,
  getReadinessStatus,
  getClaimBadge,
  isItemDone,
  READINESS_LABELS,
  READINESS_VARIANTS,
} from './submissionPageUtils';

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

function ItemFlowLine({ item }) {
  const flow = item.flow;
  const step = flow?.current_step_label;
  const state = isItemDone(item) || flow?.finish_state
    ? 'done'
    : step || 'not started';
  const parts = [item.materialType, flow?.name, state].filter(Boolean);

  return <span className="tw-block tw-truncate tw-text-sm tw-text-muted-foreground">{parts.join(' · ')}</span>;
}

ItemFlowLine.propTypes = { item: PropTypes.object.isRequired };

function ItemRow({ item, currentUser, selected, disabled, onSelect }) {
  const claim = getClaimBadge(item, currentUser);
  const readiness = getReadinessStatus(item);
  const readinessLabel = getReadinessLabel(readiness);

  return (
    <div
      className={`tw-flex tw-items-center tw-gap-2 tw-rounded-md tw-border tw-p-2 ${selected ? 'tw-border-primary tw-bg-accent' : 'tw-border-transparent'}`}
      data-item-row={item.id}
    >
      <Button
        type="button"
        variant="ghost"
        className="tw-h-auto tw-min-w-0 tw-flex-1 tw-justify-start tw-whitespace-normal tw-p-2 tw-text-left"
        aria-pressed={selected}
        aria-label={`Select ${item.title}`}
        aria-description={`Readiness: ${readinessLabel}${item.readinessReason ? `. ${item.readinessReason}` : ''}`}
        data-item-select={item.id}
        disabled={disabled}
        onClick={() => onSelect(item)}
      >
        <span className="tw-min-w-0 tw-flex-1">
          <span className="tw-block tw-truncate tw-font-medium">{item.title || 'Untitled item'}</span>
          <ItemFlowLine item={item} />
        </span>
      </Button>
      <div className="tw-flex tw-min-w-0 tw-max-w-28 tw-shrink-0 tw-flex-col tw-items-end tw-gap-1">
        <Badge variant={READINESS_VARIANTS[readiness]}>{readinessLabel}</Badge>
        <Badge variant={claim.variant} className="tw-max-w-full tw-whitespace-normal tw-break-words tw-text-center">
          {claim.label}
        </Badge>
      </div>
    </div>
  );
}

ItemRow.propTypes = {
  item: PropTypes.object.isRequired,
  currentUser: PropTypes.object,
  selected: PropTypes.bool.isRequired,
  disabled: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
};

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
    <section aria-label="Submission items" className="tw-min-w-0">
      <div className="tw-mb-3 tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2">
        <h2 className="tw-text-lg tw-font-semibold">Items</h2>
        <Button variant="outline" size="sm" onClick={handleClaimAll} disabled={disabled || pending || !items.length}>
          Claim all
        </Button>
      </div>
      <section aria-labelledby="readiness-summary-title" className="tw-mb-3 tw-rounded-md tw-border tw-bg-muted/20 tw-p-3">
        <h3 id="readiness-summary-title" className="tw-sr-only">Readiness summary</h3>
        <p className="tw-font-semibold">{readiness.ready} of {readiness.total} ready</p>
        <p className="tw-text-sm tw-text-muted-foreground">
          {Object.entries(READINESS_LABELS).map(([status, label]) => `${label}: ${readiness[status]}`).join(' · ')}
        </p>
      </section>
      <div className="tw-mb-3 tw-flex tw-flex-wrap tw-gap-2" role="group" aria-label="Filter items">
        {filters.map(({ id, label }) => {
          const count = id === 'all' ? items.length : filterSubmissionItems(items, id, currentUser).length;
          return (
            <Button
              key={id}
              type="button"
              variant={filter === id ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={filter === id}
              disabled={disabled}
              onClick={() => setFilter(id)}
            >
              {label} ({count})
            </Button>
          );
        })}
      </div>
      <div className="tw-mb-3 tw-flex tw-flex-wrap tw-gap-2" role="group" aria-label="Filter by readiness">
        <Button
          type="button"
          variant={notReadyOnly ? 'secondary' : 'outline'}
          size="sm"
          aria-pressed={notReadyOnly}
          disabled={disabled}
          onClick={() => setNotReadyOnly((current) => !current)}
        >
          Not ready ({readiness.missing + readiness.unknown})
        </Button>
      </div>
      {error && <p role="alert" className="tw-mb-3 tw-text-sm tw-text-destructive">{error}</p>}
      {claimAllResult && <p role="status" className="tw-mb-3 tw-text-sm">{claimAllMessage(claimAllResult)}</p>}
      <div className="tw-space-y-4">
        {groups.map((group) => {
          const groupItems = group.items.filter((item) => visibleKeys.has(`${item.kind}/${item.id}`));
          if (!groupItems.length) return null;
          return (
            <section key={group.name} aria-label={group.name} data-item-group={group.name}>
              <h3 className="tw-mb-2 tw-text-sm tw-font-semibold tw-text-muted-foreground">{group.name}</h3>
              <div className="tw-space-y-1">
                {groupItems.map((item) => (
                  <ItemRow
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
        {!visibleItems.length && <p className="tw-text-sm tw-text-muted-foreground">No items match this filter.</p>}
      </div>
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
