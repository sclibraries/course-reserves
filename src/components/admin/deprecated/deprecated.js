/**
 * DEPRECATED FORMS - MOVED TO DEPRECATED FOLDER
 * 
 * These forms have been consolidated into the ResourceFormManager component
 * following DRY and SOLID principles. They are no longer used in the application
 * and have been moved to the deprecated folder for reference.
 * 
 * Replacement: Use ResourceFormManager with appropriate ResourceFormType
 * 
 * See DEPRECATED_SUMMARY.md for complete migration guide.
 */

/**
 * @deprecated Use ResourceFormManager with ResourceFormType.NEW instead
 * MOVED TO: src/components/admin/deprecated/AdminResourceForm.jsx
 */
export { AdminResourceForm } from './AdminResourceForm';

/**
 * @deprecated Use ResourceFormManager with ResourceFormType.EDIT instead
 * MOVED TO: src/components/admin/deprecated/AdminEditForm.jsx
 */
export { AdminEditForm } from './AdminEditForm';

/**
 * @deprecated Use ResourceFormManager with ResourceFormType.EDS instead
 * MOVED TO: src/components/admin/deprecated/AdminEDSForm.jsx
 */
export { AdminEDSForm } from './AdminEDSForm';

/**
 * @deprecated Use ResourceFormManager with ResourceFormType.HITCHCOCK instead
 * MOVED TO: src/components/admin/deprecated/AdminHitchcockForm.jsx
 */
export { AdminHitchcockForm } from './AdminHitchcockForm';

/**
 * @deprecated Use common/ResourceBasicFields instead
 * MOVED TO: src/components/admin/deprecated/BasicFields.jsx
 */
export { BasicFields } from './BasicFields';

/**
 * @deprecated Use ResourceFormManager with ResourceFormType.NEW instead
 * MOVED TO: src/components/admin/deprecated/AdminNewResourceModal.jsx
 */
export { AdminNewResourceModal } from './AdminNewResourceModal';

/**
 * @deprecated Use ResourceFormManager with ResourceFormType.EDS instead
 * MOVED TO: src/components/admin/deprecated/AdminEDSResourceModal.jsx
 */
export { AdminEDSResourceModal } from './AdminEDSResourceModal';

/**
 * @deprecated Use ResourceFormManager with ResourceFormType.HITCHCOCK instead
 * MOVED TO: src/components/admin/deprecated/AdminHitchcockResourceModal.jsx
 */
export { AdminHitchcockResourceModal } from './AdminHitchcockResourceModal';

/**
 * @deprecated Use ResourceFormManager with ResourceFormType.REUSE instead
 * MOVED TO: src/components/admin/deprecated/AdminReuseResourceModal.jsx
 */
export { AdminReuseResourceModal } from './AdminReuseResourceModal';

/**
 * @deprecated Use ResourceFormManager with ResourceFormType.EDIT instead
 * MOVED TO: src/components/admin/deprecated/AdminEditResourceModel.jsx
 */
export { AdminEditResourceModel } from './AdminEditResourceModel';

/**
 * @deprecated Use ResourceFormManager with ResourceFormType.CROSSLINK instead
 * MOVED TO: src/components/admin/deprecated/AdminCrossLinkFolioCourseModal.jsx
 */
export { AdminCrossLinkFolioCourseModal } from './AdminCrossLinkFolioCourseModal';

// These components are still actively used and should NOT be deprecated:
// - AdminReuseForm: Still used by ResourceFormManager (moved to specialized/)
// - CrosslinkForm: Still used by ResourceFormManager (moved to specialized/)
// - ResourceLinks: Still used by BaseResourceForm (moved to fields/)
// - TypeSpecificFields: Still used by BaseResourceForm (moved to fields/)
// - AdditionalCommonFields: Still used by BaseResourceForm (moved to fields/)
// - AdminReuseForm: Still used by ResourceFormManager
