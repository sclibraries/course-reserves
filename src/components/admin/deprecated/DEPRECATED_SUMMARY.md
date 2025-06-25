# Deprecated Components Summary

This folder contains components that have been deprecated during the Resource Forms refactoring project (June 2025). These components have been replaced with a unified `ResourceFormManager` system that follows DRY and SOLID principles.

## ⚠️ Important Notice
**DO NOT USE** these components in new development. They are preserved here for reference only and will be removed in a future release.

## 📝 Deprecated Files and Their Replacements

### Form Components

#### `AdminElectronicResourceForm.jsx`
- **Previous Use**: Basic electronic resource form component
- **Functionality**: Provided input fields for title, link, notes, and material type
- **Used By**: Various admin modals for creating electronic resources
- **Replacement**: `BaseResourceForm` component via `ResourceFormManager` with `ResourceFormType.NEW` or `ResourceFormType.EDIT`
- **Deprecated Date**: June 2025
- **Reason**: Redundant with `BaseResourceForm` and lacked proper validation

#### `BasicFields.jsx`
- **Previous Use**: Common input fields for resource forms
- **Functionality**: Rendered basic form fields (title, link, notes, etc.)
- **Used By**: Multiple form components for consistent field rendering
- **Replacement**: `common/ResourceBasicFields.jsx` with improved prop validation
- **Deprecated Date**: June 2025
- **Reason**: Moved to common directory with better error handling

### Modal Components

#### `AdminNewResourceModal.jsx`
- **Previous Use**: Modal wrapper for creating new resources
- **Functionality**: Provided modal interface for new resource creation
- **Used By**: `AdminElectronicResources.jsx` main page
- **Replacement**: `ResourceFormManager` with `ResourceFormType.NEW`
- **Deprecated Date**: June 2025
- **Reason**: Consolidated into unified modal system

#### `AdminEDSResourceModal.jsx`
- **Previous Use**: Modal wrapper for EDS search and resource creation
- **Functionality**: Combined EDS search with resource form in a modal
- **Used By**: Admin pages for EDS-based resource creation
- **Replacement**: `ResourceFormManager` with `ResourceFormType.EDS`
- **Deprecated Date**: June 2025
- **Reason**: Consolidated into unified modal system with better search integration

#### `AdminHitchcockResourceModal.jsx`
- **Previous Use**: Modal wrapper for Hitchcock search and resource creation
- **Functionality**: Combined Hitchcock search with resource form in a modal
- **Used By**: Admin pages for Hitchcock-based resource creation
- **Replacement**: `ResourceFormManager` with `ResourceFormType.HITCHCOCK`
- **Deprecated Date**: June 2025
- **Reason**: Consolidated into unified modal system

#### `AdminReuseResourceModal.jsx`
- **Previous Use**: Modal wrapper for reusing existing resources
- **Functionality**: Provided search and selection interface for existing resources
- **Used By**: Admin pages for resource reuse workflows
- **Replacement**: `ResourceFormManager` with `ResourceFormType.REUSE`
- **Deprecated Date**: June 2025
- **Reason**: Consolidated into unified modal system with improved search

#### `AdminEditResourceModel.jsx`
- **Previous Use**: Modal wrapper for editing existing resources
- **Functionality**: Provided modal interface for resource editing
- **Used By**: Resource tables and admin pages for resource modifications
- **Replacement**: `ResourceFormManager` with `ResourceFormType.EDIT`
- **Deprecated Date**: June 2025
- **Reason**: Consolidated into unified modal system

#### `AdminCrossLinkFolioCourseModal.jsx`
- **Previous Use**: Modal for cross-linking FOLIO courses
- **Functionality**: Allowed linking FOLIO courses to local resources
- **Used By**: Unknown (likely unused based on analysis)
- **Replacement**: `ResourceFormManager` with `ResourceFormType.CROSSLINK` or `CrossLinkForm` directly
- **Deprecated Date**: June 2025
- **Reason**: Unused component, functionality available in CrossLinkForm

### Utility Files

#### `deprecated.js`
- **Previous Use**: Export file for deprecated components with deprecation notices
- **Functionality**: Provided temporary exports with deprecation warnings
- **Used By**: Migration phase to warn about deprecated usage
- **Replacement**: Direct import of `ResourceFormManager` and related components
- **Deprecated Date**: June 2025
- **Reason**: Migration utility no longer needed

## 🔄 Migration Guide

For any remaining usage of these components, follow this migration pattern:

### Before (Deprecated)
```jsx
import { AdminNewResourceModal } from '../modals/AdminNewResourceModal';

<AdminNewResourceModal 
  isOpen={modalOpen} 
  toggle={toggleModal} 
  onSubmit={handleSubmit} 
/>
```

### After (Current)
```jsx
import { ResourceFormManager } from '../forms/ResourceFormManager';
import { ResourceFormType } from '../forms/constants/formTypes';

<ResourceFormManager
  isOpen={modalOpen}
  onClose={toggleModal}
  onSubmit={handleSubmit}
  formType={ResourceFormType.NEW}
  course={course}
/>
```

## 📊 Benefits of New System

- **DRY Principle**: Single component handles all resource form types
- **SOLID Principles**: Better separation of concerns and single responsibility
- **Type Safety**: Consistent form type constants
- **Error Handling**: Unified error handling and validation
- **Maintainability**: Single component to maintain instead of multiple modals
- **Consistency**: Consistent UI/UX across all resource form interactions

## 🗑️ Removal Timeline

These files are scheduled for removal in the next major version release. They are kept here for:
1. Reference during migration period
2. Rollback capability if needed
3. Documentation of previous implementation

**Target Removal Date**: Next major version (TBD)
