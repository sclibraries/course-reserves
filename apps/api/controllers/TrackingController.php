<?php
namespace app\controllers;

use app\components\ApiAccessBehaviors;
use app\components\Roles;
use Yii;
use yii\rest\ActiveController;
use yii\filters\ContentNegotiator;
use yii\web\Response;
use yii\filters\Cors;

class TrackingController extends ActiveController
{
    // Specify the model class this controller will use.
    public $modelClass = 'app\models\TrackingEvent';

    /**
     * {@inheritdoc}
     */
    public function behaviors()
    {
        $behaviors = parent::behaviors();
        $behaviors['contentNegotiator'] = [
            'class' => ContentNegotiator::class,
            'formats' => [
                'application/json' => Response::FORMAT_JSON,
            ],
        ];
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => Yii::$app->params['corsOrigins'] ?? [],
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 3600,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
                'Access-Control-Expose-Headers' => ['X-Pagination-Total-Count', 'X-Pagination-Page-Count'],
            ],
        ];
        return ApiAccessBehaviors::withRoleRules($behaviors, [
            'index' => Roles::STAFF,
            'view' => Roles::STAFF,
            'update' => Roles::STAFF,
            'delete' => Roles::STAFF,
            'analytics' => Roles::STAFF,
            'course-detail' => Roles::STAFF,
        ], ['create', 'top-courses']);
    }

    public function actions()
    {
        $actions = parent::actions();
        // Customize the index action
        $actions['index']['prepareDataProvider'] = function ($action) {
            $modelClass = $this->modelClass;
            $query = $modelClass::find();
            // Apply filters if provided
            $this->applyFilters($query);
            // Set a high limit but allow override
            $pageSize = \Yii::$app->request->get('per-page', 20);
            
            return new \yii\data\ActiveDataProvider([
                'query' => $query,
                'pagination' => [
                    'pageSize' => (int)$pageSize,
                ],
                'sort' => [
                    'defaultOrder' => ['created_at' => SORT_DESC]
                ],
            ]);
        };
        
        return $actions;
    }

    public function actionTopCourses()
    {
        // Start with a base query
        $query = $this->modelClass::find();
    
        // Apply filters if provided
        $this->applyFilters($query);
    
        // Check if a specific college is provided
        $college = \Yii::$app->request->get('college');
        if ($college) {
            $query->andWhere(['college' => $college]);
        }
    
        // Get top courses by access count
        $topCourses = (clone $query)
            ->select([
                'course_name as name',
                'COUNT(*) as count',
                'college',
                'term',
                'instructor'
            ])
            ->andWhere(['IS NOT', 'course_name', null])
            ->andWhere(['event_type' => 'course_access']) // Only count actual course access events
            ->groupBy(['course_name', 'college', 'term', 'instructor'])
            ->orderBy(['count' => SORT_DESC])
            ->limit(10)
            ->asArray()
            ->all();
    
        // Decode the instructor field for each course
        foreach ($topCourses as &$course) {
            if (!empty($course['instructor'])) {
                $instructors = json_decode($course['instructor'], true);
                $course['instructors'] = array_column($instructors, 'name'); // Extract names into an array
            } else {
                $course['instructors'] = [];
            }
            unset($course['instructor']); // Remove the original instructor field
        }
    
        return [
            'topCourses' => $topCourses,
        ];
    } 
    /**
     * Get analytics data for charts and dashboards
     */
    public function actionAnalytics()
    {
        // Start with a base query that we can filter
        $query = $this->modelClass::find();
        
        // Apply any filters the client requested
        $this->applyFilters($query);
        
        // Create a clone of the filtered query for counting
        $countQuery = clone $query;
        $totalCount = $countQuery->count();
        
        // College event counts
        $collegeData = (clone $query)->select(['college', 'COUNT(*) as value'])
            ->groupBy(['college'])
            ->asArray()
            ->all();
            
        // Event type distribution
        $eventTypeData = (clone $query)->select(['event_type as name', 'COUNT(*) as value'])
            ->groupBy(['event_type'])
            ->asArray()
            ->all();
            
        // Top courses by access count - use WHERE instead of HAVING
        $topCourses = (clone $query)
        ->select([
            'course_name as name', 
            'COUNT(*) as count',
            'college',
            'term' // Add term field
        ])
        ->andWhere(['IS NOT', 'course_name', null])
        ->andWhere(['event_type' => 'course_access']) // Only count actual course access events
        ->groupBy(['course_name', 'college', 'term']) // Include term in group by
        ->orderBy(['count' => SORT_DESC])
        ->limit(10)
        ->asArray()
        ->all();
    
    // Get ALL courses for the table (no limit)
    $allCourses = (clone $query)
        ->select([
            'course_name as name', 
            'COUNT(*) as count',
            'college',
            'term' 
        ])
        ->andWhere(['IS NOT', 'course_name', null])
        ->andWhere(['event_type' => 'course_access']) 
        ->groupBy(['course_name', 'college', 'term'])
        ->orderBy(['count' => SORT_DESC])
        ->asArray()
        ->all();
    
    // Get available terms
        $terms = (clone $query)
        ->select(['term'])
        ->andWhere(['event_type' => 'course_access'])
        ->andWhere(['IS NOT', 'term', null])
        ->andWhere(['<>', 'term', 'N/A'])
        ->andWhere(['NOT LIKE', 'term', '%-%-%-%-%'])
        ->distinct()
        ->orderBy(['term' => SORT_DESC])
        ->column();
                
        $timeSeriesData = (clone $query)->select([
                'DATE(created_at) as date', 
                'COUNT(*) as count'
            ])
            ->groupBy(['DATE(created_at)'])
            ->orderBy(['date' => SORT_ASC])
            ->asArray()
            ->all();
            
        // Analyze metadata to extract actions (requires custom processing)
        $actionCounts = [];
        $events = (clone $query)->select(['metadata'])->asArray()->all();
        foreach ($events as $event) {
            if (!empty($event['metadata'])) {
                $metadata = json_decode($event['metadata'], true);
                if (isset($metadata['action'])) {
                    $action = $metadata['action'];
                    if (!isset($actionCounts[$action])) {
                        $actionCounts[$action] = 0;
                    }
                    $actionCounts[$action]++;
                }
            }
        }
        
        // Format action counts for the frontend
        $topActions = [];
        foreach ($actionCounts as $action => $count) {
            $topActions[] = ['action' => $action, 'count' => $count];
        }
        
        // Sort actions by count, descending
        usort($topActions, function($a, $b) {
            return $b['count'] - $a['count'];
        });
        
        // Limit to top 10 actions
        $topActions = array_slice($topActions, 0, 10);

        return [
            'collegeData' => $collegeData,
            'eventTypeData' => $eventTypeData,
            'topCourses' => $topCourses,
            'allCourses' => $allCourses, // Add this line
            'topActions' => $topActions,
            'timeSeriesData' => $timeSeriesData,
            'totalCount' => $totalCount,
            'terms' => $terms,
        ];
    }
    
    /**
     * Apply common filters to a query based on request parameters
     */
    private function applyFilters($query)
    {
        // Filter by college
        $college = \Yii::$app->request->get('college');
        if ($college) {
            $query->andWhere(['like', 'college', $college]);
        }
        
        // Filter by event_type
        $eventType = \Yii::$app->request->get('event-type');
        if ($eventType) {
            $query->andWhere(['event_type' => $eventType]);
        }
        
        // Filter by term
        $term = \Yii::$app->request->get('term');
        if ($term) {
            $query->andWhere(['term' => $term]);
        }
        
        // Filter by date range
        $startDate = \Yii::$app->request->get('start-date');
        $endDate = \Yii::$app->request->get('end-date');
        
        if ($startDate) {
            $query->andWhere(['>=', 'created_at', $startDate . ' 00:00:00']);
        }
        
        if ($endDate) {
            $query->andWhere(['<=', 'created_at', $endDate . ' 23:59:59']);
        }
        
        // Search across multiple fields
        $search = \Yii::$app->request->get('search');
        if ($search) {
            $query->andWhere([
                'or',
                ['like', 'course_name', $search],
                ['like', 'course_code', $search],
                ['like', 'college', $search],
                ['like', 'event_type', $search],
                ['like', 'term', $search],
                ['like', 'metadata', $search],
            ]);
        }
        
        return $query;
    }

    /**
     * Get detailed analytics for a specific course
     */

