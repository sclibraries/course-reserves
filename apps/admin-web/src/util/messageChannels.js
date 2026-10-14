const isNoteMessage = (message) => (
  message.category === 'note' ||
  message.communication_type === 'note' ||
  message.communication_type === 'internal_note'
);

export const matchesCommunicationChannel = (message, channel) => {
  if (channel === 'faculty') {
    return message.sender_type === 'faculty' ||
      message.communication_type === 'faculty_to_staff' ||
      message.visibility === 'faculty_visible';
  }

  if (channel === 'notes') {
    return isNoteMessage(message);
  }

  return !isNoteMessage(message) && (
    message.sender_type === 'staff' ||
    message.communication_type === 'staff_to_staff' ||
    (message.visibility && message.visibility !== 'faculty_visible')
  );
};
