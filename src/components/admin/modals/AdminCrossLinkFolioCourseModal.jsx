// src/components/admin/modals/AdminCrossLinkModal.jsx
import PropTypes from 'prop-types';
import { Modal, ModalHeader, ModalBody } from 'reactstrap';
import { CrossLinkForm } from '../forms/CrosslinkForm';

/**
 * AdminCrossLinkModal
 * -------------------
 * A modal for linking the given resource to a different FOLIO course.
 */
export const AdminCrossLinkFolioCourseModal = ({ isOpen, toggle, resourceId, onSuccess, course }) => {
  return (
    <Modal size="xl" fullscreen="xl" isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>Cross-Link to Another Course</ModalHeader>
      <ModalBody>
        <CrossLinkForm
          resourceId={resourceId}
          onSuccess={() => {
            onSuccess && onSuccess();
            toggle();
          }}
          courseInfo={course}
        />
      </ModalBody>
    </Modal>
  );
};

AdminCrossLinkFolioCourseModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  resourceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onSuccess: PropTypes.func,
};

export default AdminCrossLinkFolioCourseModal;
