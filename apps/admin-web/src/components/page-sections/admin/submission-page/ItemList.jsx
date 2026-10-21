import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import useItemFlow from '../../../../hooks/admin/useItemFlow';
import useMutation from '../../../../hooks/admin/useMutation';
import { claimsApi } from '../../../../services/admin/workflowClaims/claimsApi';
import {
  countSubmissionItems,
  filterSubmissionItems,
  getClaimBadge,
  isItemDone,
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
  const flow = useItemFlow({ item });
  const flowName = flow.flowState?.flow?.name;
  const step = flow.flowState?.current_step?.step?.label || item.current_step_label;
  const state = isItemDone(item) || flow.flowState?.finished
    ? 'done'
    : flow.loading ? 'Loading workflow…' : step || 'not started';
  const parts = [item.material_type || item.materialType, flowName, state].filter(Boolean);

  return <span className="tw-block tw-truncate tw-text-sm tw-text-muted-foreground">{parts.join(' · ')}</span>;
}

ItemFlowLine.propTypes = { item: PropTypes.object.isRequired };

function ItemRow({ item, currentUser, selected, disabled, onSelect }) {
  const claim = getClaimBadge(item, currentUser);

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
        data-item-select={item.id}
        disabled={disabled}
        onClick={() => onSelect(item)}
      >
        <span className="tw-min-w-0 tw-flex-1">
          <span className="tw-block tw-truncate tw-font-medium">{item.title || 'Untitled item'}</span>
          <ItemFlowLine item={item} />
        </span>
      </Button>
      <Badge variant={claim.variant} className="tw-shrink-0">{claim.label}</Badge>
    </div>
  );
}

ItemRow.propTypes = {
  item: PropTypes.object.isRequired,
  currentUser: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  selected: PropTypes.bool.isRequired,
  disabled: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
};

function ItemList({ groups, submission, currentUser, selectedItemId, disabled = false, onSelect, onChanged }) {
  const [filter, setFilter] = useState('all');
  const [claimAllResult, setClaimAllResult] = useState(null);
  const { pending, error, run } = useMutation();
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const counts = useMemo(() => countSubmissionItems(items), [items]);
  const visibleItems = useMemo(
    () => filterSubmissionItems(items, filter, currentUser),
    [currentUser, filter, items],
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
  currentUser: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  selectedItemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  disabled: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onChanged: PropTypes.func,
};

export default ItemList;
