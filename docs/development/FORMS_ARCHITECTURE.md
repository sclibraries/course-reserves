# Admin Form Components

This directory contains the unified form system for managing course resources. The architecture follows DRY and SOLID principles, with a centralized approach using `ResourceFormManager`.

## Architecture Overview

### Core Components

#### 🎯 ResourceFormManager.jsx
**Main Entry Point** - Unified modal and form manager that handles all resource forms through different form types.

**Usage:**
```jsx
import ResourceFormManager, { ResourceFormType } from './ResourceFormManager';

<ResourceFormManager
  isOpen={isModalOpen}
  onClose={closeModal}
  onSubmit={handleSubmit}
  formType={ResourceFormType.NEW} // or EDS, HITCHCOCK, EDIT, REUSE, CROSSLINK
  initialData={data}
  course={course}
/>
```

**Form Types:**
- `NEW` - Create new resource from scratch
- `EDIT` - Edit existing resource
- `EDS` - Create resource from EDS database search
- `HITCHCOCK` - Create resource from Hitchcock search
- `REUSE` - Add existing resource to course
- `CROSSLINK` - Link course to another FOLIO course

## Directory Structure

```
forms/
├── ResourceFormManager.jsx          # 🎯 Main form manager
├── constants/
│   └── formTypes.js                 # Form type definitions and config
├── common/                          # 🔧 Shared form components
│   ├── BaseResourceForm.jsx         # Core resource form with all fields
│   ├── ResourceBasicFields.jsx     # Basic fields (name, URL, description)
│   ├── ResourceTypeSelector.jsx    # Material type dropdown
│   ├── FolderSelector.jsx          # Folder selection with creation
│   ├── FormSection.jsx             # Section wrapper with icons/headers
│   ├── FormActions.jsx             # Submit/cancel buttons
│   ├── ProxyToggle.jsx             # Proxy on/off toggle
│   └── VisibilityDates.jsx         # Start/end visibility dates
├── fields/                          # 📝 Field-specific components
│   ├── AdditionalCommonFields.jsx  # Folder + visibility date fields
│   ├── TypeSpecificFields.jsx      # Dynamic fields based on material type
│   └── ResourceLinks.jsx           # Additional URL links management
└── specialized/                     # 🎯 Specialized form types
    ├── AdminReuseForm.jsx          # Search and reuse existing resources
    └── CrosslinkForm.jsx           # Cross-link to FOLIO courses
```

## Component Responsibilities

### Common Components (`common/`)
Reusable, generic form components that can be used across different form types:

- **BaseResourceForm**: Complete resource form with all sections
- **ResourceBasicFields**: Name, URL, description, notes
- **ResourceTypeSelector**: Material type dropdown with loading states
- **FormSection**: Consistent section headers with icons
- **FormActions**: Standardized submit/cancel buttons
- **ProxyToggle**: Proxy enable/disable with clear labeling
- **VisibilityDates**: Date pickers with term defaults

### Field Components (`fields/`)
Specialized field groups that handle specific data types:

- **AdditionalCommonFields**: Folder selection + visibility dates (combined for layout)
- **TypeSpecificFields**: Renders dynamic fields based on selected material type
- **ResourceLinks**: Manages array of additional URLs with proxy settings

### Specialized Forms (`specialized/`)
Complex form types that require custom logic:

- **AdminReuseForm**: Search interface for existing resources
- **CrosslinkForm**: FOLIO course search and linking interface

## Data Flow

1. **ResourceFormManager** receives props and determines form type
2. Routes to appropriate form component based on `formType`
3. **BaseResourceForm** used for standard resource creation/editing
4. Specialized forms handle search interfaces (EDS, Hitchcock, Reuse, Crosslink)
5. All forms use shared field components for consistency
6. Data validation and submission handled at ResourceFormManager level

## Key Features

### 🎯 Single Responsibility
Each component has a clear, focused purpose

### 🔄 DRY Principle
Common functionality extracted into reusable components

### 📦 Composability
Components can be easily combined and reused

### 🎨 Consistent UI
Shared styling and behavior across all forms

### 📱 Responsive Design
All forms work on desktop and mobile devices

### ♿ Accessibility
Proper ARIA labels, keyboard navigation, and screen reader support

## Usage Examples

### Creating a New Resource
```jsx
<ResourceFormManager
  isOpen={newResourceModal}
  onClose={() => setNewResourceModal(false)}
  onSubmit={handleCreateResource}
  formType={ResourceFormType.NEW}
  course={currentCourse}
/>
```

### Editing an Existing Resource
```jsx
<ResourceFormManager
  isOpen={editModal}
  onClose={() => setEditModal(false)}
  onSubmit={handleUpdateResource}
  formType={ResourceFormType.EDIT}
  initialData={selectedResource}
  course={currentCourse}
/>
```

### EDS Search Integration
```jsx
<ResourceFormManager
  isOpen={edsModal}
  onClose={() => setEdsModal(false)}
  onSubmit={handleEdsResource}
  formType={ResourceFormType.EDS}
  course={currentCourse}
/>
```

## Development Guidelines

### Adding New Fields
1. Determine if field is common across forms → add to `ResourceBasicFields`
2. If field is material-type specific → update database schema and `TypeSpecificFields` will handle it
3. If field is form-specific → add to appropriate specialized component

### Adding New Form Types
1. Add new type to `constants/formTypes.js`
2. Add modal configuration
3. Update `ResourceFormManager` routing logic
4. Create specialized component if needed

### Styling Guidelines
- Use Bootstrap/Reactstrap components for consistency
- Import shared CSS: `import '../../../../css/AdminForms.css'`
- Follow existing naming conventions for CSS classes
- Use semantic HTML with proper ARIA attributes

## Deprecated Components

Moved to `../deprecated/` folder:
- `AdminResourceForm.jsx` → Use `ResourceFormManager` with `ResourceFormType.NEW`
- `AdminEditForm.jsx` → Use `ResourceFormManager` with `ResourceFormType.EDIT`
- `AdminEDSForm.jsx` → Use `ResourceFormManager` with `ResourceFormType.EDS`
- `AdminHitchcockForm.jsx` → Use `ResourceFormManager` with `ResourceFormType.HITCHCOCK`
- Individual modal components → All replaced by `ResourceFormManager`

## Testing

Form components are tested through:
- Unit tests for individual components
- Integration tests through `ResourceFormManager`
- E2E tests for complete user workflows

## Performance Considerations

- Forms use controlled components for real-time validation
- Material type fields are loaded on-demand
- Search results are paginated and debounced
- Form state is managed efficiently to prevent unnecessary re-renders
