import PropTypes from 'prop-types';
import { Modal, ModalHeader, ModalBody } from 'reactstrap';
import { AdminEditForm } from '../forms/AdminEditForm';

export const AdminEditResourceModal = ({ isOpen, toggle, onSubmit, resource }) => (
  <Modal size="lg" isOpen={isOpen} toggle={toggle}>
    <ModalHeader toggle={toggle}>Create New Resource from EDS</ModalHeader>
    <ModalBody>
      <AdminEditForm onSubmit={onSubmit} resource={resource} />
    </ModalBody>
  </Modal>
);

AdminEditResourceModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    toggle: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    resource: PropTypes.object.isRequired
    };
export default AdminEditResourceModal;
