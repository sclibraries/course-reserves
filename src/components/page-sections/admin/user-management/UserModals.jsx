import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input, Spinner } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PropTypes from 'prop-types';

export const ConfirmationModal = ({ 
  isOpen, 
  toggle, 
  user, 
  actionType, 
  handleApprove, 
  handleReject 
}) => (
  <Modal isOpen={isOpen} toggle={toggle}>
    <ModalHeader toggle={toggle}>
      {actionType === 'approve' ? 'Approve User' : 'Reject User'}
    </ModalHeader>
    <ModalBody>
      {user && (
        <div className="p-2">
          <p className="mb-4">
            {actionType === 'approve'
              ? `Are you sure you want to approve the user ${user.full_name} (${user.username})?`
              : `Are you sure you want to reject and remove the user ${user.full_name} (${user.username})?`}
          </p>
          <div className="card bg-light">
            <div className="card-body">
              <dl className="row mb-0">
                <dt className="col-sm-4">Email:</dt>
                <dd className="col-sm-8">{user.email}</dd>
                <dt className="col-sm-4">Department:</dt>
                <dd className="col-sm-8">{user.department}</dd>
                <dt className="col-sm-4">Institution:</dt>
                <dd className="col-sm-8">{user.institution}</dd>
              </dl>
            </div>
          </div>
        </div>
      )}
    </ModalBody>
    <ModalFooter>
      <Button color="secondary" onClick={toggle}>
        <FontAwesomeIcon icon="times" className="me-2" />
        Cancel
      </Button>
      {actionType === 'approve' ? (
        <Button color="success" onClick={() => handleApprove(user)}>
          <FontAwesomeIcon icon="check" className="me-2" />
          Approve
        </Button>
      ) : (
        <Button color="danger" onClick={() => handleReject(user)}>
          <FontAwesomeIcon icon="trash" className="me-2" />
          Reject
        </Button>
      )}
    </ModalFooter>
  </Modal>
);

export const EditUserModal = ({ 
  isOpen, 
  toggle, 
  user, 
  formData, 
  formErrors, 
  handleChange, 
  handleSubmit, 
  submitting 
}) => (
  <Modal isOpen={isOpen} toggle={toggle} size="lg">
    <ModalHeader toggle={toggle}>
      Edit User: {user?.full_name}
    </ModalHeader>
    <Form onSubmit={handleSubmit}>
      <ModalBody>
        {user && (
          <div className="p-2">
            <div className="row">
              <div className="col-md-6">
                <FormGroup>
                  <Label for="username">Username</Label>
                  <Input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    invalid={!!formErrors.username}
                  />
                  {formErrors.username && (
                    <div className="text-danger small mt-1">{formErrors.username}</div>
                  )}
                </FormGroup>
              </div>
              <div className="col-md-6">
                <FormGroup>
                  <Label for="full_name">Full Name</Label>
                  <Input
                    type="text"
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    invalid={!!formErrors.full_name}
                  />
                  {formErrors.full_name && (
                    <div className="text-danger small mt-1">{formErrors.full_name}</div>
                  )}
                </FormGroup>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <FormGroup>
                  <Label for="email">Email</Label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    invalid={!!formErrors.email}
                  />
                  {formErrors.email && (
                    <div className="text-danger small mt-1">{formErrors.email}</div>
                  )}
                </FormGroup>
              </div>
              <div className="col-md-6">
                <FormGroup>
                  <Label for="department">Department</Label>
                  <Input
                    type="select"
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    invalid={!!formErrors.department}
                  >
                    <option value="">Select Department</option>
                    <option value="Libraries">Libraries</option>
                    <option value="IT">IT</option>
                    <option value="Other">Other</option>
                  </Input>
                  {formErrors.department && (
                    <div className="text-danger small mt-1">{formErrors.department}</div>
                  )}
                </FormGroup>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <FormGroup>
                  <Label for="institution">Institution</Label>
                  <Input
                    type="select"
                    id="institution"
                    name="institution"
                    value={formData.institution}
                    onChange={handleChange}
                    invalid={!!formErrors.institution}
                  >
                    <option value="">Select Institution</option>
                    <option value="Smith College">Smith College</option>
                    <option value="Amherst College">Amherst College</option>
                    <option value="Hampshire College">Hampshire College</option>
                    <option value="Mount Holyoke College">Mount Holyoke College</option>
                    <option value="UMass Amherst">UMass Amherst</option>
                  </Input>
                  {formErrors.institution && (
                    <div className="text-danger small mt-1">{formErrors.institution}</div>
                  )}
                </FormGroup>
              </div>
              <div className="col-md-6">
                <FormGroup>
                  <Label for="role">Role</Label>
                  <Input
                    type="select"
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    invalid={!!formErrors.role}
                  >
                    <option value="">Select Role</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </Input>
                  {formErrors.role && (
                    <div className="text-danger small mt-1">{formErrors.role}</div>
                  )}
                </FormGroup>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <FormGroup check className="mt-3">
                  <Label check>
                    <Input
                      type="checkbox"
                      name="approved"
                      checked={formData.approved === 1}
                      onChange={handleChange}
                    />{' '}
                    Approved
                  </Label>
                </FormGroup>
              </div>
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={toggle}>
          <FontAwesomeIcon icon="times" className="me-2" />
          Cancel
        </Button>
        <Button color="primary" type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner size="sm" className="me-2" />
              Saving...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon="save" className="me-2" />
              Save Changes
            </>
          )}
        </Button>
      </ModalFooter>
    </Form>
  </Modal>
);

