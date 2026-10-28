import PropTypes from 'prop-types';
import { ExternalLink } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { getClaimBadge, getClaimLineLabel, getReadinessPresentation } from '../submissionPageUtils';
import { getHttpUrl } from './itemPaneUtils';

function ItemPaneHeader({ item, currentUsername, claims }) {
  const claim = getClaimBadge(item, { username: currentUsername });
  const claimLineLabel = getClaimLineLabel(item, claim);
  const readiness = getReadinessPresentation(item);
  const recordUrl = item.eds ? getHttpUrl(item.eds.plink) : null;
  const materialDetails = [item.authors, item.materialType].filter(Boolean);
  const ReadinessIcon = readiness.Icon;

  return (
    <header className="tw-min-w-0 tw-space-y-3 tw-rounded-lg tw-border tw-bg-card tw-p-3 sm:tw-p-4">
      <div className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-start tw-justify-between tw-gap-3">
        <h2 className="tw-min-w-0 tw-flex-1 tw-break-words tw-text-lg tw-font-semibold sm:tw-text-xl">
          {item.title || 'Untitled item'}
        </h2>
        <div role="group" aria-label="Item claim actions" className="tw-flex tw-shrink-0 tw-flex-wrap tw-gap-2">
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
      <div className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-center tw-gap-x-2 tw-gap-y-1 tw-text-sm tw-text-muted-foreground">
        {materialDetails.map((detail, index) => (
          <span key={`${detail}-${index}`}>{index ? `· ${detail}` : detail}</span>
        ))}
        <span className="tw-min-w-0 tw-whitespace-normal tw-break-words tw-text-xs tw-text-muted-foreground">
          {claimLineLabel}
        </span>
        {item.publicationYear && <span>· {item.publicationYear}</span>}
        <Badge
          variant="outline"
          className={`tw-border-0 tw-px-2 tw-py-0.5 tw-text-xs tw-font-semibold tw-leading-[18px] ${readiness.className}`}
        >
          <ReadinessIcon aria-hidden="true" className="tw-mr-1 tw-h-3.5 tw-w-3.5" />
          {readiness.label}
        </Badge>
        {recordUrl && (
          <a
            className="tw-inline-flex tw-items-center tw-gap-1 tw-text-primary tw-underline-offset-4 hover:tw-underline focus-visible:tw-rounded-sm focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring"
            href={recordUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View full record <ExternalLink aria-hidden="true" className="tw-h-4 tw-w-4" />
          </a>
        )}
      </div>
    </header>
  );
}

ItemPaneHeader.propTypes = {
  item: PropTypes.object.isRequired,
  currentUsername: PropTypes.string,
  claims: PropTypes.object.isRequired,
};

export default ItemPaneHeader;
