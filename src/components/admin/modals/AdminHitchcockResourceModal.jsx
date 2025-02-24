import PropTypes from 'prop-types';
import { Modal, ModalHeader, ModalBody } from 'reactstrap';
import { AdminHitchcockForm } from '../forms/AdminHitchcockForm';

export const AdminHitchCockResourceModal = ({ isOpen, toggle, onSubmit, course }) => (
  <Modal size="xl" fullscreen="xl" isOpen={isOpen} toggle={toggle}>
    <ModalHeader toggle={toggle}>Create New Resource from Hitchcock</ModalHeader>
    <ModalBody>
      <AdminHitchcockForm onSubmit={onSubmit} course={course} />
    </ModalBody>
  </Modal>
);

AdminHitchCockResourceModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    toggle: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    course: PropTypes.object.isRequired
    };
export default AdminHitchCockResourceModal;
