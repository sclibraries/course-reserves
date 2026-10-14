<?php

namespace app\controllers;

use yii\filters\Cors;
use yii\data\ActiveDataProvider;
use app\models\Resources;
use app\models\ResourceMetadata;
use app\models\CourseResources;
use Yii;
use yii\rest\ActiveController;
use app\models\ResourceLinks;
use app\components\Roles;
use yii\filters\auth\HttpBearerAuth;
use yii\web\ForbiddenHttpException;

class ResourceController extends ActiveController
{
    private const RESOURCE_WRITE_ACTIONS = ['create', 'update', 'delete', 'add-link', 'delete-link'];

    public $modelClass = 'app\models\Resources';

    public function actions()
    {
        $actions = parent::actions();
        unset($actions['update']);

        // Override the index action's data provider
        $actions['index']['prepareDataProvider'] = function() {
            try {
                // Use pagination to limit the number of rows per request.
                // Adjust 'pageSize' as needed (e.g., 50, 100, etc.)
                return new ActiveDataProvider([
                    'query' => $this->buildSearchQuery(),
                    'pagination' => [
                        'pageSize' => 100, // Limits rows per page to reduce memory usage
                    ],
                ]);
            } catch (\Exception $e) {
                Yii::error("Error preparing data provider: " . $e->getMessage());
                throw $e; // Re-throw after logging the error
            }
        };

        return $actions;
    }

