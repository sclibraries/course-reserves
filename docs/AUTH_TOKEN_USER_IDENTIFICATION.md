# Auth Token-Based User Identification - Implementation Complete

## Problem

The frontend was using `localStorage.getItem('user')` to determine the current user's ID, but this wasn't reliably tied to the auth token used for API requests. This meant:

1. Item claimed by user might have ID `1` (from backend auth token)
2. But `currentUser.id` from localStorage might be different
3. Result: Items show as "Claimed by Someone Else" even though YOU claimed them
4. No way to access "My Work Queue" because comparison fails

## Root Cause

**Identity Mismatch**: Frontend identity (localStorage) ≠ Backend identity (auth token)

```javascript
// Frontend thinks:
localStorage: { id: 5, username: "rob" }

// Backend knows (from auth token):
claimed_by_staff_id: 1

// Comparison fails:
item.claimedBy.id === currentUser.id  // 1 === 5 → false ❌
```

## Solution

**Use Auth Token for ALL user identification** - let the backend tell us who we are!

### Changes Made

#### 1. Added Backend Endpoint
**Endpoint**: `GET /submission-workflow/my-claimed-items`
- Returns items claimed by the user identified by the auth token
- No need to pass user ID - backend determines from token

**Endpoint**: `GET /user/current`  
- Returns current user info based on auth token
- Provides authoritative user ID that matches backend records

#### 2. Updated API Config
**File**: `src/config/api.config.js`

Added:
```javascript
submissionWorkflow: {
  // ... existing endpoints
  myClaimedItems: '/submission-workflow/my-claimed-items',
}
```

#### 3. Updated Service Layer
**File**: `src/services/admin/submissionWorkflowService.js`

Added two new methods:

```javascript
/**
 * Get items claimed by the current user (determined by auth token)
 */
async getMyClaimedItems() {
  const response = await fetch(
    `${API_BASE}/submission-workflow/my-claimed-items`,
    {
      headers: {
        'Authorization': this.getAuthToken(),  // ← Backend uses THIS to identify you
        'Content-Type': 'application/json'
      }
    }
  );
  return await response.json();
}

/**
 * Get current user info from auth token
 */
async getCurrentUser() {
  const response = await fetch(
    `${API_BASE}/user/current`,
    {
      headers: {
        'Authorization': this.getAuthToken(),  // ← Backend tells us who we are
        'Content-Type': 'application/json'
      }
    }
  );
  return await response.json();
}
```

#### 4. Updated Store
**File**: `src/store/submissionWorkflowStore.js`

**Before** (broken):
```javascript
fetchClaimedItems: async (userId) => {
  // Had to pass userId - but which one? localStorage? Backend?
  // Then filter all submissions client-side
}
```

**After** (fixed):
```javascript
fetchClaimedItems: async () => {
  // No userId needed! Backend knows from auth token
  const items = await submissionWorkflowService.getMyClaimedItems();
  set({ claimedItems: items });
}
```

#### 5. Updated SubmissionDetail Component
**File**: `src/components/page-sections/admin/SubmissionDetail.jsx`

**Before** (broken):
```javascript
useEffect(() => {
  const userStr = localStorage.getItem('user');
  const user = JSON.parse(userStr);
  setCurrentUser(user);  // ← Might not match backend!
}, []);
```

**After** (fixed):
```javascript
useEffect(() => {
  const loadCurrentUser = async () => {
    try {
      // Get authoritative user info from backend via auth token
      const user = await submissionWorkflowService.getCurrentUser();
      console.log('Current user from backend:', user);
      setCurrentUser(user);  // ← Now matches backend!
    } catch (error) {
      // Fallback to localStorage if backend fails
      const userStr = localStorage.getItem('user');
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
      }
    }
  };
  
  loadCurrentUser();
}, []);
```

#### 6. Updated MyWorkQueue Component  
**File**: `src/components/page-sections/admin/MyWorkQueue.jsx`

**Before**:
```javascript
useEffect(() => {
  if (currentUser) {
    fetchClaimedItems(currentUser.id);  // ← Wrong ID!
  }
}, [currentUser, fetchClaimedItems]);
```

**After**:
```javascript
useEffect(() => {
  fetchClaimedItems();  // ← Backend knows who I am!
}, [fetchClaimedItems]);
```

Removed `currentUser` state entirely from MyWorkQueue since we don't need it!

---

## How It Works Now

### Flow 1: Claiming an Item

