# Crosslink Backend Payload Fix Summary
## Date: June 23, 2025

## Issue Description
Cross-linking courses was failing with backend errors:

**First Error**: 
```
PHP Notice: Trying to get property 'course_id' of non-object
File: /backend/controllers/CourseController.php, line 360
```

**Second Error**: 
```
Bad Request: Missing folioCourseId.
```

## Root Cause Analysis
1. **Missing folioCourseId**: The frontend was not correctly extracting the FOLIO course ID from the course object
2. **Backend Expects GET Request**: Backend uses `Yii::$app->request->get('folioCourseId')` (query parameter)
3. **Property Name Inconsistency**: FOLIO course objects use different property names (`id`, `folioCourseId`, `courseListingId`)

## Backend Code Context
The backend expects a GET request with folioCourseId as query parameter:
```php
public function actionExists() {
    $folioCourseId = Yii::$app->request->get('folioCourseId');
    if (!$folioCourseId) {
        throw new \yii\web\BadRequestHttpException('Missing folioCourseId.');
    }
    
    $courseOffering = CourseOfferings::findOne(['folio_course_id' => $folioCourseId]);
    $course = Courses::findOne(['course_id' => $courseOffering->course_id]); // ← Error if $courseOffering is null
}
```

## Solution Applied

### 1. Reverted to GET Request
**File**: `src/services/admin/adminCourseService.js`

```javascript
async checkCourseExists(folioCourseId) {
  const response = await fetch(
    `${COURSE_API}${config.api.endpoints.admin.courseExists}?folioCourseId=${folioCourseId}`,
    {
      headers: {
        'Content-Type': 'application/json', 
        'Authorization': getAuthToken()
      }
    }
  );
}
```

### 2. Fixed folioCourseId Extraction
**File**: `src/components/admin/forms/specialized/CrosslinkForm.jsx`

**Before** (single property):
```javascript
const folioCourseId = folioCourse.courseListingId;
```

**After** (multiple fallbacks):
```javascript
const folioCourseId = folioCourse.courseListingId || folioCourse.id || folioCourse.folioCourseId;

// Validation
if (!folioCourseId) {
  console.error('Missing folioCourseId from FOLIO course data:', folioCourse);
  toast.error('Invalid course data. Missing course listing ID.');
  return;
}
```

## Technical Details

### Why This Fix Works
1. **Correct HTTP Method**: Uses GET request as backend expects
2. **Flexible Property Access**: Tries multiple property names for course ID
3. **Validation**: Checks for valid course ID before API call
4. **Better Error Handling**: Clear error messages for debugging

### FOLIO Course Object Properties
Different FOLIO course objects may have the course ID in different properties:
- `courseListingId` - Primary expected property
- `id` - Alternative property name
- `folioCourseId` - Another possible property name

## Testing Instructions
1. Open resource crosslink modal
2. Search for courses in FOLIO
3. Select a course to link
4. Check browser console for debugging logs
5. Verify no "Missing folioCourseId" errors
6. Confirm crosslinking completes successfully

## Files Modified
- ✅ `src/services/admin/adminCourseService.js` - Reverted to GET request
- ✅ `src/components/admin/forms/specialized/CrosslinkForm.jsx` - Added validation and fallback properties
- ✅ `src/constants/admin.js` - Added error constant
- ✅ Build successful with no compilation errors

## Expected Result
- ✅ **No more "Missing folioCourseId" errors**
- ✅ **Successful course ID extraction** from FOLIO course objects
- ✅ **Better error handling** with user-friendly messages
- ✅ **Debug logging** to help identify data structure issues

## Backend Recommendation
The backend should also handle the case where `$courseOffering` is null:
```php
$courseOffering = CourseOfferings::findOne(['folio_course_id' => $folioCourseId]);
if ($courseOffering) {
    $course = Courses::findOne(['course_id' => $courseOffering->course_id]);
} else {
    return ['exists' => false];
}
```
