import { READINESS_STATUSES, getReadinessPresentation } from './submissionPageUtils';
import ReadinessStatusIcon from './ReadinessStatusIcon';

function ReadinessLegend() {
  return (
    <div role="group" aria-label="Readiness legend">
      <ul className="tw-flex tw-flex-wrap tw-gap-x-3 tw-gap-y-1 tw-text-xs tw-text-muted-foreground">
        {READINESS_STATUSES.map((status) => {
          const presentation = getReadinessPresentation(status);
          return (
            <li key={status} className="tw-inline-flex tw-items-center tw-gap-1">
              <ReadinessStatusIcon presentation={presentation} />
              <span>{presentation.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ReadinessLegend;
