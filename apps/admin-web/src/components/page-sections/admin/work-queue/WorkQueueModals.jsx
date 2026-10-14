import PropTypes from 'prop-types';
import StaffMessagingModal from '../StaffMessagingModal';
import FacultyMessageModal from '../FacultyMessageModal';
import QuickNoteModal from '../QuickNoteModal';

function WorkQueueModals({
  staffMessageModal,
  setStaffMessageModal,
  facultyMessageModal,
  setFacultyMessageModal,
  noteModal,
  setNoteModal,
  onMessageSent
}) {
  return (
    <>
      <StaffMessagingModal
        isOpen={staffMessageModal.isOpen}
        toggle={() => setStaffMessageModal({ isOpen: false, item: null })}
        item={staffMessageModal.item}
        onMessageSent={onMessageSent}
      />
      <FacultyMessageModal
        isOpen={facultyMessageModal.isOpen}
        toggle={() => setFacultyMessageModal({ isOpen: false, item: null })}
        item={facultyMessageModal.item}
        onMessageSent={onMessageSent}
      />
      <QuickNoteModal
        isOpen={noteModal.isOpen}
        toggle={() => setNoteModal({ isOpen: false, item: null })}
        item={noteModal.item}
        onNoteSaved={onMessageSent}
      />
    </>
  );
}

WorkQueueModals.propTypes = {
  staffMessageModal: PropTypes.object.isRequired,
  setStaffMessageModal: PropTypes.func.isRequired,
  facultyMessageModal: PropTypes.object.isRequired,
  setFacultyMessageModal: PropTypes.func.isRequired,
  noteModal: PropTypes.object.isRequired,
  setNoteModal: PropTypes.func.isRequired,
  onMessageSent: PropTypes.func.isRequired
};

export default WorkQueueModals;
