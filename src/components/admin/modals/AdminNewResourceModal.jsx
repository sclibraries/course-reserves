import PropTypes from 'prop-types';
import { Modal, ModalHeader, ModalBody } from 'reactstrap';
import { AdminResourceForm } from '../forms/AdminResourceForm';

export const AdminNewResourceModal = ({ isOpen, toggle, onSubmit, course }) => (
  <Modal size="xl" fullscreen="xl" isOpen={isOpen} toggle={toggle}>
    <ModalHeader toggle={toggle}>Create New Resource</ModalHeader>
    <ModalBody>
      <AdminResourceForm 
        course={course}
        onSubmit={onSubmit} 
      />
    </ModalBody>
  </Modal>
);

AdminNewResourceModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    toggle: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    };
export default AdminNewResourceModal;
