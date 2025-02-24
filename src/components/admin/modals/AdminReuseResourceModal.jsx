// components/admin/modals/AdminReuseResourceModal.js
import PropTypes from 'prop-types';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from 'reactstrap';
import { AdminReuseForm } from '../forms/AdminReuseForm';

export const AdminReuseResourceModal = ({ 
  isOpen, 
  toggle,
  searchTerm,
  searchResults,
  onSearchTermChange,
  onSearch,
  onReuse,
  isLoading 
}) => (
  <Modal size="xl" isOpen={isOpen} toggle={toggle} onClosed={() => {
    onSearchTermChange('');
  }}>
    <ModalHeader toggle={toggle}>Reuse Existing Resource</ModalHeader>
    <ModalBody>
      <AdminReuseForm
        searchTerm={searchTerm}
        searchResults={searchResults}
        onSearchTermChange={onSearchTermChange}
        onSearch={onSearch}
        onReuse={onReuse}
        isLoading={isLoading}
      />
    </ModalBody>
    <ModalFooter>
      <Button color="secondary" onClick={toggle}>Close</Button>
    </ModalFooter>
  </Modal>
);

AdminReuseResourceModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  searchTerm: PropTypes.string,
  searchResults: PropTypes.array,
  onSearchTermChange: PropTypes.func.isRequired,
  onSearch: PropTypes.func.isRequired,
  onReuse: PropTypes.func.isRequired,
  isLoading: PropTypes.bool
};