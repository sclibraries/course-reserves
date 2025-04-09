import PropTypes from 'prop-types';
import { useState } from 'react';
import { Modal, ModalHeader, ModalBody, Form, FormGroup, Label, Input, Button } from 'reactstrap';

const NewCourseModal = ({ isOpen, toggle, onCreate }) => {
  const [formData, setFormData] = useState({
    course_name: '',
    course_number: '',
    department_name: '',
    term_name: '',
    location_name: '',
    folio_course_id: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('https://libtools2.smith.edu/course-reserves/backend/web/course', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.status === 201) {
        const newCourse = await response.json();
        onCreate(newCourse);
        toggle();
        setFormData({
          course_name: '',
          course_number: '',
          department_name: '',
          term_name: '',
          location_name: '',
          folio_course_id: ''
        });
      }
    } catch (error) {
      console.error('Error creating course:', error);
    }
  };

  return (
    <Modal fullscreen isOpen={isOpen} toggle={toggle} centered>
      <ModalHeader toggle={toggle}>Create New Course</ModalHeader>
      <ModalBody>
        <Form onSubmit={handleSubmit}>
          <FormGroup>
            <Label>Course Name *</Label>
            <Input 
              value={formData.course_name}
              onChange={(e) => setFormData({...formData, course_name: e.target.value})}
              required
            />
          </FormGroup>

          <FormGroup>
            <Label>Course Number *</Label>
            <Input
              value={formData.course_number}
              onChange={(e) => setFormData({...formData, course_number: e.target.value})}
              required
            />
          </FormGroup>

          <FormGroup>
            <Label>Department</Label>
            <Input
              value={formData.department_name}
              onChange={(e) => setFormData({...formData, department_name: e.target.value})}
            />
          </FormGroup>

          <FormGroup>
            <Label>Term</Label>
            <Input
              value={formData.term_name}
              onChange={(e) => setFormData({...formData, term_name: e.target.value})}
            />
          </FormGroup>

          <FormGroup>
            <Label>Location</Label>
            <Input
              value={formData.location_name}
              onChange={(e) => setFormData({...formData, location_name: e.target.value})}
            />
          </FormGroup>

          <FormGroup>
            <Label>FOLIO Course ID (if linking)</Label>
            <Input
              value={formData.folio_course_id}
              onChange={(e) => setFormData({...formData, folio_course_id: e.target.value})}
            />
          </FormGroup>

          <div className="d-flex justify-content-end gap-2 mt-4">
            <Button color="secondary" onClick={toggle}>Cancel</Button>
            <Button color="primary" type="submit">Create Course</Button>
          </div>
        </Form>
      </ModalBody>
    </Modal>
  );
};

NewCourseModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired
};

export default NewCourseModal;