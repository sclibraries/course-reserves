import PropTypes from 'prop-types';
import { Modal, ModalHeader, ModalBody } from 'reactstrap';
import { AdminEDSForm } from '../forms/AdminEDSForm';

export const AdminEDSResourceModal = ({ isOpen, toggle, onSubmit, course }) => (
  <Modal size="xl" fullscreen="xl" isOpen={isOpen} toggle={toggle}>
    <ModalHeader toggle={toggle}>Create New Resource from EDS</ModalHeader>
    <ModalBody>
      <AdminEDSForm onSubmit={onSubmit} course={course} />
    </ModalBody>
  </Modal>
);

AdminEDSResourceModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    toggle: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    course: PropTypes.object.isRequired
    };
export default AdminEDSResourceModal;