    /**
     * Build the search query with necessary filters, joins, and groupings.
     *
     * @return \yii\db\ActiveQuery
     */
    protected function buildSearchQuery()
    {
        $query = Resources::find()
            ->select([
                'resources.*',
                'material_types.name AS material_type_name',
                // Using COALESCE to ensure a value of 0 if there are no course resources.
                'COALESCE((SELECT COUNT(offering_id) FROM course_resources 
                        WHERE resource_id = resources.resource_id), 0) AS course_count'
            ])
            ->joinWith(['materialType'])
            ->with(['metadata']) // Eager load metadata; evaluate if this is necessary for every request.
            ->groupBy('resources.resource_id')
            ->orderBy('resources.created_at DESC');

        // Apply filters based on request parameters
        $query->andFilterWhere(['like', 'resources.name', Yii::$app->request->get('name')])
              ->andFilterWhere(['resources.material_type_id' => Yii::$app->request->get('type')]);

        $this->applyDateFilters($query);
        $this->applyMetadataFilters($query);

        return $query;
    }

    /**
     * Apply date filters to the query.
     *
     * @param \yii\db\ActiveQuery $query
     */
    protected function applyDateFilters($query)
    {
        if ($start = Yii::$app->request->get('start_date')) {
            $query->andWhere(['>=', 'resources.created_at', $start]);
        }
        if ($end = Yii::$app->request->get('end_date')) {
            $query->andWhere(['<=', 'resources.created_at', $end]);
        }
    }

    /**
     * Apply metadata filters to the query.
     *
     * @param \yii\db\ActiveQuery $query
     */
    protected function applyMetadataFilters($query)
    {
        $metadataFilters = Yii::$app->request->get('metadata', []);
        foreach ($metadataFilters as $field => $value) {
            $query->andWhere([
                'EXISTS', 
                ResourceMetadata::find()
                    ->where('resource_id = resources.resource_id')
                    ->andWhere(['field_name' => $field])
                    ->andFilterWhere(['like', 'field_value', $value])
            ]);
        }
    }


    public function actionUpdate($id)
    {
        // Find the resource by id.
        $resource = Resources::findOne($id);
        if (!$resource) {
            throw new \yii\web\NotFoundHttpException("Resource not found");
        }
        
        // Get the raw JSON body data.
        $data = Yii::$app->request->getBodyParams();
        
        // Extract metadata, links, and visibility data from the payload
        $metadataData = isset($data['metadata']) ? $data['metadata'] : [];
        $linksData = isset($data['links']) ? $data['links'] : [];
        
        // Extract visibility fields for course-resource level handling
        $visibilityData = [];
        if (isset($data['start_visibility'])) {
            $visibilityData['start_visibility'] = $data['start_visibility'];
        }
        if (isset($data['end_visibility'])) {
            $visibilityData['end_visibility'] = $data['end_visibility'];
        }
        if (isset($data['use_resource_visibility'])) {
            $visibilityData['use_resource_visibility'] = $data['use_resource_visibility'] ? 1 : 0;
        }
        if (isset($data['primary_link_start_visibility'])) {
            $visibilityData['primary_link_start_visibility'] = $data['primary_link_start_visibility'];
        }
        if (isset($data['primary_link_end_visibility'])) {
            $visibilityData['primary_link_end_visibility'] = $data['primary_link_end_visibility'];
        }
        if (isset($data['use_primary_link_visibility'])) {
            $visibilityData['use_primary_link_visibility'] = $data['use_primary_link_visibility'] ? 1 : 0;
        }
        
        // Get course_resource_id if provided (to know which course-resource to update)
        $courseResourceId = $data['course_resource_id'] ?? null;
        
        unset($data['metadata'], $data['links'], $data['course_resource_id'], 
              $data['start_visibility'], $data['end_visibility'], $data['use_resource_visibility'],
              $data['primary_link_start_visibility'], $data['primary_link_end_visibility'], $data['use_primary_link_visibility']);
        
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
        // Note: Visibility fields are now handled at course-resource level
        
        // Start transaction
        $transaction = Yii::$app->db->beginTransaction();
        
        try {
            // Load the remaining data into the resource model.
            $resource->attributes = $data;
            
            // Save the main resource.
            if (!$resource->save()) {
                throw new \yii\web\BadRequestHttpException("Failed to save resource: " . json_encode($resource->errors));
            }
            
            // Update course-resource visibility if we have visibility data
            if (!empty($visibilityData)) {
                if ($courseResourceId) {
                    // Update specific course-resource relationship
                    $courseResource = CourseResources::findOne($courseResourceId);
                    if ($courseResource) {
                        $courseResource->attributes = $visibilityData;
                        if (!$courseResource->save()) {
                            throw new \yii\web\BadRequestHttpException("Failed to save course-resource visibility: " . json_encode($courseResource->errors));
                        }
                    }
                } else {
                    // Update all course-resource relationships for this resource
                    $courseResources = CourseResources::findAll(['resource_id' => $id]);
                    foreach ($courseResources as $courseResource) {
                        $courseResource->attributes = $visibilityData;
                        if (!$courseResource->save()) {
                            throw new \yii\web\BadRequestHttpException("Failed to save course-resource visibility: " . json_encode($courseResource->errors));
                        }
                    }
                }
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
            
            // The visibility fields are now managed at course-resource level
            
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

    /**
     * Add a new link to a resource
     */
    public function actionAddLink($resourceId)
    {
        $resource = Resources::findOne($resourceId);
        if (!$resource) {
            throw new \yii\web\NotFoundHttpException("Resource not found");
        }
        
        $link = new ResourceLinks();
        $link->load(Yii::$app->request->getBodyParams(), '');
        $link->resource_id = $resourceId;
        
        // If order not specified, put it at the end
        if (!$link->order) {
            $lastLink = ResourceLinks::find()
                ->where(['resource_id' => $resourceId])
                ->orderBy(['order' => SORT_DESC])
                ->one();
            $link->order = $lastLink ? $lastLink->order + 1 : 1;
        }
        
        if ($link->save()) {
            return $link;
        } else {
            return $link->errors;
        }
    }

    /**
     * Delete a link
     */
    public function actionDeleteLink($id)
    {
        $link = ResourceLinks::findOne($id);
        if (!$link) {
            throw new \yii\web\NotFoundHttpException("Link not found");
        }
        
        $link->delete();
        return ['success' => true];
    }


    /**
     * Search for resources by name with optional term filtering
     * Returns resources with their course offering information
     * 
     * @return array
     */
    public function actionSearch()
    {
        try {
            $name = Yii::$app->request->get('name');
            $termId = Yii::$app->request->get('term_id');
            
            if (empty($name)) {
                throw new \yii\web\BadRequestHttpException('Resource name is required');
            }
            
            // Build the query - load all resources matching name with their relationships
            // Don't filter by term_id in the main query as it converts LEFT JOIN to INNER JOIN
            $query = Resources::find()
                ->with([
                    'courseResources.courseOffering.course.courseInstructors.instructor'
                ])
                ->where(['like', 'resources.name', $name]);
            
            // Log the raw SQL for debugging
            $rawSql = $query->createCommand()->getRawSql();
            Yii::error("Search SQL for name='$name', term_id='$termId': " . $rawSql, __METHOD__);
            
            // Also return SQL in response for debugging (remove in production)
            $debugSql = $rawSql;
                
            $resources = $query->all();
            
            $reserves = [];
            
            foreach ($resources as $resource) {
                foreach ($resource->courseResources as $courseResource) {
                    $offering = $courseResource->courseOffering;
                    if (!$offering) continue;
                    
                    // If term_id specified, filter offerings here (in PHP, not SQL)
                    if ($termId && $offering->term_id !== $termId) {
                        continue;
                    }
                    
                    $course = $offering->course;
                    if (!$course) continue;
                    
                    // Build instructors array
                    $instructorObjects = [];
                    foreach ($course->courseInstructors as $courseInstructor) {
                        $instructor = $courseInstructor->instructor;
                        if ($instructor) {
                            $instructorObjects[] = [
                                'id' => $instructor->folio_instructor_id ?? null,
                                'userId' => $instructor->folio_instructor_id ?? null,
                                'name' => $instructor->name ?? null,
                                'barcode' => $instructor->barcode ?? null,
                                'patronGroup' => null,
                                'patronGroupObject' => null,
                                'courseListingId' => $offering->folio_course_id ?? null,
                                'metadata' => [
                                    'createdDate' => $instructor->created_at ?? null,
                                    'createdByUserId' => null,
                                    'updatedDate' => $instructor->created_at ?? null,
                                    'updatedByUserId' => null,
                                ]
                            ];
                        }
                    }
                    
                    // Build the reserve object matching Folio structure
                    $reserve = [
                        'id' => null, // No equivalent in our system
                        'courseListingId' => $offering->folio_course_id ?? null,
                        'itemId' => null, // No equivalent
                        'copiedItem' => [
                            'barcode' => null,
                            'temporaryLocationId' => null,
                            'permanentLocationId' => $course->location_id ?? null,
                            'title' => $resource->name ?? null,
                            'contributors' => [], // No equivalent in our system
                            'publication' => [], // No equivalent
                            'callNumber' => null, // Could be in metadata
                            'instanceId' => null,
                            'instanceHrid' => null,
                            'instanceDiscoverySuppress' => false,
                            'holdingsId' => null,
                        ],
                        'metadata' => [
                            'createdDate' => $resource->created_at ?? null,
                            'createdByUserId' => null,
                            'updatedDate' => $resource->created_at ?? null,
                            'updatedByUserId' => null,
                        ],
                        'course' => [
                            'id' => $offering->folio_course_id ?? null,
                            'name' => $course->course_name ?? null,
                            'departmentId' => $course->department_id ?? null,
                            'departmentObject' => [
                                'id' => $course->department_id ?? null,
                                'name' => $course->department_name ?? null,
                                'description' => $course->department_name ?? null,
                                'metadata' => [
                                    'createdDate' => null,
                                    'createdByUserId' => null,
                                    'updatedDate' => null,
                                    'updatedByUserId' => null,
                                ]
                            ],
                            'courseListingId' => $offering->folio_course_id ?? null,
                            'courseListingObject' => [
                                'id' => $offering->folio_course_id ?? null,
                                'locationId' => $course->location_id ?? null,
                                'locationObject' => [
                                    'id' => $course->location_id ?? null,
                                    'name' => $course->location_name ?? null,
                                    'code' => null,
                                    'discoveryDisplayName' => $course->location_name ?? null,
                                    'isActive' => true,
                                    'institutionId' => null,
                                    'campusId' => null,
                                    'libraryId' => null,
                                    'primaryServicePoint' => null,
                                    'servicePointIds' => [],
                                ],
                                'termId' => $offering->term_id ?? null,
                                'termObject' => [
                                    'id' => $offering->term_id ?? null,
                                    'name' => $offering->term_name ?? null,
                                    'startDate' => $offering->start_date ?? null,
                                    'endDate' => $offering->end_date ?? null,
                                ],
                                'courseTypeId' => null,
                                'courseTypeObject' => null,
                                'instructorObjects' => $instructorObjects,
                                'metadata' => [
                                    'createdDate' => $offering->created_at ?? null,
                                    'createdByUserId' => null,
                                    'updatedDate' => $offering->created_at ?? null,
                                    'updatedByUserId' => null,
                                ]
                            ],
                            'courseNumber' => $course->course_number ?? null,
                            'metadata' => [
                                'createdDate' => $course->created_at ?? null,
                                'createdByUserId' => null,
                                'updatedDate' => $course->created_at ?? null,
                                'updatedByUserId' => null,
                            ]
                        ]
                    ];
                    
                    $reserves[] = $reserve;
                }
            }
            
            return [
                'message' => 'success',
                'code' => 200,
                'debug_sql' => $debugSql ?? null, // Remove this in production
                'debug_resource_count' => count($resources),
                'debug_reserve_count' => count($reserves),
                'data' => [
                    'reserves' => $reserves
                ]
            ];
            
        } catch (\yii\web\BadRequestHttpException $e) {
            Yii::$app->response->statusCode = 400;
            return [
                'message' => $e->getMessage(),
                'code' => 400,
                'data' => null
            ];
        } catch (\Exception $e) {
            Yii::error("Error in resource search: " . $e->getMessage());
            Yii::$app->response->statusCode = 500;
            return [
                'message' => 'Internal server error',
                'code' => 500,
                'data' => null
            ];
        }
    }

    public function behaviors()
    {
        $behaviors = parent::behaviors();

        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            'only' => self::RESOURCE_WRITE_ACTIONS,
        ];

        // CORS configuration for cross-domain requests
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => array_merge([
                    'http://localhost:5173',
                ], Yii::$app->params['corsOrigins'] ?? []),
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Allow-Headers' => ['*'],
            ],
        ];

        return $behaviors;
    }

    public function beforeAction($action)
    {
        if (!parent::beforeAction($action)) {
            return false;
        }

        if (in_array($action->id, self::RESOURCE_WRITE_ACTIONS, true)) {
            $this->assertResourceWriteAccess(Yii::$app->user->identity);
        }

        return true;
    }

    private function assertResourceWriteAccess($identity): void
    {
        if (!Roles::isStaff($identity->role ?? null)) {
            throw new ForbiddenHttpException('Resource writes require a staff or admin role.');
        }
    }
}
