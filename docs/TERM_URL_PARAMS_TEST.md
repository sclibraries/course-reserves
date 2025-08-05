# Term URL Parameter Test Plan

## Changes Made

1. **Search.jsx**: Added term URL parameter handling
   - Added `setTermId` to useSearchStore destructuring
   - Added term parameter parsing from URL (`queryParams.get('term')`)
   - Added term to URL parameter updating logic
   - Added termId to dependency array for URL update effect

2. **Searchbar.jsx**: Updated navigation to include termId
   - Updated `handleSearch` to include termId in URL parameters
   - Updated `handleReset` to preserve termId when resetting other filters
   - Updated college change handlers (both desktop and mobile) to preserve termId

3. **useTermSetup.js**: Enhanced to respect URL-provided terms
   - Added URL check to prevent auto-setting default term when term is provided in URL
   - Added location dependency to useEffect

# Term URL Parameter Test Plan

## Changes Made

1. **Search.jsx**: Added term URL parameter handling with user-friendly term names
   - Added `setTermId` and `terms` to useSearchStore destructuring
   - Added term parameter parsing from URL using term names (`queryParams.get('term')`)
   - Added term name conversion logic (URL param ↔ term name ↔ term ID)
   - Added term to URL parameter updating logic using term names
   - Added termId to dependency array for URL update effect

2. **Searchbar.jsx**: Updated navigation to include term names in URLs
   - Updated `handleSearch` to include term names in URL parameters
   - Updated `handleReset` to preserve term names when resetting other filters
   - Updated college change handlers (both desktop and mobile) to preserve term names

3. **useTermSetup.js**: Enhanced to respect URL-provided term names
   - Added URL check to prevent auto-setting default term when term is provided in URL
   - Added term name conversion for URL parameter checking
   - Added location dependency to useEffect

4. **utils/termUrlHelpers.js**: NEW utility file for term name/URL conversion
   - `termNameToUrlParam()`: Converts "2025 Fall" → "2025-fall"
   - `urlParamToTermName()`: Converts "2025-fall" → "2025 Fall"  
   - `findTermIdByName()`: Finds term ID from term name
   - `findTermNameById()`: Finds term name from term ID

## Testing URLs

To test the functionality, try these URLs with **user-friendly term names**:

### Basic URL with term parameter (using term name)
```
http://localhost:5177/course-reserves/search?term=2025-fall
```

### URL with college and term
```
http://localhost:5177/course-reserves/search?college=smith&term=2025-spring
```

### URL with full search parameters including term
```
http://localhost:5177/course-reserves/search?college=smith&type=name&query=biology&department=BIOL&sort=name&term=2024-fall
```

## Expected Behavior

1. **URL Parameter Reading**: When navigating to a URL with a `term` parameter using term names (e.g., `term=2025-fall`), the term should be automatically selected in the term dropdown.

2. **URL Parameter Writing**: When a user selects a different term in the dropdown, the URL should update to include the new term name in URL-friendly format.

3. **Persistence During Navigation**: When using search functionality, resetting filters, or changing colleges, the selected term should be preserved in the URL using the term name format.

4. **Fallback Behavior**: If no term is specified in the URL, the system should auto-detect and set the current term based on date ranges (existing behavior).

## URL Format Examples

**Old format (term IDs - not user-friendly):**
```
/search?term=a1b2c3d4-e5f6-7890-1234-567890abcdef
```

**New format (term names - user-friendly):**
```
/search?term=2025-fall          # "2025 Fall"
/search?term=2025-spring        # "2025 Spring" 
/search?term=2024-summer        # "2024 Summer"
/search?term=2024-winter        # "2024 Winter"
```

## Manual Testing Steps

1. **Test URL Parameter Reading**:
   - Navigate to the app normally (should auto-select current term)
   - Note the current term name in the dropdown (e.g., "2025 Fall")
   - Manually edit the URL to use a different term name: `?term=2024-fall`
   - Verify the dropdown updates to show the new term

2. **Test URL Parameter Writing**:
   - Change the term in the dropdown
   - Verify the URL updates to include the new term parameter in readable format
   - Refresh the page and verify the selected term is maintained

3. **Test Search Functionality**:
   - Select a specific term
   - Perform a search
   - Verify the term parameter is preserved in the search results URL using term name format

4. **Test Filter Reset**:
   - Set up a search with term, college, query, etc.
   - Click the reset button
   - Verify that term and college are preserved while other filters are reset

5. **Test College Change**:
   - Select a specific term
   - Change the college
   - Verify the term is preserved when navigating to the new college

6. **Test URL Sharing**:
   - Navigate to a specific term via URL: `http://localhost:5177/course-reserves/search?term=2025-fall`
   - Verify the term "2025 Fall" is selected
   - Share the URL and verify it works for others
