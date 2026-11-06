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
use app\services\PublicResourceFields;
use app\services\ResourceUsageService;
use yii\filters\auth\HttpBearerAuth;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

class ResourceController extends ActiveController
{
    private const RESOURCE_STAFF_ACTIONS = ['create', 'update', 'delete', 'add-link', 'delete-link', 'usage'];

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
        return Yii::$container->get(\app\services\ResourceMutationService::class)
            ->update($id, Yii::$app->request->getBodyParams());
    }

    public function actionAddLink($resourceId)
    {
        return Yii::$container->get(\app\services\ResourceMutationService::class)
            ->addLink($resourceId, Yii::$app->request->getBodyParams());
    }

    public function actionDeleteLink($id)
    {
        return Yii::$container->get(\app\services\ResourceMutationService::class)->deleteLink($id);
    }

    public function actionUsage($id)
    {
        $usage = Yii::$container->get(ResourceUsageService::class)->forResource($id);
        if ($usage === null) {
            throw new NotFoundHttpException('Resource not found.');
        }

        return $usage;
    }


    /** Search for resources by name with their course offering information. */
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
            
            $debugSql = $rawSql;
                
            $resources = $query->all();
            
            $reserves = [];
            
            foreach ($resources as $resource) {
                $resourceFields = PublicResourceFields::serialize($resource, Yii::$app->user->identity);
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
                            'title' => $resourceFields['name'] ?? null,
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
                    
                    if (array_key_exists('internal_note', $resourceFields)) {
                        $reserve['internal_note'] = $resourceFields['internal_note'];
                    }
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
            'only' => array_merge(['index', 'view', 'search'], self::RESOURCE_STAFF_ACTIONS),
            'optional' => ['index', 'view', 'search'],
        ];

        // CORS configuration for cross-domain requests
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => \app\components\CorsOriginPolicy::allowedOrigins(),
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Allow-Headers' => ['*'],
            ],
        ];

        return \app\components\CorsOriginPolicy::corsFirst($behaviors);
    }

    public function beforeAction($action)
    {
        if (!parent::beforeAction($action)) {
            return false;
        }

        if (in_array($action->id, self::RESOURCE_STAFF_ACTIONS, true)) {
            $this->assertResourceStaffAccess(Yii::$app->user->identity);
        }

        return true;
    }

    private function assertResourceStaffAccess($identity): void
    {
        if (!Roles::isStaff($identity->role ?? null)) {
            throw new ForbiddenHttpException('Resource access requires a staff or admin role.');
        }
    }
}
