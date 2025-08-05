# Required Backend Updates for Link Visibility

## 1. Update your ResourceController actionUpdate method

Find this section in your actionUpdate method (around line 170-190):

```php
// Process links - first delete existing ones
ResourceLinks::deleteAll(['resource_id' => $id]);

// Now add the new links
foreach ($linksData as $index => $linkData) {
    // Skip empty URLs
    if (empty($linkData['url'])) {
        continue;
    }
    
    $link = new ResourceLinks();
    $link->resource_id = $id;
    $link->url = $linkData['url'];
    $link->title = $linkData['title'] ?? null;
    $link->description = $linkData['description'] ?? null;
    $link->use_proxy = isset($linkData['use_proxy']) && $linkData['use_proxy'] ? 1 : 0;
    $link->order = $index + 1;
    
    if (!$link->save()) {
        throw new \yii\web\BadRequestHttpException("Failed to save link: " . json_encode($link->errors));
    }
}
```

**Replace it with this:**

```php
// Handle visibility mode logic
if (isset($data['visibility_mode']) && $data['visibility_mode'] === 'link') {
    // For link visibility mode, clear resource-level visibility dates
    $resource->start_visibility = null;
    $resource->end_visibility = null;
}

// Process links - first delete existing ones
ResourceLinks::deleteAll(['resource_id' => $id]);

// Now add the new links
foreach ($linksData as $index => $linkData) {
    // Skip empty URLs
    if (empty($linkData['url'])) {
        continue;
    }
    
    $link = new ResourceLinks();
    $link->resource_id = $id;
    $link->url = $linkData['url'];
    $link->title = $linkData['title'] ?? null;
    $link->description = $linkData['description'] ?? null;
    $link->use_proxy = isset($linkData['use_proxy']) && $linkData['use_proxy'] ? 1 : 0;
    $link->order = $index + 1;
    
    // NEW: Add link visibility fields
    $link->use_link_visibility = isset($linkData['use_link_visibility']) && $linkData['use_link_visibility'] ? 1 : 0;
    $link->start_visibility = !empty($linkData['start_visibility']) ? $linkData['start_visibility'] : null;
    $link->end_visibility = !empty($linkData['end_visibility']) ? $linkData['end_visibility'] : null;
    
    if (!$link->save()) {
        throw new \yii\web\BadRequestHttpException("Failed to save link: " . json_encode($link->errors));
    }
}

// IMPORTANT: Handle primary URL visibility for link mode
if (isset($data['visibility_mode']) && $data['visibility_mode'] === 'link' && !empty($resource->item_url)) {
    // Create a resource_links entry for the primary URL so it can have individual visibility
    $primaryLink = new ResourceLinks();
    $primaryLink->resource_id = $id;
    $primaryLink->url = $resource->item_url;
    $primaryLink->title = 'Primary Resource Link';
    $primaryLink->description = null;
    $primaryLink->use_proxy = $resource->use_proxy;
    $primaryLink->order = 0; // Put primary link first
    
    // For link visibility mode, apply the resource-level dates to the primary link
    if (isset($data['start_visibility']) || isset($data['end_visibility'])) {
        $primaryLink->use_link_visibility = 1;
        $primaryLink->start_visibility = !empty($data['start_visibility']) ? $data['start_visibility'] : null;
        $primaryLink->end_visibility = !empty($data['end_visibility']) ? $data['end_visibility'] : null;
    }
    
    if (!$primaryLink->save()) {
        throw new \yii\web\BadRequestHttpException("Failed to save primary link: " . json_encode($primaryLink->errors));
    }
}
```

## 2. Update your ResourceLinks model

In your `app/models/ResourceLinks.php` file, update the `rules()` method to include the new fields:

```php
public function rules()
{
    return [
        [['resource_id', 'url'], 'required'],
        [['resource_id', 'use_proxy', 'order', 'use_link_visibility'], 'integer'],
        [['description'], 'string'],
        [['created_at', 'start_visibility', 'end_visibility'], 'safe'],
        [['url'], 'string', 'max' => 2048],
        [['title'], 'string', 'max' => 255],
        [['resource_id'], 'exist', 'skipOnError' => true, 'targetClass' => Resources::className(), 'targetAttribute' => ['resource_id' => 'resource_id']],
    ];
}
```

## 3. Update your Resources model

In your `app/models/Resources.php` file, add the visibility_mode field to the rules:

```php
public function rules()
{
    return [
        // ... your existing rules ...
        [['visibility_mode'], 'string'],
        [['visibility_mode'], 'in', 'range' => ['record', 'link']],
        // ... rest of existing rules ...
    ];
}
```

## 4. Understanding the Two Visibility Modes

### **Record Visibility Mode (Default)**
- Uses `resources.start_visibility` and `resources.end_visibility` 
- Controls the entire resource (including primary URL and all additional links)
- Primary URL visibility controlled by resource-level dates

### **Link Visibility Mode**
- Resource record itself is always visible to students
- Primary URL (`item_url`) gets copied to `resource_links` table with individual visibility
- Additional links in `resource_links` table have individual visibility
- `resources.start_visibility` and `resources.end_visibility` are cleared (set to NULL)

## 5. Data Flow

**When frontend sends `visibility_mode: 'link'`:**
1. Resource-level visibility dates are cleared
2. Primary URL is duplicated into `resource_links` with `order = 0` 
3. Primary URL inherits the visibility dates from the form
4. Additional links get their own individual visibility dates

**When frontend sends `visibility_mode: 'record'`:**
1. Resource-level visibility dates are used
2. No entry created in `resource_links` for primary URL
3. Additional links still saved but their visibility is ignored
4. Entire resource controlled by resource-level dates

## 6. Test the update

After making these changes:

1. Run the SQL migration you created earlier
2. Test the update endpoint with your payload
3. Verify that the new fields are being saved to the database

The payload you showed should now work correctly and save the link visibility fields to your `resource_links` table.
