/**
 * Resource Form Type Constants
 * 
 * Defines the different types of resource forms available in the system.
 * Used by ResourceFormManager to determine which form to render.
 */
export const ResourceFormType = {
  NEW: 'new',
  EDIT: 'edit',
  EDS: 'eds',
  HITCHCOCK: 'hitchcock',
  REUSE: 'reuse',
  CROSSLINK: 'crosslink'
};

/**
 * Modal size configurations for different form types
 */
export const ModalConfig = {
  [ResourceFormType.NEW]: {
    title: 'Add New Resource',
    size: 'lg',
    fullscreen: false
  },
  [ResourceFormType.EDIT]: {
    title: 'Edit Resource',
    size: 'lg',
    fullscreen: false
  },
  [ResourceFormType.EDS]: {
    title: 'Create Resource from EDS',
    size: 'xl',
    fullscreen: 'xl'
  },
  [ResourceFormType.HITCHCOCK]: {
    title: 'Create Resource from Hitchcock',
    size: 'xl',
    fullscreen: true
  },
  [ResourceFormType.REUSE]: {
    title: 'Reuse Existing Resource',
    size: 'xl',
    fullscreen: true
  },
  [ResourceFormType.CROSSLINK]: {
    title: 'Cross-link to Another Course',
    size: 'xl',
    fullscreen: 'xl'
  }
};

/**
 * Default initial data structure for resource forms
 */
export const DefaultResourceData = {
  title: '',
  link: '',
  notes: '',
  internal_note: '',
  external_note: '',
  use_proxy: false,
  material_type_id: '',
  folder: '',
  start_visibility: '',
  end_visibility: '',
  metadata: {},
  links: []
};
