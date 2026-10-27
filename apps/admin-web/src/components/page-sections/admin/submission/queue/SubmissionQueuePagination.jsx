import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../../ui/button';

function SubmissionQueuePagination({ pagination, onPageChange }) {
  const { currentPage, pageCount } = pagination;
  const pageItems = [];

  for (let page = 1; page <= pageCount; page += 1) {
    if (page === 1 || page === pageCount || (page >= currentPage - 1 && page <= currentPage + 1)) {
      pageItems.push(
        <li key={page}>
          <Button
            type="button"
            size="icon"
            variant={page === currentPage ? 'default' : 'outline'}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        </li>,
      );
    } else if (page === currentPage - 2 || page === currentPage + 2) {
      pageItems.push(<li key={page} aria-hidden="true" className="tw-px-2">…</li>);
    }
  }

  return (
    <nav aria-label="Submission pages" className="tw-mt-6 tw-flex tw-justify-center">
      <ul className="tw-m-0 tw-flex tw-list-none tw-items-center tw-gap-2 tw-p-0">
        <li>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
        </li>
        {pageItems}
        <li>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={currentPage === pageCount}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </li>
      </ul>
    </nav>
  );
}

SubmissionQueuePagination.propTypes = {
  pagination: PropTypes.shape({ currentPage: PropTypes.number.isRequired, pageCount: PropTypes.number.isRequired }).isRequired,
  onPageChange: PropTypes.func.isRequired,
};

export default SubmissionQueuePagination;
