import PropTypes from 'prop-types';

function ClaimItemSummary({ item, children }) {
  const course = `${item.course_code || 'Course'}${item.section ? `-${item.section}` : ''}`;
  const claimState = item.claimed_by
    ? `Claimed by ${item.claimed_by_display || item.claimed_by}`
    : 'Unclaimed';

  return (
    <article className="border rounded p-3" data-item-id={item.id}>
      <div className="d-flex align-items-start justify-content-between gap-3">
        <div>
          <h2 className="h5 mb-1">{item.title || 'Untitled item'}</h2>
          <p className="text-muted mb-1">{course} · {item.term_code || 'Term unavailable'}</p>
          <p className="small mb-0">{item.material_type || 'Material type unavailable'} · {claimState}</p>
          {item.assigned_group?.name && <p className="small text-muted mb-0">Group queue: {item.assigned_group.name}</p>}
        </div>
        {children}
      </div>
    </article>
  );
}

ClaimItemSummary.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string,
    course_code: PropTypes.string,
    section: PropTypes.string,
    term_code: PropTypes.string,
    material_type: PropTypes.string,
    claimed_by: PropTypes.string,
    claimed_by_display: PropTypes.string,
    assigned_group: PropTypes.shape({ name: PropTypes.string }),
  }).isRequired,
  children: PropTypes.node,
};

export default ClaimItemSummary;