public function actionCourseDetail()
{
    $courseName = \Yii::$app->request->get('course-name');
    $college = \Yii::$app->request->get('college');
    
    if (!$courseName) {
        throw new \yii\web\BadRequestHttpException('Course name is required');
    }
    
    // Start with a base query for this specific course
    $query = $this->modelClass::find()
        ->andWhere(['course_name' => $courseName]);
        
    // Add college filter if provided
    if ($college) {
        $query->andWhere(['college' => $college]);
    }
    
    // Apply any additional filters (date range, etc.)
    $this->applyFilters($query);
    
    // Get total events for this course
    $totalEvents = (clone $query)->count();
    
    // Get unique sessions count (using ID as session identifier)
    $uniqueSessions = (clone $query)
        ->select(['id'])
        ->distinct()
        ->count();
    
    // Get event types distribution for this course
    $eventTypes = (clone $query)
        ->select(['event_type', 'COUNT(*) as count'])
        ->groupBy(['event_type'])
        ->orderBy(['count' => SORT_DESC])
        ->asArray()
        ->all();
    
    // Get data by terms for this course
    $termData = (clone $query)
        ->select([
            'term',
            'COUNT(*) as count',
            'COUNT(DISTINCT id) as uniqueSessions',
            'COUNT(DISTINCT event_type) as eventTypes'
        ])
        ->andWhere(['IS NOT', 'term', null])
        ->andWhere(['<>', 'term', 'N/A'])
        ->groupBy(['term'])
        ->orderBy(['term' => SORT_DESC])
        ->asArray()
        ->all();
    
    // Get recent events for this course (limited to last 100 for performance)
    $events = (clone $query)
        ->orderBy(['created_at' => SORT_DESC])
        ->limit(100)
        ->asArray()
        ->all();
    
    // Count terms where this course was active
    $termsActive = (clone $query)
        ->select(['term'])
        ->andWhere(['IS NOT', 'term', null])
        ->andWhere(['<>', 'term', 'N/A'])
        ->distinct()
        ->count();
    
    // Get instructor information (if available)
    $instructorInfo = (clone $query)
        ->select(['instructor'])
        ->andWhere(['IS NOT', 'instructor', null])
        ->andWhere(['<>', 'instructor', ''])
        ->limit(1)
        ->scalar();
    
    $instructors = [];
    if ($instructorInfo) {
        $decodedInstructors = json_decode($instructorInfo, true);
        if (is_array($decodedInstructors)) {
            $instructors = array_column($decodedInstructors, 'name');
        }
    }
    
    return [
        'courseName' => $courseName,
        'college' => $college,
        'totalEvents' => $totalEvents,
        'uniqueSessions' => $uniqueSessions,
        'termsActive' => $termsActive,
        'eventTypes' => $eventTypes,
        'termData' => $termData,
        'events' => $events,
        'instructors' => $instructors
    ];
}
}
