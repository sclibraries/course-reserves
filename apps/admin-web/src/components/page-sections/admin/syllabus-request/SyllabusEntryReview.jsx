import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button';

export default function SyllabusEntryReview({ groups, decisions, onChoose }) {
  return (
    <section className="tw-grid tw-gap-5" aria-labelledby="review-heading">
      <div>
        <h2 id="review-heading" className="tw-text-xl tw-font-semibold">Review matched items</h2>
        <p className="tw-mt-1 tw-text-sm tw-text-muted-foreground">Accept a suggested catalog record, choose another result, keep the syllabus text, or drop an entry.</p>
      </div>
      {groups.map((group) => (
        <section key={group.heading} className="tw-min-w-0 tw-rounded-lg tw-border tw-bg-card tw-p-4" aria-labelledby={`heading-${group.entries[0].id}`}>
          <h3 id={`heading-${group.entries[0].id}`} className="tw-mb-3 tw-break-words tw-text-lg tw-font-semibold">{group.heading}</h3>
          <div className="tw-grid tw-gap-3">
            {group.entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} decision={decisions[entry.id]} onChoose={onChoose} />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

SyllabusEntryReview.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.shape({
    heading: PropTypes.string.isRequired,
    entries: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, text: PropTypes.string.isRequired })).isRequired,
  })).isRequired,
  decisions: PropTypes.objectOf(PropTypes.shape({
    action: PropTypes.string,
    best: PropTypes.shape({ title: PropTypes.string }),
    results: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, title: PropTypes.string })),
    result: PropTypes.shape({ title: PropTypes.string }),
  })).isRequired,
  onChoose: PropTypes.func.isRequired,
};

EntryCard.propTypes = {
  entry: PropTypes.shape({ id: PropTypes.string.isRequired, text: PropTypes.string.isRequired }).isRequired,
  decision: PropTypes.shape({
    action: PropTypes.string,
    best: PropTypes.shape({ title: PropTypes.string }),
    results: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, title: PropTypes.string })),
    result: PropTypes.shape({ title: PropTypes.string }),
  }).isRequired,
  onChoose: PropTypes.func.isRequired,
};

function EntryCard({ entry, decision, onChoose }) {
  const best = decision.best;
  const alternatives = decision.results.filter((result) => result !== best);
  const selectedText = decision.action === 'drop'
    ? 'Entry dropped'
    : decision.action === 'typed'
      ? 'Keeping syllabus text'
      : decision.action === 'match'
        ? `Selected: ${decision.result.title}`
        : 'Choose how to include this entry';

  return (
    <article role="group" aria-label={entry.text} className="tw-min-w-0 tw-rounded-md tw-border tw-p-4">
      <p className="tw-break-words tw-font-medium">{entry.text}</p>
      <p className="tw-mt-2 tw-text-sm tw-text-muted-foreground" role="status">{selectedText}</p>
      {best && (
        <div className="tw-mt-3 tw-rounded-md tw-bg-muted tw-p-3">
          <p className="tw-break-words tw-font-medium">Suggested match: {best.title}</p>
          <Button className="tw-mt-3" type="button" size="sm" onClick={() => onChoose(entry.id, 'match', best)}>Accept suggested match</Button>
        </div>
      )}
      {alternatives.length > 0 && (
        <div className="tw-mt-3 tw-grid tw-gap-2">
          {alternatives.map((result) => (
            <Button key={result.id} type="button" variant="outline" className="tw-h-auto tw-justify-start tw-whitespace-normal tw-text-left" onClick={() => onChoose(entry.id, 'match', result)}>
              Choose match: {result.title}
            </Button>
          ))}
        </div>
      )}
      <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChoose(entry.id, 'typed')}>Keep as typed</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onChoose(entry.id, 'drop')}>Drop entry</Button>
      </div>
    </article>
  );
}