export const CreateUserModal = ({
  isOpen,
  toggle,
  formData,
  formErrors,
  handleChange,
  handleSubmit,
  submitting
}) => (
  <Modal isOpen={isOpen} toggle={toggle} size="lg">
    <ModalHeader toggle={toggle}>
      <FontAwesomeIcon icon="user-plus" className="me-2" />
      Create New User
    </ModalHeader>
    <Form onSubmit={handleSubmit}>
      <ModalBody>
        <div className="p-2">
          <div className="row">
            <div className="col-md-6">
              <FormGroup>
                <Label for="username">Username (Shibboleth ID) *</Label>
                <Input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  invalid={!!formErrors.username}
                  placeholder="e.g., jsmith"
                />
                {formErrors.username && (
                  <div className="text-danger small mt-1">{formErrors.username}</div>
                )}
              </FormGroup>
            </div>
            <div className="col-md-6">
              <FormGroup>
                <Label for="full_name">Full Name *</Label>
                <Input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  invalid={!!formErrors.full_name}
                  placeholder="e.g., Jane Smith"
                />
                {formErrors.full_name && (
                  <div className="text-danger small mt-1">{formErrors.full_name}</div>
                )}
              </FormGroup>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <FormGroup>
                <Label for="email">Email *</Label>
                <Input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  invalid={!!formErrors.email}
                  placeholder="e.g., jsmith@smith.edu"
                />
                {formErrors.email && (
                  <div className="text-danger small mt-1">{formErrors.email}</div>
                )}
                <small className="text-muted">
                  Must be from smith.edu, hampshire.edu, amherst.edu, mtholyoke.edu, or umass.edu
                </small>
              </FormGroup>
            </div>
            <div className="col-md-6">
              <FormGroup>
                <Label for="department">Department *</Label>
                <Input
                  type="select"
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  invalid={!!formErrors.department}
                >
                  <option value="">Select Department</option>
                  <option value="Libraries">Libraries</option>
                  <option value="IT">IT</option>
                  <option value="Other">Other</option>
                </Input>
                {formErrors.department && (
                  <div className="text-danger small mt-1">{formErrors.department}</div>
                )}
              </FormGroup>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <FormGroup>
                <Label for="institution">Institution *</Label>
                <Input
                  type="select"
                  id="institution"
                  name="institution"
                  value={formData.institution}
                  onChange={handleChange}
                  invalid={!!formErrors.institution}
                >
                  <option value="">Select Institution</option>
                  <option value="Smith College">Smith College</option>
                  <option value="Amherst College">Amherst College</option>
                  <option value="Hampshire College">Hampshire College</option>
                  <option value="Mount Holyoke College">Mount Holyoke College</option>
                  <option value="UMass Amherst">UMass Amherst</option>
                </Input>
                {formErrors.institution && (
                  <div className="text-danger small mt-1">{formErrors.institution}</div>
                )}
              </FormGroup>
            </div>
            <div className="col-md-6">
              <FormGroup>
                <Label for="role">Role *</Label>
                <Input
                  type="select"
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  invalid={!!formErrors.role}
                >
                  <option value="">Select Role</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </Input>
                {formErrors.role && (
                  <div className="text-danger small mt-1">{formErrors.role}</div>
                )}
              </FormGroup>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <FormGroup check className="mt-3">
                <Label check>
                  <Input
                    type="checkbox"
                    name="approved"
                    checked={formData.approved === 1}
                    onChange={handleChange}
                  />{' '}
                  Approve immediately
                </Label>
                <small className="d-block text-muted mt-1">
                  If unchecked, the user will need to be approved later.
                </small>
              </FormGroup>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={toggle}>
          <FontAwesomeIcon icon="times" className="me-2" />
          Cancel
        </Button>
        <Button color="primary" type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner size="sm" className="me-2" />
              Creating...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon="user-plus" className="me-2" />
              Create User
            </>
          )}
        </Button>
      </ModalFooter>
    </Form>
  </Modal>
);

ConfirmationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  user: PropTypes.object,
  actionType: PropTypes.string.isRequired,
  handleApprove: PropTypes.func.isRequired,
  handleReject: PropTypes.func.isRequired
};

EditUserModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  user: PropTypes.object,
  formData: PropTypes.object.isRequired,
  formErrors: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  submitting: PropTypes.bool.isRequired
};

CreateUserModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  formData: PropTypes.object.isRequired,
  formErrors: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  submitting: PropTypes.bool.isRequired
};
