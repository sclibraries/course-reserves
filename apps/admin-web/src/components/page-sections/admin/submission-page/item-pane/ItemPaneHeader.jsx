import PropTypes from 'prop-types';
import { ExternalLink } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { getClaimBadge } from '../submissionPageUtils';
import { getHttpUrl } from './itemPaneUtils';

function ItemPaneHeader({ item, currentUsername, claims }) {
  const claim = getClaimBadge(item, { username: currentUsername });
  const recordUrl = item.eds ? getHttpUrl(item.eds.plink) : null;
  const summary = [item.authors, item.publicationYear].filter(Boolean).join(' · ');

  return (
    <header className="tw-space-y-3 tw-border-b tw-pb-4">
      <div className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-start tw-justify-between tw-gap-3">
        <div className="tw-min-w-0 tw-space-y-2">
          <h2 className="tw-break-words tw-text-xl tw-font-semibold">{item.title || 'Untitled item'}</h2>
          <Badge variant={claim.variant}>{claim.label}</Badge>
        </div>
        <div className="tw-flex tw-flex-wrap tw-gap-2">
          {!claims.isClaimed && (
            <Button variant="outline" size="sm" aria-label={`Claim ${item.title}`} disabled={claims.pending} onClick={claims.claim}>
              Claim
            </Button>
          )}
          {claims.isMine && (
            <Button variant="outline" size="sm" aria-label={`Release ${item.title}`} disabled={claims.pending} onClick={claims.release}>
              Release
            </Button>
          )}
          {claims.isClaimed && (
            <Button variant="outline" size="sm" aria-label={`Hand off ${item.title}`} disabled={claims.pending} onClick={claims.openHandoff}>
              Hand off
            </Button>
          )}
          {claims.isClaimed && !claims.isMine && (
            <Button variant="outline" size="sm" aria-label={`Take over ${item.title}`} disabled={claims.pending} onClick={claims.openTakeover}>
              Take over
            </Button>
          )}
        </div>
      </div>
      {(summary || recordUrl) && (
        <p className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-center tw-gap-x-2 tw-gap-y-1 tw-text-sm tw-text-muted-foreground">
          {summary && <span className="tw-break-words">{summary}</span>}
          {recordUrl && (
            <a className="tw-inline-flex tw-items-center tw-gap-1 tw-text-primary tw-underline-offset-4 hover:tw-underline" href={recordUrl} target="_blank" rel="noopener noreferrer">
              View full record <ExternalLink aria-hidden="true" />
            </a>
          )}
        </p>
      )}
    </header>
  );
}

ItemPaneHeader.propTypes = {
  item: PropTypes.object.isRequired,
  currentUsername: PropTypes.string,
  claims: PropTypes.object.isRequired,
};

export default ItemPaneHeader;