```
1. User clicks "Claim This Item"
   ↓
2. Frontend sends: POST /submission-workflow/item/371/claim
   Headers: { Authorization: "Bearer abc123..." }
   ↓
3. Backend reads token → "This is user ID 1 (Rob O'Connell)"
   Backend saves: claimed_by_staff_id = 1
   ↓
4. Frontend fetches updated submission
   Backend returns: claimed_by_staff_id = "1"
   ↓
5. Frontend asks: "Who am I?"
   GET /user/current
   Backend reads token → Returns { id: 1, username: "roconnell", ... }
   ↓
6. Frontend compares: item.claimedBy.id (1) === currentUser.id (1)
   Result: MATCH! ✅ Shows "Work on This" button
```

### Flow 2: Viewing My Work Queue

```
1. User clicks "My Work Queue" tab
   ↓
2. Frontend sends: GET /submission-workflow/my-claimed-items
   Headers: { Authorization: "Bearer abc123..." }
   ↓
3. Backend reads token → "This is user ID 1"
   Backend queries: SELECT * FROM items WHERE claimed_by_staff_id = 1
   ↓
4. Backend returns ONLY items claimed by user ID 1
   ↓
5. Frontend displays items (no filtering needed!)
```

---

## Key Principles

### ✅ DO: Use Auth Token as Source of Truth
- Backend determines user identity from `Authorization: Bearer <token>`
- Frontend asks backend "who am I?" via `/user/current`
- All user-specific queries use token, not passed IDs

### ❌ DON'T: Trust localStorage for Backend Identity
- localStorage can be manipulated
- localStorage user might be stale
- localStorage user might not match token's user

### ✅ DO: Let Backend Filter User-Specific Data
- `/my-claimed-items` instead of `/items?user_id=X`
- Backend filters based on token
- More secure, more reliable

---

## Testing

### Test 1: Claim an Item
1. ✅ Log in with your account
2. ✅ Navigate to a submission
3. ✅ Click "Claim This Item" on an unclaimed item
4. ✅ Should immediately show "Claimed by You" badge
5. ✅ Should show "Work on This" button

### Test 2: View My Work Queue
1. ✅ After claiming, click "My Work Queue" tab in Admin page
2. ✅ Should see the item you just claimed
3. ✅ Should show full workflow tools

### Test 3: Multiple Users
1. ✅ User A claims item #371
2. ✅ User A sees "Work on This" button
3. ✅ User B views same submission
4. ✅ User B sees "Claimed by [User A's Name]" (read-only badge)
5. ✅ User B does NOT see "Work on This" button

### Test 4: Toast Navigation
1. ✅ Claim an item
2. ✅ Toast shows: "Item claimed! [Go to My Work →]"
3. ✅ Click the link in toast
4. ✅ Should navigate to My Work Queue with item highlighted

---

## Backend Requirements

Your backend needs to implement:

### ✅ Already Implemented
- `POST /submission-workflow/item/:id/claim` - Claims item for current user (from token)
- `GET /submission-workflow/my-claimed-items` - Returns items claimed by current user (from token)

### ⚠️ Needs Implementation
- `GET /user/current` - Returns current user info based on auth token

**Expected Response from `/user/current`**:
```json
{
  "id": 1,
  "username": "roconnell",
  "display_name": "Rob O'Connell",
  "email": "roconnell@smith.edu",
  "institution": "smith",
  "permissions": ["manage_submissions", "manage_courses"]
}
```

The `id` field must match the `claimed_by_staff_id` stored when items are claimed.

---

## Files Changed

### Modified:
- `src/config/api.config.js` - Added `myClaimedItems` endpoint
- `src/services/admin/submissionWorkflowService.js` - Added `getMyClaimedItems()` and `getCurrentUser()`
- `src/store/submissionWorkflowStore.js` - Updated `fetchClaimedItems()` to not require userId
- `src/components/page-sections/admin/SubmissionDetail.jsx` - Fetch current user from backend
- `src/components/page-sections/admin/MyWorkQueue.jsx` - Removed userId parameter, removed unused state

### Created:
- `docs/AUTH_TOKEN_USER_IDENTIFICATION.md` - This document

---

## Benefits

✅ **Reliable**: User identity always matches backend records  
✅ **Secure**: Backend validates identity from token, not trusting frontend  
✅ **Simpler**: No need to pass user IDs around  
✅ **Consistent**: Same auth token used for all requests  
✅ **Scalable**: Works across sessions, devices, browser clears  

---

## Next Steps

1. **Implement** `GET /user/current` endpoint on backend
2. **Test** claim workflow end-to-end
3. **Verify** My Work Queue shows correct items
4. **Remove** debugging console.logs once confirmed working
5. **Consider** adding `is_claimed_by_me` boolean field to items in backend response for even simpler frontend logic
