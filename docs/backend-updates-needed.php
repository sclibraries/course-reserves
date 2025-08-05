<?php
/**
 * CORRECTED: Primary Link Visibility Handling - SIMPLIFIED VERSION
 * 
 * The primary link visibility dates are stored directly in the resources table,
 * NOT as separate entries in resource_links. This is much simpler.
 */

// CORRECTED APPROACH: No code needed!
// The primary link visibility fields are already being saved as part of the main resource
// because they're included in $data and applied via $resource->attributes = $data;
//
// The fields use_primary_link_visibility, primary_link_start_visibility, 
// and primary_link_end_visibility are automatically saved to the resources table.

/**
 * COMPLETE CORRECTED actionUpdate METHOD
 * This version removes the unnecessary primary link creation in resource_links
 */

class ResourcesController 
{
    public function actionUpdate($id)
    {
        // Find the resource by id.
        $resource = Resources::findOne($id);
        if (!$resource) {
            throw new \yii\web\NotFoundHttpException("Resource not found");
        }
        
        // Get the raw JSON body data.
        $data = Yii::$app->request->getBodyParams();
        
        // Extract metadata and links from the payload
        $metadataData = isset($data['metadata']) ? $data['metadata'] : [];
        $linksData = isset($data['links']) ? $data['links'] : [];
        unset($data['metadata'], $data['links']);
        
        // Optionally, adjust field names
        if (isset($data['folder'])) {
            $data['folder_id'] = $data['folder'];
            unset($data['folder']);
        }

        if (isset($data['title'])) {
            $data['name'] = $data['title'];
            unset($data['title']);
        }

        if (isset($data['link'])) {
            $data['item_url'] = $data['link'];
            unset($data['link']);
        }

        if (isset($data['notes'])) {
            $data['description'] = $data['notes'];
            unset($data['notes']);
        }
        
        // Convert boolean fields to integers for database
        if (isset($data['use_proxy'])) {
            $data['use_proxy'] = $data['use_proxy'] ? 1 : 0;
        }
        if (isset($data['use_primary_link_visibility'])) {
            $data['use_primary_link_visibility'] = $data['use_primary_link_visibility'] ? 1 : 0;
        }
        
        // Start transaction
        $transaction = Yii::$app->db->beginTransaction();
        
        try {
            // Load the remaining data into the resource model.
            // This automatically includes use_primary_link_visibility, 
            // primary_link_start_visibility, and primary_link_end_visibility
            $resource->attributes = $data;
            
            // Save the main resource.
            if (!$resource->save()) {
                throw new \yii\web\BadRequestHttpException("Failed to save resource: " . json_encode($resource->errors));
            }
            
            // Process the metadata
            foreach ($metadataData as $field => $value) {
                $meta = ResourceMetadata::find()
                        ->where(['resource_id' => $id, 'field_name' => $field])
                        ->one();
                if (!$meta) {
                    $meta = new ResourceMetadata();
                    $meta->resource_id = $id;
                    $meta->field_name = $field;
                }
                $meta->field_value = $value;
                if (!$meta->save()) {
                    throw new \yii\web\BadRequestHttpException("Failed to save metadata: " . json_encode($meta->errors));
                }
            }
            
            // Process additional links - delete existing ones first
            ResourceLinks::deleteAll(['resource_id' => $id]);
            
            // Now add the new additional links
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
                $link->order = $index + 1; // Additional links start from order 1
                
                // Add link visibility fields
                $link->use_link_visibility = isset($linkData['use_link_visibility']) && $linkData['use_link_visibility'] ? 1 : 0;
                $link->start_visibility = !empty($linkData['start_visibility']) ? $linkData['start_visibility'] : null;
                $link->end_visibility = !empty($linkData['end_visibility']) ? $linkData['end_visibility'] : null;
                
                if (!$link->save()) {
                    throw new \yii\web\BadRequestHttpException("Failed to save link: " . json_encode($link->errors));
                }
            }
            
            // NO PRIMARY LINK CREATION NEEDED!
            // The primary link visibility fields are already saved to the resources table above
            
            $transaction->commit();
            
            // Return the updated resource with its relations
            return [
                'resource' => $resource,
                'links' => ResourceLinks::find()
                    ->where(['resource_id' => $id])
                    ->orderBy(['order' => SORT_ASC])
                    ->all(),
                'metadata' => ResourceMetadata::findAll(['resource_id' => $id])
            ];
        } catch (\Exception $e) {
            $transaction->rollBack();
            throw $e;
        }
    }
}
?>
