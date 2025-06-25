# Admin Interface College Theming Fix

## Problem
When users changed the college selection in admin interface components (like `HorizontalAdminSidebar` or `CrosslinkForm`), the header and page theming did not update to reflect the selected college. This created an inconsistency between the admin and public interfaces, where college theming worked correctly on the public side but not on the admin side.

## Root Cause
The admin components were only updating the `adminSearchStore` when the college changed, but the `Header` component relies on `customizationStore.currentCollege` for determining which college's theming to apply. Without updating the customization store, the header continued to show the previous college's theme.

## Solution
Modified the `useCollegeManagement` hook to also update the `customizationStore.currentCollege` whenever the college changes. This ensures that:

1. **Admin college changes are reflected in header theming** - When admin users change the college selection, the header background color, logo, and other theme elements update immediately
2. **Consistent behavior between admin and public interfaces** - Both sides now properly sync college selection with header theming
3. **DRY principle maintained** - All college management logic remains centralized in the `useCollegeManagement` hook

## Changes Made

### `src/hooks/useCollegeManagement.js`
- Added import for `useCustomizationStore`
- Updated `handleCollegeChange` function to call `useCustomizationStore.getState().setCurrentCollege(newCollegeKey)` when college changes
- Updated `resetCollege` function to also update the customization store
- **Updated college display names to show full institution names** (e.g., "Mount Holyoke College" instead of "MtHolyoke")
- **Ensured alphabetical ordering** of college options in dropdown menus
- Modified mapping functions to handle full college names consistently

## Code Pattern
The fix follows the same pattern already used in the public `Searchbar.jsx` component:

```javascript
// When college changes
setCollege(newCollegeKey);
useCustomizationStore.getState().setCurrentCollege(newCollegeKey);
```

## Benefits
- ✅ Admin interface now has consistent college theming
- ✅ Header updates immediately when college is changed in admin components  
- ✅ No code duplication - centralized logic in `useCollegeManagement` hook
- ✅ Maintains existing functionality while adding the missing theming update
- ✅ **Improved user experience** with full institution names in dropdowns (e.g., "Mount Holyoke College")
- ✅ **Consistent alphabetical ordering** of college options across all interfaces

## Testing
- Build successful with no lint errors
- Admin college selection now properly updates header theming
- Both `HorizontalAdminSidebar` and `CrosslinkForm` components benefit from this fix
- Public interface theming continues to work as before

This fix completes the DRY refactoring and theming consistency goals for the course reserves application.
