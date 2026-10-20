import PropTypes from 'prop-types';
import { Pagination, PaginationItem, PaginationLink } from 'reactstrap';

function SubmissionQueuePagination({ pagination, onPageChange }) {
  const { currentPage, pageCount } = pagination;
  const pageItems = [];

  for (let page = 1; page <= pageCount; page += 1) {
    if (page === 1 || page === pageCount || (page >= currentPage - 1 && page <= currentPage + 1)) {
      pageItems.push(
        <PaginationItem key={page} active={page === currentPage}>
          <PaginationLink onClick={() => onPageChange(page)}>{page}</PaginationLink>
        </PaginationItem>,
      );
    } else if (page === currentPage - 2 || page === currentPage + 2) {
      pageItems.push(<PaginationItem key={page} disabled><PaginationLink>...</PaginationLink></PaginationItem>);
    }
  }

  return (
    <div className="d-flex justify-content-center mt-4">
      <Pagination>
        <PaginationItem disabled={currentPage === 1}>
          <PaginationLink previous onClick={() => onPageChange(currentPage - 1)} />
        </PaginationItem>
        {pageItems}
        <PaginationItem disabled={currentPage === pageCount}>
          <PaginationLink next onClick={() => onPageChange(currentPage + 1)} />
        </PaginationItem>
      </Pagination>
    </div>
  );
}

SubmissionQueuePagination.propTypes = {
  pagination: PropTypes.shape({ currentPage: PropTypes.number.isRequired, pageCount: PropTypes.number.isRequired }).isRequired,
  onPageChange: PropTypes.func.isRequired,
};

export default SubmissionQueuePagination;
