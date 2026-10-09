<?php

namespace app\controllers;

use Yii;
use yii\rest\ActiveController;
use yii\filters\auth\HttpBearerAuth;
use yii\filters\Cors;
use yii\web\NotFoundHttpException;
use yii\web\BadRequestHttpException;
use yii\web\ServerErrorHttpException;
use app\models\Courses;
use app\models\Resources;
use app\models\CourseResources;
use app\models\MaterialTypes;
use app\models\ResourceMetadata;
use app\models\CourseOfferings;
use app\models\ResourceLinks;
use app\services\SubmissionCourseScaffoldService;

class CourseController extends ActiveController
{
    public $modelClass = 'app\models\Courses';

    public function init()
    {
        parent::init();
        \Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
    }

    /**
     * {@inheritdoc}
     */
    public function behaviors()
    {
        $behaviors = parent::behaviors();

        // JWT auth
        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::className(),
            'except' => ['options', 'exists','search-resources', 'resources', 'get-resources', 'check-unique-id', 'get-merged-resources'],
        ];

        // CORS
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => array_merge([
                    'http://localhost:5173',
                    'http://localhost:8080',
                ], Yii::$app->params['corsOrigins'] ?? []),
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 3600,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
                'Access-Control-Expose-Headers' => [],
            ],
        ];

        // Access control if you want to limit creation/updating
        $behaviors['access'] = [
            'class' => \yii\filters\AccessControl::class,
            'only' => [
                'create', 
                'update', 
                'delete', 
                'file-upload', 
                'link-resource' ,
                'reuse-resource', 
                'create-from-folio', 
                'create-resource', 
                'unlink-resource', 
                'check-course-exists', 
                'reactivate-course',
                'link-course-offering'
            ],
            'rules' => [
                [
                    'allow' => true,
                    'actions' => [
                        'create', 
                        'update', 
                        'delete', 
                        'file-upload', 
                        'link-resource',
                        'reuse-resource',
                        'create-from-folio', 
                        'create-resource',
                        'unlink-resource',
                        'check-course-exists',
                        'reactivate-course',
                        'link-course-offering'
                    ],
                    'roles' => ['@'],
                ],
                [
                    'allow' => false,
                ]
            ],
        ];

        return $behaviors;
    }

    public function actionOptions() {
        Yii::info('OPTIONS request received'); // Log that the OPTIONS action is hit
        Yii::$app->response->headers->set('Allow', 'POST, GET, OPTIONS');
    }

    /**
     * Override the default index action provider if needed.
     */
    public function actions()
    {
        $actions = parent::actions();

        // Customize the data provider for the index action if you want to filter courses
        $actions['index']['prepareDataProvider'] = function () {
            $query = Courses::find();

            // Example custom filters
            if (Yii::$app->request->get('department')) {
                $query->andWhere(['department_name' => Yii::$app->request->get('department')]);
            }
            if (Yii::$app->request->get('term')) {
                $query->andWhere(['term_name' => Yii::$app->request->get('term')]);
            }
            if (Yii::$app->request->get('location')) {
                $query->andWhere(['location_name' => Yii::$app->request->get('location')]);
            }
            if (Yii::$app->request->get('search')) {
                $search = Yii::$app->request->get('search');
                $query->andWhere(['like', 'course_name', $search]);
            }

            return $query->all();
        };

        return $actions;
    }

    //OLD FUNCTIONS FOR COURSE CREATION, CHECKING, AND UPDATING

    // public function actionCheckCourseExists()
    // {
    //     $data = Yii::$app->request->post();
    
    //     if (!isset($data['course_number'], $data['department_id'], $data['course_name'], $data['term_id'])) {
    //         throw new BadRequestHttpException('Missing required fields.');
    //     }
    
    //     $course = Courses::findOne([
    //         'course_number' => $data['course_number'],
    //         'department_id' => $data['department_id'],
    //         'course_name' => $data['course_name'],
    //     ]);
    
    //     if ($course) {
    //         // Check if specific offering exists (current folio_course_id)
    //         $offeringExists = CourseOfferings::find()->where([
    //             'course_id' => $course->course_id,
    //             'term_id' => $data['term_id']
    //         ])->exists();

    //         $offeringId = CourseOfferings::find()->where([
    //             'course_id' => $course->course_id,
    //             'term_id' => $data['term_id']
    //         ])->one();

    //         $offerings = \app\models\CourseOfferings::find()
    //         ->where(['course_id' => $course->course_id])
    //         ->asArray()
    //         ->all();

    //         $latestOffering = CourseOfferings::find()
    //             ->where(['course_id' => $course->course_id])
    //             ->orderBy(['start_date' => SORT_DESC])
    //             ->one();
    
    //         return [
    //             'exists' => true,
    //             'course' => $course,
    //             'offeringExists' => $offeringExists,
    //             'latest_term_name' => $latestOffering ? $latestOffering->term_name : null,
    //             'current_offering_id' => $latestOffering ? $latestOffering->offering_id : null,  
    //             'offerings' => $offerings,
    //             'offeringId' => $offeringId ? $offeringId->offering_id : null
    //         ];
    //     } else {
    //         return [
    //             'exists' => false,
    //             'course' => null,
    //             'offeringExists' => false,
    //             'latestOffering' => null,
    //             'offerings' => null
    //         ];
    //     }
    // }

    // public function actionCreateFromFolio()
    // {
    //     $body = Yii::$app->request->post();

    //     // Expecting $body to include both "course" and "offering" keys.
    //     if (!isset($body['course']) || !isset($body['offering'])) {
    //         throw new \yii\web\BadRequestHttpException('Missing course or offering data.');
    //     }

    //     $courseData = $body['course'];
    //     $offeringData = $body['offering'];

    //     $transaction = Yii::$app->db->beginTransaction();
    //     try {
    //         // Check for existing permanent course
    //         $existingCourse = Courses::findOne([
    //             'course_number' => $body['course']['course_number'],
    //             'department_id' => $body['course']['department_id'],
    //             'course_name' => $body['course']['course_name'],
    //         ]);

    //         if (!$existingCourse) {
    //             // Create new permanent course
    //             $existingCourse = new Courses($courseData);
    //             if (!$existingCourse->save()) {
    //                 throw new ServerErrorHttpException('Course creation failed: ' . json_encode($existingCourse->errors));
    //             }
    //         }

    //     // Check if course offering already exists
    //         $existingOffering = \app\models\CourseOfferings::findOne([
    //             'folio_course_id' => $offeringData['folio_course_id']
    //         ]);

    //         if ($existingOffering) {
    //             // Return the existing offering instead of creating a new one
    //             $offering = $existingOffering;
    //         } else {
    //             // Create new course offering
    //             $offering = new \app\models\CourseOfferings();
    //             $offering->course_id = $existingCourse->course_id;
    //             $offering->folio_course_id = $offeringData['folio_course_id'];
    //             $offering->term_id = isset($offeringData['term_id']) ? $offeringData['term_id'] : '';
    //             $offering->term_name = isset($offeringData['term_name']) ? $offeringData['term_name'] : '';
    //             $offering->start_date = isset($offeringData['start_date']) 
    //             ? date('Y-m-d H:i:s', strtotime($offeringData['start_date'])) 
    //             : null;
            
    //             $offering->end_date = isset($offeringData['end_date']) 
    //             ? date('Y-m-d H:i:s', strtotime($offeringData['end_date'])) 
    //             : null;
            
    //             $offering->status = isset($offeringData['status']) ? $offeringData['status'] : 'active';

    //             if (!$offering->save()) {
    //                 throw new \yii\web\ServerErrorHttpException('Failed to create course offering: ' . json_encode($offering->getErrors()));
    //             }
    //         }

    //         $transaction->commit();

    //         return [
    //             'course' => $existingCourse,
    //             'offering' => $offering,
    //         ];
    //     } catch (\Exception $e) {
    //         $transaction->rollBack();
    //         throw $e;
    //     }
    // }

    // public function actionReactivateCourse()
    // {
    //     $data = Yii::$app->request->post();

    //     $course = Courses::findOne(['permanent_course_uuid' => $data["params"]['permanentCourseUUID']]);
    //     if (!$course) {
    //         throw new NotFoundHttpException('Course not found.');
    //     }

    //     $offeringData = $data["params"]['courseOfferings']["offering"];

    //     // Create new offering
    //     $offering = new \app\models\CourseOfferings();
    //     $offering->course_id = $course->course_id;
    //     $offering->folio_course_id = isset( $data["params"]['folioCourseId']) ?  $data["params"]['folioCourseId'] : '';
    //     $offering->term_id = isset($offeringData['term_id']) ? $offeringData['term_id'] : '';
    //     $offering->term_name = isset($offeringData['term_name']) ? $offeringData['term_name'] : '';
    //     $offering->start_date = isset($offeringData['start_date']) 
    //         ? date('Y-m-d H:i:s', strtotime($offeringData['start_date'])) 
    //         : null;
        
    //     $offering->end_date = isset($offeringData['end_date']) 
    //         ? date('Y-m-d H:i:s', strtotime($offeringData['end_date'])) 
    //         : null;
        
    //     $offering->status = isset($offeringData['status']) ? $offeringData['status'] : 'active';

    //     if (!$offering->save()) {
    //         throw new ServerErrorHttpException('Failed to create course offering.');
    //     }

    //     // Find the most recent previous offering for this course
    //     $previousOffering = \app\models\CourseOfferings::find()
    //         ->where(['course_id' => $course->course_id])
    //         ->andWhere(['<>', 'offering_id', $offering->offering_id])
    //         ->orderBy(['created_at' => SORT_DESC])
    //         ->one();

    //     if ($previousOffering) {
    //         // Get all resources from the previous offering
    //         $previousResources = (new \yii\db\Query())
    //             ->select('resource_id')
    //             ->from('course_resources')
    //             ->where(['offering_id' => $previousOffering->offering_id])
    //             ->all();

    //         // Create new course_resources entries for the new offering
    //         $connection = Yii::$app->db;
    //         $transaction = $connection->beginTransaction();
            
    //         try {
    //             foreach ($previousResources as $resource) {
    //                 $courseResource = new \app\models\CourseResources();
    //                 $courseResource->offering_id = $offering->offering_id;
    //                 $courseResource->resource_id = $resource['resource_id'];
                    
    //                 if (!$courseResource->save()) {
    //                     throw new \Exception('Failed to copy resource');
    //                 }
    //             }
                
    //             // Update visibility dates for the resources
    //             $resourceIds = array_column($previousResources, 'resource_id');
    //             if (!empty($resourceIds)) {
    //                 // Convert timestamps to DATE format for visibility columns
    //                 $startVisibility = $offering->start_date ? date('Y-m-d', strtotime($offering->start_date)) : null;
    //                 $endVisibility = $offering->end_date ? date('Y-m-d', strtotime($offering->end_date)) : null;
                    
    //                 Resources::updateAll(
    //                     [
    //                         'start_visibility' => $startVisibility,
    //                         'end_visibility' => $endVisibility
    //                     ],
    //                     ['resource_id' => $resourceIds]
    //                 );
    //             }
                
    //             $transaction->commit();
    //         } catch (\Exception $e) {
    //             $transaction->rollBack();
    //             throw new ServerErrorHttpException('Failed to copy resources: ' . $e->getMessage());
    //         }
    //     }

    //     return ['course' => $course, 'offering' => $offering];
    // }

    //NEW FUNCTIONS TO BULLET PROOF COURSE CHECKS, CREATION, AND REACTIVATION
    public function actionCheckCourseExists()
{
    $d = Yii::$app->request->post();

    if (empty($d['course_number'])) {
        throw new \yii\web\BadRequestHttpException('Missing course_number.');
    }
    if (empty($d['term_id'])) {
        throw new \yii\web\BadRequestHttpException('Missing term_id.');
    }

    $courseNumber  = trim((string)$d['course_number']);
    $termId        = (string)$d['term_id'];
    $locationId    = isset($d['location_id'])     ? trim((string)$d['location_id'])     : null;
    $departmentId  = isset($d['department_id'])   ? trim((string)$d['department_id'])   : null;
    $courseName    = isset($d['course_name'])     ? trim((string)$d['course_name'])     : null;
    $folioCourseId = isset($d['folio_course_id']) ? trim((string)$d['folio_course_id']) : null;
    $sectionName   = isset($d['section_name'])    ? trim((string)$d['section_name'])    : '';
    
    // 0) Short-circuit by folio_course_id - only if found
    // If not found, fall through to check by course_number (for new offerings of existing courses)
    if ($folioCourseId !== null && $folioCourseId !== '') {
        $byFolio = \app\models\CourseOfferings::find()
            ->select(array(
                'offering_id','course_id','term_id','term_name','folio_course_id',
                'status','start_date','end_date','created_at',
                // *** [CHANGE] include new columns:
                'offering_uuid','section_name'
            ))
            ->where(array('folio_course_id' => $folioCourseId))
            ->asArray()
            ->one();

        if ($byFolio) {
            if ($sectionName !== '' && (!isset($byFolio['section_name']) || (string)$byFolio['section_name'] !== $sectionName)) {
                \app\models\CourseOfferings::updateAll(
                    array('section_name' => $sectionName),
                    'offering_id = :oid',
                    array(':oid' => $byFolio['offering_id'])
                );
                $byFolio['section_name'] = $sectionName; // reflect in response
            }
            $course = \app\models\Courses::find()
                ->select(array(
                    'course_id','course_name','course_number',
                    'department_id','department_name',
                    'location_id','location_name',
                    'permanent_course_uuid','created_at'
                ))
                ->where(array('course_id' => $byFolio['course_id']))
                ->asArray()
                ->one();

            $latestStartDate = $byFolio['start_date'] ? date('c', strtotime($byFolio['start_date'])) : null;
            // Check both term_id AND section_name match
            $offeringForTerm = ((string)$byFolio['term_id'] === $termId && 
                                (string)$byFolio['section_name'] === $sectionName) ? $byFolio : null;

            if ($offeringForTerm && $sectionName !== '' &&
                (!isset($offeringForTerm['section_name']) || (string)$offeringForTerm['section_name'] !== $sectionName)) {
                \app\models\CourseOfferings::updateAll(
                    array('section_name' => $sectionName),
                    'offering_id = :oid',
                    array(':oid' => $offeringForTerm['offering_id'])
                );
                $offeringForTerm['section_name'] = $sectionName; // reflect in response
            }

            return array(
                'exists'                  => true,
                'course'                  => $course,                // FE builds course permalink from permanent_course_uuid
                'offerings'               => array($byFolio),        // has offering_uuid + section_name now
                'offeringExists'          => $offeringForTerm !== null,
                'offeringId'              => $offeringForTerm ? $offeringForTerm['offering_id'] : null,
                'current_offering_id'     => $offeringForTerm ? $offeringForTerm['offering_id'] : null,
                'latest_term_name'        => $offeringForTerm ? $offeringForTerm['term_name'] : null,
                'latestOfferingStartDate' => $offeringForTerm ? date('c', strtotime($offeringForTerm['start_date'])) : null,
            );
        }

        // folio_course_id not found - fall through to check by course_number
        // (This handles new offerings for existing courses)
    }

    // 1) Find candidate course by stable key
    $courseQuery = \app\models\Courses::find()
        ->select(array(
            'course_id','course_name','course_number',
            'department_id','department_name',
            'location_id','location_name',
            'permanent_course_uuid','created_at'
        ))
        ->where(array('course_number' => $courseNumber));
    if ($locationId) $courseQuery->andWhere(array('location_id' => $locationId));

    $courses = $courseQuery->orderBy(array('created_at' => SORT_ASC))->asArray()->all();
    if (!$courses) {
        return array(
            'exists'                  => false,
            'reason'                  => 'noCourseForNumber',
            'course'                  => null,
            'offeringExists'          => false,
            'offeringId'              => null,
            'current_offering_id'     => null,
            'latest_term_name'        => null,
            'latestOfferingStartDate' => null,
            'offerings'               => array(),
        );
    }

    if (count($courses) > 1) {
        if ($departmentId) {
            $filtered = array();
            foreach ($courses as $c) {
                if ((string)$c['department_id'] === $departmentId) $filtered[] = $c;
            }
            if (count($filtered) === 1) $courses = $filtered;
        }
        if (count($courses) > 1 && $courseName) {
            $exact = array();
            foreach ($courses as $c) {
                if ((string)$c['course_name'] === $courseName) $exact[] = $c;
            }
            if (count($exact) === 1) $courses = $exact;
        }
        if (count($courses) > 1) {
            return array(
                'exists'                  => false,
                'reason'                  => 'multipleCoursesForNumber',
                'course'                  => null,
                'offeringExists'          => false,
                'offeringId'              => null,
                'current_offering_id'     => null,
                'latest_term_name'        => null,
                'latestOfferingStartDate' => null,
                'offerings'               => array(),
            );
        }
    }

    // 2) Exactly one course
    $course = $courses[0];

    // Fetch offerings (now including offering_uuid + section_name)
    $offerings = \app\models\CourseOfferings::find()
        ->select(array(
            'offering_id','course_id','term_id','term_name','folio_course_id',
            'status','start_date','end_date','created_at',
            // *** [CHANGE] include new columns:
            'offering_uuid','section_name'
        ))
        ->where(array('course_id' => $course['course_id']))
        ->orderBy(array('start_date' => SORT_DESC, 'created_at' => SORT_DESC))
        ->asArray()
        ->all();

    // Offering for this specific term AND section?
    $offeringForTerm = null;
    foreach ($offerings as $o) {
        if ((string)$o['term_id'] === $termId && (string)$o['section_name'] === $sectionName) { 
            $offeringForTerm = $o; 
            break; 
        }
    }

    $latest = isset($offerings[0]) ? $offerings[0] : null;
    $latestStartDate = ($latest && !empty($latest['start_date'])) ? date('c', strtotime($latest['start_date'])) : null;

    return array(
        'exists'                  => true,
        'course'                  => $course,   // contains permanent_course_uuid
        'offerings'               => $offerings, // now includes offering_uuid + section_name
        'offeringExists'          => $offeringForTerm !== null,
        'offeringId'              => $offeringForTerm ? $offeringForTerm['offering_id'] : null,
        'current_offering_id'     => $offeringForTerm ? $offeringForTerm['offering_id'] : null,
        'latest_term_name'        => $latest ? $latest['term_name'] : null,
        'latestOfferingStartDate' => $latestStartDate,
    );
}
    
    /**
     * Compute offering status from start/end (UTC). Defaults to 'active' if dates are missing.
     * @param string|null $start 'Y-m-d H:i:s' or null
     * @param string|null $end   'Y-m-d H:i:s' or null
     * @return string 'active'|'inactive'
     */
    private function computeOfferingStatus($start, $end)
    {
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $s   = $start ? new \DateTimeImmutable($start, new \DateTimeZone('UTC')) : null;
        $e   = $end   ? new \DateTimeImmutable($end,   new \DateTimeZone('UTC')) : null;

        // If either bound missing, prefer 'active' so staff aren't blocked.
        if (!$s || !$e) return 'active';
        return ($now >= $s && $now <= $e) ? 'active' : 'inactive';
    }

    /** Convert ISO8601 (e.g. 2024-01-16T05:00:00.000Z) to 'Y-m-d H:i:s' (UTC). */
    private function isoToMysql($iso)
    {
        if (!$iso) return null;
        $dt = new \DateTimeImmutable($iso);
        return $dt->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

   public function actionCreateFromFolio()
    {
        $body = Yii::$app->request->post();

        if (empty($body['course']) || empty($body['offering'])) {
            throw new \yii\web\BadRequestHttpException('Missing course or offering data.');
        }

        $courseData   = $body['course'];
        $offeringData = $body['offering'];

        // Required fields
        $requiredCourse   = array('course_number','course_name','department_id');
        $requiredOffering = array('folio_course_id','term_id','term_name');
        foreach ($requiredCourse as $k) {
            if (!isset($courseData[$k]) || $courseData[$k] === '') {
                throw new \yii\web\BadRequestHttpException("Missing course field: {$k}");
            }
        }
        foreach ($requiredOffering as $k) {
            if (!isset($offeringData[$k]) || $offeringData[$k] === '') {
                throw new \yii\web\BadRequestHttpException("Missing offering field: {$k}");
            }
        }

        // Normalize
        $code         = trim((string)$courseData['course_number']);
        $name         = trim((string)$courseData['course_name']);
        $deptId       = (string)$courseData['department_id'];
        $deptName     = isset($courseData['department_name']) ? (string)$courseData['department_name'] : null;
        $locationId   = isset($courseData['location_id'])     ? (string)$courseData['location_id']     : null;
        $locationName = isset($courseData['location_name'])   ? (string)$courseData['location_name']   : null;

        $section      = isset($offeringData['section_name']) ? (string)$offeringData['section_name'] : '';
        $folioId      = trim((string)$offeringData['folio_course_id']);
        $termId       = (string)$offeringData['term_id'];
        $termName     = (string)$offeringData['term_name'];

        // Dates (accept ISO8601 or Y-m-d H:i:s)
        $startMysql   = !empty($offeringData['start_date']) ? $this->isoToMysql($offeringData['start_date']) : null;
        $endMysql     = !empty($offeringData['end_date'])   ? $this->isoToMysql($offeringData['end_date'])   : null;

        $tx = Yii::$app->db->beginTransaction();

        
        try {
            // 1) COURSE — find by stable key (course_number [+ location_id])
            $courseLookup = array('course_number' => $code);
            if ($locationId !== null && $locationId !== '') {
                $courseLookup['location_id'] = $locationId;
            }

            /** @var \app\models\Courses|null $course */
            $course = \app\models\Courses::findOne($courseLookup);
            if (!$course) {
                $course = new \app\models\Courses();
                $course->course_number = $code;
                if ($locationId !== null && $locationId !== '') {
                    $course->location_id = $locationId;
                }
            }

            // Refresh descriptors from FOLIO every time (rename-safe)
            $course->course_name   = $name;
            $course->department_id = $deptId;
            if ($deptName     !== null) $course->department_name = $deptName;
            if ($locationName !== null) $course->location_name   = $locationName;

            if (!$course->save()) {
                throw new \yii\web\ServerErrorHttpException('Course save failed: ' . json_encode($course->getErrors()));
            }

            $existingByFolio = \app\models\CourseOfferings::findOne(['folio_course_id' => $folioId]);
            if ($existingByFolio && (int)$existingByFolio->course_id !== (int)$course->course_id) {
                throw new \yii\web\ConflictHttpException(sprintf(
                    'FOLIO course %s is already linked to a different course_id=%d. ' .
                    'Please correct the listing in FOLIO or choose Reactivate on the existing course.',
                    $folioId, $existingByFolio->course_id
                ));
            }

            // Guard B: (course_id, term_id) exists with a different folio_course_id
            $existingPair = \app\models\CourseOfferings::findOne([
                'course_id' => $course->course_id,
                'term_id'   => $termId,
                'section_name' => $section,
            ]);
            if ($existingPair && $existingPair->folio_course_id && $existingPair->folio_course_id !== $folioId) {
                throw new \yii\web\ConflictHttpException(sprintf(
                    'This course already has an offering for term_id=%s (folio=%s). ' .
                    'Incoming folio=%s does not match. Please verify in FOLIO.',
                    $termId, $existingPair->folio_course_id, $folioId
                ));
            }

            // 2) OFFERING — idempotent by folio_course_id, then by (course_id, term_id)
            /** @var \app\models\CourseOfferings|null $offering */
            $offering = \app\models\CourseOfferings::findOne(array('folio_course_id' => $folioId));
            if (!$offering) {
                $offering = \app\models\CourseOfferings::findOne(array(
                    'course_id' => $course->course_id,
                    'term_id'   => $termId,
                    'section_name' => $section
                ));
            }

            if (!$offering) {
                $offering = new \app\models\CourseOfferings();
                $offering->course_id       = $course->course_id;
                $offering->folio_course_id = $folioId;
                $offering->term_id         = $termId;
                $offering->term_name       = $termName;
                $offering->section_name    = $section;
            } else {
                $offering->section_name = $section;

                if ($offering->folio_course_id === null || $offering->folio_course_id === '') {
                    $offering->folio_course_id = $folioId;
                }

                if ($termName !== '') $offering->term_name = $termName;
            }

            // Refresh offering descriptors
            if ($startMysql !== null) $offering->start_date = $startMysql;
            if ($endMysql   !== null) $offering->end_date   = $endMysql;

            // Always compute from dates; ignore any client-provided status
            $offering->status = $this->computeOfferingStatus($offering->start_date, $offering->end_date);

            if (!$offering->save()) {
                // Handle race: refetch winner by folio or (course,term)
                $winner = \app\models\CourseOfferings::findOne(array('folio_course_id' => $folioId));
                if (!$winner) {
                    $winner = \app\models\CourseOfferings::findOne(array(
                        'course_id'    => $course->course_id,
                        'term_id'      => $termId,
                        'section_name' => $section,
                    ));
                }
                if (!$winner) {
                    throw new \yii\web\ServerErrorHttpException('Offering save failed: ' . json_encode($offering->getErrors()));
                }
                $offering = $winner;
            }

            $tx->commit();

            // Response compatible with your FE
            $latestStartIso = $offering->start_date ? date('c', strtotime($offering->start_date)) : null;

            return array(
                'course'                   => $course->toArray(),
                'offering'                 => $offering->toArray(),
                'current_offering_id'      => $offering->offering_id,
                'offering_id'              => $offering->offering_id,
                'latestOfferingStartDate'  => $latestStartIso,
            );

        } catch (\Throwable $e) {
            if ($tx->isActive) $tx->rollBack();
            Yii::error($e->getMessage(), __METHOD__);
            throw $e;
        }
    }

   public function actionReactivateCourse()
    {
        $data = Yii::$app->request->post();
        if (empty($data['params'])) {
            throw new \yii\web\BadRequestHttpException('Missing params.');
        }
        $p = $data['params'];

        // 1) Identify course FIRST
        /** @var \app\models\Courses|null $course */
        $course = null;
        if (!empty($p['permanentCourseUUID'])) {
            $course = \app\models\Courses::findOne(['permanent_course_uuid' => (string)$p['permanentCourseUUID']]);
        } elseif (!empty($p['course_id'])) {
            $course = \app\models\Courses::findOne((int)$p['course_id']);
        }
        if (!$course) {
            throw new \yii\web\NotFoundHttpException('Course not found.');
        }

        // 2) Shim: accept course metadata at params.course OR params.courseOfferings.course
        $payloadCourse = null;
        if (!empty($p['course']) && is_array($p['course'])) {
            $payloadCourse = $p['course'];
        } elseif (!empty($p['courseOfferings']['course']) && is_array($p['courseOfferings']['course'])) {
            $payloadCourse = $p['courseOfferings']['course']; // fallback for current FE payload
        }

        // 3) Offering payload required
        if (empty($p['courseOfferings']['offering'])) {
            throw new \yii\web\BadRequestHttpException('Missing offering data.');
        }
        $o = $p['courseOfferings']['offering'];

        $folioCourseId = !empty($p['folioCourseId']) ? (string)$p['folioCourseId'] : '';

        // Normalize offering fields
        $termId   = isset($o['term_id'])   ? (string)$o['term_id']   : '';
        $termName = isset($o['term_name']) ? (string)$o['term_name'] : '';
        $section =  isset($o['section_name']) ? (string)$o['section_name'] : '';

        if ($termId === '') {
            throw new \yii\web\BadRequestHttpException('Missing offering term_id.');
        }

        $startMysql = !empty($o['start_date']) ? $this->isoToMysql($o['start_date']) : null;
        $endMysql   = !empty($o['end_date'])   ? $this->isoToMysql($o['end_date'])   : null;

        $tx = Yii::$app->db->beginTransaction();
        try {
            // 4) Refresh parent course descriptors (inside TX so rename is atomic with offering/resource copy)
            if ($payloadCourse) {
                $c = $payloadCourse;
                if (!empty($c['course_name']))     $course->course_name   = trim((string)$c['course_name']);
                if (!empty($c['department_id']))   $course->department_id = (string)$c['department_id'];
                if (array_key_exists('department_name', $c)) $course->department_name = (string)$c['department_name'];
                if (array_key_exists('location_id',   $c))   $course->location_id     = (string)$c['location_id'];
                if (array_key_exists('location_name', $c))   $course->location_name   = (string)$c['location_name'];
                if (!$course->save()) {
                    throw new \yii\web\ServerErrorHttpException('Course update failed: ' . json_encode($course->getErrors()));
                }
            }

            /* -------------------------
            CONFLICT GUARDS
            ------------------------- */

            // Guard A: folioCourseId already linked to a different course
            if ($folioCourseId !== '') {
                $existingByFolio = \app\models\CourseOfferings::findOne(['folio_course_id' => $folioCourseId]);
                if ($existingByFolio && (int)$existingByFolio->course_id !== (int)$course->course_id) {
                    throw new \yii\web\ConflictHttpException(sprintf(
                        'FOLIO course %s is already linked to course_id=%d. ' .
                        'Please correct the listing in FOLIO or use Reactivate on that course.',
                        $folioCourseId, $existingByFolio->course_id
                    ));
                }
            } else {
                $existingByFolio = null;
            }

            // Guard B: same (course,term) but different folio id
            $existingPair = \app\models\CourseOfferings::findOne([
                'course_id' => $course->course_id,
                'term_id'   => $termId,
                'section_name' => $section,
            ]);
            if ($existingPair && $existingPair->folio_course_id && $folioCourseId !== '' &&
                $existingPair->folio_course_id !== $folioCourseId) {
                throw new \yii\web\ConflictHttpException(sprintf(
                    'This course already has an offering for term_id=%s (folio=%s). ' .
                    'Incoming folio=%s does not match. Please verify in FOLIO.',
                    $termId, $existingPair->folio_course_id, $folioCourseId
                ));
            }

            /* -------------------------
            OFFERING: reuse or create
            ------------------------- */

            /** @var \app\models\CourseOfferings|null $offering */
            $offering = $existingByFolio ?: $existingPair;
            if (!$offering) {
                $offering = new \app\models\CourseOfferings();
                $offering->course_id = $course->course_id;
                $offering->term_id   = $termId;
                $offering->term_name = $termName;
                $offering->section_name = $section;
                if ($folioCourseId !== '') $offering->folio_course_id = $folioCourseId;
            } else {
                if ($folioCourseId !== '') $offering->folio_course_id = $folioCourseId; // no-op if same
                if ($termName !== '')      $offering->term_name       = $termName;
                $offering->section_name = $section; // normalize

            }

            if ($startMysql !== null) $offering->start_date = $startMysql;
            if ($endMysql   !== null) $offering->end_date   = $endMysql;

            $offering->status = $this->computeOfferingStatus($offering->start_date, $offering->end_date);

            if (!$offering->save()) {
                // Unique/race fallback
                $winner = \app\models\CourseOfferings::findOne(array(
                    'course_id'    => $course->course_id,
                    'term_id'      => $termId,
                    'section_name' => $section,
                ));
                if (!$winner && $folioCourseId !== '') {
                    $winner = \app\models\CourseOfferings::findOne(array('folio_course_id' => $folioCourseId));
                }

                if (!$winner) {
                    throw new \yii\web\ServerErrorHttpException('Failed to save offering: ' . json_encode($offering->getErrors()));
                }
                $offering = $winner;
            }

            /* ----------------------------------------------------
            COPY RESOURCES (conditional, term-aligned visibility)
            only from most recent offering not newer than target
            ---------------------------------------------------- */
            $targetStart = $offering->start_date;

            // 1) Try to find the most recent previous offering in the SAME section
            $query = \app\models\CourseOfferings::find()
                ->where(array('course_id' => $course->course_id))
                ->andWhere(array('<>', 'offering_id', $offering->offering_id))
                ->andWhere(array('section_name' => $section));

            if ($targetStart) {
                // copy-forward-only: only from offerings that start on/before target
                $query->andWhere(array('<=', 'start_date', $targetStart));
            }

            $prev = $query
                ->orderBy(array('start_date' => SORT_DESC, 'created_at' => SORT_DESC))
                ->one();

            // 2) If none found for same section, fallback to ANY previous offering
            if (!$prev) {
                $query2 = \app\models\CourseOfferings::find()
                    ->where(array('course_id' => $course->course_id))
                    ->andWhere(array('<>', 'offering_id', $offering->offering_id));

                if ($targetStart) {
                    $query2->andWhere(array('<=', 'start_date', $targetStart));
                }

                $prev = $query2
                    ->orderBy(array('start_date' => SORT_DESC, 'created_at' => SORT_DESC))
                    ->one();
            }

            if ($prev) {
                $startVis = $offering->start_date ? date('Y-m-d', strtotime($offering->start_date)) : null;
                $endVis   = $offering->end_date   ? date('Y-m-d', strtotime($offering->end_date))   : null;

                $sql = "
                    INSERT IGNORE INTO course_resources
                        (offering_id,
                        resource_id,
                        `order`,
                        start_visibility,
                        end_visibility,
                        use_resource_visibility,
                        primary_link_start_visibility,
                        primary_link_end_visibility,
                        use_primary_link_visibility)
                    SELECT
                        :newOfferingId,
                        cr.resource_id,
                        COALESCE(cr.`order`, 999),
                        CASE
                        WHEN (cr.use_resource_visibility = 1
                                OR cr.start_visibility IS NOT NULL
                                OR cr.end_visibility IS NOT NULL)
                        THEN :startVis ELSE NULL
                        END,
                        CASE
                        WHEN (cr.use_resource_visibility = 1
                                OR cr.start_visibility IS NOT NULL
                                OR cr.end_visibility IS NOT NULL)
                        THEN :endVis ELSE NULL
                        END,
                        CASE
                        WHEN (cr.use_resource_visibility = 1
                                OR cr.start_visibility IS NOT NULL
                                OR cr.end_visibility IS NOT NULL)
                        THEN 1 ELSE 0
                        END,
                        CASE
                        WHEN (cr.use_primary_link_visibility = 1
                                OR cr.primary_link_start_visibility IS NOT NULL
                                OR cr.primary_link_end_visibility IS NOT NULL)
                        THEN :startVis ELSE NULL
                        END,
                        CASE
                        WHEN (cr.use_primary_link_visibility = 1
                                OR cr.primary_link_start_visibility IS NOT NULL
                                OR cr.primary_link_end_visibility IS NOT NULL)
                        THEN :endVis ELSE NULL
                        END,
                        CASE
                        WHEN (cr.use_primary_link_visibility = 1
                                OR cr.primary_link_start_visibility IS NOT NULL
                                OR cr.primary_link_end_visibility IS NOT NULL)
                        THEN 1 ELSE 0
                        END
                    FROM course_resources cr
                    WHERE cr.offering_id = :prevOfferingId
                    AND NOT EXISTS (
                            SELECT 1 FROM course_resources x
                            WHERE x.offering_id = :newOfferingId AND x.resource_id = cr.resource_id
                    )
                ";
                Yii::$app->db->createCommand($sql, [
                    ':newOfferingId'  => $offering->offering_id,
                    ':prevOfferingId' => $prev->offering_id,
                    ':startVis'       => $startVis,
                    ':endVis'         => $endVis,
                ])->execute();
            }

            $tx->commit();

            return [
                'course'               => $course->toArray(),
                'offering'             => $offering->toArray(),
                'current_offering_id'  => $offering->offering_id,
                'offering_id'          => $offering->offering_id,
            ];

        } catch (\Throwable $e) {
            if ($tx->isActive) $tx->rollBack();
            Yii::error($e->getMessage(), __METHOD__);
            throw new \yii\web\ServerErrorHttpException('Reactivate failed: ' . $e->getMessage());
        }
    }

    //END NEW 

    /**
     * Link Course Offering to Faculty Submission
     * 
     * This action receives FOLIO course data from staff when they're processing a faculty submission.
     * It will:
     * 1. Check if the permanent course exists, create it if not
     * 2. Check if the course offering exists, create it if not
     * 3. Link the offering_id to the faculty submission
     * 
     * POST /course/link-course-offering
     * Body: {
     *   "submission_id": 123,
     *   "selectedCourse": { // FOLIO course data
     *     "courseNumber": "PHY 360gr",
     *     "name": "Advanced Topics in Physics - General Relativity",
     *     "departmentId": "uuid",
     *     "departmentObject": { "name": "SC Physics" },
     *     "courseListingId": "uuid", // This becomes folio_course_id
     *     "courseListingObject": {
     *       "locationId": "uuid",
     *       "locationObject": { "name": "SC Neilson Reserve" },
     *       "termId": "uuid",
     *       "termObject": { "name": "2026 Spring", "startDate": "...", "endDate": "..." }
     *     }
     *   }
     * }
     * 
     * Returns: {
     *   "course": { ... permanent course record ... },
     *   "offering": { ... course offering record ... },
     *   "submission": { ... updated faculty submission ... }
     * }
     */
    public function actionLinkCourseOffering()
    {
        $body = Yii::$app->request->post();

        // Validate required fields
        if (empty($body['submission_id'])) {
            throw new \yii\web\BadRequestHttpException('Missing submission_id.');
        }
        if (empty($body['selectedCourse'])) {
            throw new \yii\web\BadRequestHttpException('Missing selectedCourse data.');
        }

        $submissionId = (int)$body['submission_id'];
        $folioData = $body['selectedCourse'];

        // Extract course information from FOLIO structure
        if (empty($folioData['courseNumber'])) {
            throw new \yii\web\BadRequestHttpException('Missing courseNumber in selectedCourse.');
        }
        if (empty($folioData['name'])) {
            throw new \yii\web\BadRequestHttpException('Missing course name in selectedCourse.');
        }
        if (empty($folioData['departmentId'])) {
            throw new \yii\web\BadRequestHttpException('Missing departmentId in selectedCourse.');
        }
        if (empty($folioData['courseListingId'])) {
            throw new \yii\web\BadRequestHttpException('Missing courseListingId in selectedCourse.');
        }
        if (empty($folioData['courseListingObject'])) {
            throw new \yii\web\BadRequestHttpException('Missing courseListingObject in selectedCourse.');
        }

        $listingObj = $folioData['courseListingObject'];
        if (empty($listingObj['termId'])) {
            throw new \yii\web\BadRequestHttpException('Missing termId in courseListingObject.');
        }
        if (empty($listingObj['termObject'])) {
            throw new \yii\web\BadRequestHttpException('Missing termObject in courseListingObject.');
        }

        // Find the faculty submission
        $submission = \app\models\FacultySubmission::findOne($submissionId);
        if (!$submission) {
            throw new \yii\web\NotFoundHttpException('Faculty submission not found.');
        }

        // Prepare course data
        $courseNumber = trim((string)$folioData['courseNumber']);
        $courseName = trim((string)$folioData['name']);
        $departmentId = (string)$folioData['departmentId'];
        $departmentName = isset($folioData['departmentObject']['name']) 
            ? (string)$folioData['departmentObject']['name'] 
            : null;
        
        $locationId = isset($listingObj['locationId']) ? (string)$listingObj['locationId'] : null;
        $locationName = isset($listingObj['locationObject']['name']) 
            ? (string)$listingObj['locationObject']['name'] 
            : null;

        // Prepare offering data
        $folioCourseId = (string)$folioData['courseListingId'];
        $termId = (string)$listingObj['termId'];
        $termObj = $listingObj['termObject'];
        $termName = isset($termObj['name']) ? (string)$termObj['name'] : '';
        
        // Section name - may not be present in all FOLIO data
        $sectionName = '';
        
        // Parse dates
        $startDate = null;
        $endDate = null;
        if (!empty($termObj['startDate'])) {
            $startDate = $this->isoToMysql($termObj['startDate']);
        }
        if (!empty($termObj['endDate'])) {
            $endDate = $this->isoToMysql($termObj['endDate']);
        }

        $tx = Yii::$app->db->beginTransaction();

        try {
            // 1) Check/Create Permanent Course
            $courseLookup = ['course_number' => $courseNumber];
            if ($locationId !== null && $locationId !== '') {
                $courseLookup['location_id'] = $locationId;
            }

            /** @var \app\models\Courses|null $course */
            $course = \app\models\Courses::findOne($courseLookup);
            if (!$course) {
                // Create new course
                $course = new \app\models\Courses();
                $course->course_number = $courseNumber;
                if ($locationId !== null && $locationId !== '') {
                    $course->location_id = $locationId;
                }
            }

            // Update course details from FOLIO (refresh descriptors)
            $course->course_name = $courseName;
            $course->department_id = $departmentId;
            if ($departmentName !== null) {
                $course->department_name = $departmentName;
            }
            if ($locationName !== null) {
                $course->location_name = $locationName;
            }

            if (!$course->save()) {
                throw new \yii\web\ServerErrorHttpException(
                    'Failed to save course: ' . json_encode($course->getErrors())
                );
            }

            // 2) Check for existing offering by folio_course_id
            $existingByFolio = \app\models\CourseOfferings::findOne(['folio_course_id' => $folioCourseId]);
            if ($existingByFolio && (int)$existingByFolio->course_id !== (int)$course->course_id) {
                throw new \yii\web\ConflictHttpException(sprintf(
                    'FOLIO course %s is already linked to a different course_id=%d.',
                    $folioCourseId, $existingByFolio->course_id
                ));
            }

            // Check for existing offering by (course_id, term_id, section_name)
            $existingPair = \app\models\CourseOfferings::findOne([
                'course_id' => $course->course_id,
                'term_id' => $termId,
                'section_name' => $sectionName,
            ]);
            if ($existingPair && $existingPair->folio_course_id 
                && $existingPair->folio_course_id !== $folioCourseId) {
                throw new \yii\web\ConflictHttpException(sprintf(
                    'This course already has an offering for term_id=%s with different folio_course_id.',
                    $termId
                ));
            }

            // 3) Create or update offering
            /** @var \app\models\CourseOfferings|null $offering */
            $offering = \app\models\CourseOfferings::findOne(['folio_course_id' => $folioCourseId]);
            if (!$offering) {
                $offering = \app\models\CourseOfferings::findOne([
                    'course_id' => $course->course_id,
                    'term_id' => $termId,
                    'section_name' => $sectionName,
                ]);
            }

            if (!$offering) {
                // Create new offering
                $offering = new \app\models\CourseOfferings();
                $offering->course_id = $course->course_id;
                $offering->folio_course_id = $folioCourseId;
                $offering->term_id = $termId;
                $offering->term_name = $termName;
                $offering->section_name = $sectionName;
            } else {
                // Update existing offering
                if (empty($offering->folio_course_id)) {
                    $offering->folio_course_id = $folioCourseId;
                }
                if ($termName !== '') {
                    $offering->term_name = $termName;
                }
            }

            // Set dates and status
            if ($startDate !== null) {
                $offering->start_date = $startDate;
            }
            if ($endDate !== null) {
                $offering->end_date = $endDate;
            }
            $offering->status = $this->computeOfferingStatus($offering->start_date, $offering->end_date);

            if (!$offering->save()) {
                throw new \yii\web\ServerErrorHttpException(
                    'Failed to save offering: ' . json_encode($offering->getErrors())
                );
            }

            // 4) Link offering to faculty submission
            $submission->offering_id = $offering->offering_id;
            $submission->folio_course_listing_id = $folioCourseId;
            
            if (!$submission->save()) {
                throw new \yii\web\ServerErrorHttpException(
                    'Failed to update submission: ' . json_encode($submission->getErrors())
                );
            }

            $scaffoldService = new SubmissionCourseScaffoldService();
            $folderScaffold = $scaffoldService->ensureSubmissionCourseScaffold($submission);

            $tx->commit();

            return [
                'success' => true,
                'course' => $course->toArray(),
                'offering' => $offering->toArray(),
                'submission' => [
                    'submission_id' => $submission->submission_id,
                    'submission_uuid' => $submission->submission_uuid,
                    'offering_id' => $submission->offering_id,
                    'folio_course_listing_id' => $submission->folio_course_listing_id,
                ],
                'folder_scaffold' => $folderScaffold,
            ];

        } catch (\Throwable $e) {
            if ($tx->isActive) {
                $tx->rollBack();
            }
            Yii::error($e->getMessage(), __METHOD__);
            throw $e;
        }
    }

    // Stable url for public view of a course
    public function actionPublicView($uuid)
    {
        $course = Courses::findOne(['permanent_course_uuid' => $uuid]);
        if (!$course) {
            throw new NotFoundHttpException('Course not found.');
        }

        $currentOffering = CourseOfferings::find()
            ->where(['course_id' => $course->course_id])
            ->andWhere(['>=', 'end_date', date('Y-m-d')])
            ->orderBy(['start_date' => SORT_ASC])
            ->one();

        if (!$currentOffering) {
            throw new NotFoundHttpException('No active course offering found.');
        }

        $resources = Resources::find()
            ->innerJoin('course_resources cr', 'cr.resource_id = resources.resource_id')
            ->where(['cr.course_id' => $course->course_id])
            ->all();

        return [
            'course' => $course,
            'offering' => $currentOffering,
            'resources' => $resources,
        ];
    }

    public function actionUpdateResourceOrder()
    {
        $body = json_decode(Yii::$app->request->getRawBody(), true);

        // Validate payload
        if (!isset($body['courseId']) || !isset($body['resources'])) {
            throw new BadRequestHttpException('Missing courseId or resources data.');
        }

        $offeringId = $body['courseId'];
        $resources = $body['resources'];

        //It looks like the course offering is sent so we need to find the course id from the offering
        $courseId = CourseOfferings::findOne($offeringId)->course_id;

        // Ensure the course exists
        $course = Courses::findOne($courseId);
        if (!$course) {
            throw new NotFoundHttpException('Course not found.');
        }

        // Loop through each resource and update its order
        foreach ($resources as $resourceData) {
            $courseResourceId = $resourceData['course_resource_id'] ?? null;
            $order = $resourceData['order'] ?? null;

            if (!$courseResourceId || $order === null) {
                continue; // Skip invalid entries
            }

            $courseResource = CourseResources::findOne(['course_resource_id' => $courseResourceId]);
            if ($courseResource) {
                $courseResource->order = $order;
                if (!$courseResource->save()) {
                    throw new ServerErrorHttpException('Failed to update order for course resource: ' . $courseResourceId);
                }
            }
        }

        return ['success' => true];
    }


    public function actionExists()
    {
        $folioCourseId = Yii::$app->request->get('folioCourseId');
        if (!$folioCourseId) {
            throw new \yii\web\BadRequestHttpException('Missing folioCourseId.');
        }
    
        $courseOffering = CourseOfferings::findOne(['folio_course_id' => $folioCourseId]);
        if($courseOffering){
            $course = Courses::findOne(['course_id' => $courseOffering->course_id]);
            if ($course) {
                // Find all offerings for this course. You might want to filter on active offerings.
                $offerings = \app\models\CourseOfferings::find()
                    ->where(['course_id' => $course->course_id])
                    ->asArray()
                    ->all();
                
                return [
                    'exists' => true,
                    'course' => $course,
                    'offerings' => $offerings,
                ];
            }
        }
        return ['exists' => false];
    }

    public function actionCheckUniqueId()
    {
        $uuid = (string)Yii::$app->request->get('uuid', '');
        if ($uuid === '') {
            // Keep the contract small and predictable
            return ['exists' => false, 'folio_course_id' => null];
        }

        $section = (string)Yii::$app->request->get('section', '');
        if ($section === '' && Yii::$app->request->get('section_name', '') !== '') {
            $section = (string)Yii::$app->request->get('section_name', '');
        }

        /** @var \app\models\Courses|null $course */
        $course = \app\models\Courses::findOne(['permanent_course_uuid' => $uuid]);
        if (!$course) {
            return ['exists' => false, 'folio_course_id' => null];
        }

        $now   = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $nowSql = $now->format('Y-m-d H:i:s');

        // Helper to build a query with optional section filter
        $q = \app\models\CourseOfferings::find()->where(array('course_id' => $course->course_id));
        // We’ll reuse this pattern below for each bucket (active / upcoming / past)

        // -------- 1) Prefer currently active term (optionally in this section) --------
        $activeQ = \app\models\CourseOfferings::find()
            ->where(array('course_id' => $course->course_id))
            ->andWhere(array('<=', 'start_date', $nowSql))
            ->andWhere(array('>=', 'end_date',   $nowSql));

        // *** [CHANGE] prefer a specific section if requested
        if ($section !== '') {
            $activeQ->andWhere(array('section_name' => $section));
        }

        // 1) Prefer currently active term
        $active = $activeQ
            ->orderBy(['start_date' => SORT_DESC, 'created_at' => SORT_DESC])
            ->one();

        // 2) Else the soonest upcoming
        $upcoming = null;
        if (!$active) {
            $upcomingQ = \app\models\CourseOfferings::find()
                ->where(array('course_id' => $course->course_id))
                ->andWhere(array('>', 'start_date', $nowSql));

            // *** [CHANGE]
            if ($section !== '') {
                $upcomingQ->andWhere(array('section_name' => $section));
            }
            // *** [CHANGE-END]

            $upcoming = $upcomingQ->orderBy(array('start_date' => SORT_ASC, 'created_at' => SORT_ASC))->one();
        }

        // 3) Else the most recent past
        $recentPast = null;
        if (!$active && !$upcoming) {
            $recentQ = \app\models\CourseOfferings::find()
                ->where(array('course_id' => $course->course_id))
                ->andWhere(array('<', 'start_date', $nowSql));

            // *** [CHANGE]
            if ($section !== '') {
                $recentQ->andWhere(array('section_name' => $section));
            }
            // *** [CHANGE-END]

            $recentPast = $recentQ->orderBy(array('start_date' => SORT_DESC, 'created_at' => SORT_DESC))->one();
        }

        $chosen = $active ? $active : ($upcoming ? $upcoming : $recentPast);
        if (!$chosen && $section !== '') {
            // Re-run your original logic WITHOUT section filter
            $activeAny = \app\models\CourseOfferings::find()
                ->where(array('course_id' => $course->course_id))
                ->andWhere(array('<=', 'start_date', $nowSql))
                ->andWhere(array('>=', 'end_date',   $nowSql))
                ->orderBy(array('start_date' => SORT_DESC, 'created_at' => SORT_DESC))
                ->one();

            $upcomingAny = null;
            if (!$activeAny) {
                $upcomingAny = \app\models\CourseOfferings::find()
                    ->where(array('course_id' => $course->course_id))
                    ->andWhere(array('>', 'start_date', $nowSql))
                    ->orderBy(array('start_date' => SORT_ASC, 'created_at' => SORT_ASC))
                    ->one();
            }

            $recentAny = null;
            if (!$activeAny && !$upcomingAny) {
                $recentAny = \app\models\CourseOfferings::find()
                    ->where(array('course_id' => $course->course_id))
                    ->andWhere(array('<', 'start_date', $nowSql))
                    ->orderBy(array('start_date' => SORT_DESC, 'created_at' => SORT_DESC))
                    ->one();
            }

            $chosen = $activeAny ? $activeAny : ($upcomingAny ? $upcomingAny : $recentAny);
        }

        if (!$chosen || empty($chosen->folio_course_id)) {
            return ['exists' => false, 'folio_course_id' => null];
        }

        return ['exists' => true, 'folio_course_id' => $chosen->folio_course_id];
    }

    public function actionResolveOffering()
    {
        $uuid = (string)Yii::$app->request->get('offering_uuid', '');
        if ($uuid === '') {
            return array('exists' => false, 'folio_course_id' => null);
        }

        $o = \app\models\CourseOfferings::find()
            ->select(array('offering_id','course_id','folio_course_id'))
            ->where(array('offering_uuid' => $uuid))
            ->asArray()
            ->one();

        if (!$o || empty($o['folio_course_id'])) {
            return array('exists' => false, 'folio_course_id' => null);
        }

        return array(
            'exists'          => true,
            'folio_course_id' => $o['folio_course_id'],
            'offering_id'     => $o['offering_id'],
            'course_id'       => $o['course_id'],
        );
    }


    public function actionResources($offeringId)
    {
        \Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;

        $offering = CourseOfferings::findOne($offeringId);
        if (!$offering) {
            throw new NotFoundHttpException('Course offering not found.');
        }
        
        $course = Courses::findOne($offering->course_id);
        if (!$course) {
            throw new NotFoundHttpException('Course not found.');
        }
        
        // Fetch resources with their order values
        $sql = "
        SELECT r.*, cr.course_resource_id, cr.order, cr.start_visibility, cr.end_visibility, 
               cr.use_resource_visibility, cr.use_primary_link_visibility, 
               cr.primary_link_start_visibility, cr.primary_link_end_visibility,
               mt.name AS material_type_name
        FROM resources r
        JOIN course_resources cr ON r.resource_id = cr.resource_id
        LEFT JOIN material_types mt ON r.material_type_id = mt.material_type_id
        WHERE cr.offering_id = :offering_id
        ORDER BY 
            CASE 
                WHEN cr.order IS NOT NULL AND cr.order != 999 THEN cr.order
                ELSE 999999
            END ASC,
            cr.course_resource_id ASC
        ";
        
        $resources = Yii::$app->db->createCommand($sql, [
            ':offering_id' => $offeringId
        ])->queryAll();
        
        // Process resources and attach metadata
        foreach ($resources as &$resource) {
            // Get metadata for this resource
            $metadataSql = "
                SELECT field_name, field_value 
                FROM resource_metadata 
                WHERE resource_id = :resource_id
            ";
            $metadata = Yii::$app->db->createCommand($metadataSql, [
                ':resource_id' => $resource['resource_id']
            ])->queryAll();
            $resource['metadata'] = $metadata;

            // Get links for this resource
            $linksSql = "
                SELECT * FROM resource_links
                WHERE resource_id = :resource_id
                ORDER BY `order` ASC
            ";
            $links = Yii::$app->db->createCommand($linksSql, [
                ':resource_id' => $resource['resource_id']
            ])->queryAll();
            $resource['links'] = $links;
        }
        
        return [
            'course' => $course,
            'resources' => $resources
        ];
    }

    public function actionMaterialTypeFields($materialTypeId)
    {
        return MaterialTypeFields::find()
            ->where(['material_type_id' => $materialTypeId])
            ->orderBy(['sort_order' => SORT_ASC])
            ->asArray()
            ->all();
    }

    public function actionGetResources()
    {
        \Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
        $courseListingId = Yii::$app->request->get('courseListingId'); 

        $courseOffering = CourseOfferings::findOne(['folio_course_id' => $courseListingId]);

        if(!$courseOffering){
            throw new NotFoundHttpException('Course offering not found.');
        }

        $course = Courses::findOne(['course_id' => $courseOffering->course_id]);
        if (!$course) {
            throw new NotFoundHttpException('Course not found.');
        }

        // First query to get basic resource information
        $sql = "
            SELECT r.resource_id, r.name, r.item_url, r.description, r.external_note, r.internal_note, 
                   cr.start_visibility, cr.end_visibility, cr.use_resource_visibility,
                   cr.use_primary_link_visibility, cr.primary_link_start_visibility, cr.primary_link_end_visibility,
                   r.use_proxy, COALESCE(cr.folder_id, r.folder_id) as folder_id,
                   mt.name AS material_type_name,
                   rm.field_name, rm.field_value,
                   cr.course_resource_id, cr.order,
                   f.folder_id, f.name as folder_name
            FROM course_resources cr
            JOIN resources r ON cr.resource_id = r.resource_id
            LEFT JOIN material_types mt ON r.material_type_id = mt.material_type_id
            LEFT JOIN course_offerings co on cr.offering_id = co.offering_id
            LEFT JOIN courses c ON co.course_id = c.course_id
            LEFT JOIN resource_metadata rm ON r.resource_id = rm.resource_id
            LEFT JOIN folders f ON COALESCE(cr.folder_id, r.folder_id) = f.folder_id
            WHERE co.folio_course_id = :courseListingId
            ORDER BY cr.order ASC
        ";
        $rows = Yii::$app->db->createCommand($sql, [':courseListingId' => $courseListingId])->queryAll();

        // Group rows by resource_id
        $resources = [];
        foreach ($rows as $row) {
            $rid = $row['resource_id'];
            if (!isset($resources[$rid])) {
                $resources[$rid] = [
                    'resource_id' => $row['resource_id'],
                    'name' => $row['name'],
                    'item_url' => $row['item_url'],
                    'description' => $row['description'],
                    'external_note' => $row['external_note'],
                    'internal_note' => $row['internal_note'],
                    'start_visibility' => $row['start_visibility'],
                    'end_visibility' => $row['end_visibility'],
                    'use_proxy' => $row['use_proxy'],
                    'folder_id' => $row['folder_id'],
                    'folder_name' => $row['folder_name'],
                    'material_type_name' => $row['material_type_name'],
                    'course_resource_id' => $row['course_resource_id'],
                    'order' => $row['order'],
                    'metadata' => [],
                    'links' => [] // Initialize empty links array
                ];
            }
            // If metadata exists, add it to the metadata array
            if ($row['field_name'] !== null) {
                $resources[$rid]['metadata'][] = [
                    'field_name' => $row['field_name'],
                    'field_value' => $row['field_value']
                ];
            }
        }
        
        // Fetch additional links for each resource
        $resourceIds = array_keys($resources);
        if (!empty($resourceIds)) {
            $linksQuery = "
                SELECT link_id, resource_id, url, title, description, use_proxy, `order` 
                FROM resource_links 
                WHERE resource_id IN (" . implode(',', $resourceIds) . ")
                ORDER BY `order` ASC
            ";
            $links = Yii::$app->db->createCommand($linksQuery)->queryAll();
            
            // Group links by resource_id
            foreach ($links as $link) {
                $rid = $link['resource_id'];
                if (isset($resources[$rid])) {
                    $resources[$rid]['links'][] = [
                        'link_id' => $link['link_id'],
                        'url' => $link['url'],
                        'title' => $link['title'],
                        'description' => $link['description'],
                        'use_proxy' => (bool)$link['use_proxy'],
                        'order' => $link['order']
                    ];
                }
            }
        }
        
        // Re-index the array to return a list rather than an associative array keyed by resource_id.
        $resources = array_values($resources);

        return [
            'course' => $course,
            'resources' => $resources,
            'count' => count($resources),
        ];
    }

    /**
     * GET /course/get‑merged‑resources?courseListingId=…
     *
     * Returns both print (from FOLIO) and electronic reserves,
     * merged into one list and sorted by:
     * 1) admin‐saved order (if present)
     * 2) alphabetical by title otherwise.
     */
    public function actionGetMergedResources($courseListingId)
    {
        \Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
        $courseListingId = Yii::$app->request->get('courseListingId');
        
        if (!$courseListingId) {
            throw new BadRequestHttpException('Missing courseListingId parameter.');
        }

        $courseOffering = CourseOfferings::findOne(['folio_course_id' => $courseListingId]);
        
        if (!$courseOffering) {
            throw new NotFoundHttpException('Course offering not found.');
        }
        
        $offeringId = $courseOffering->offering_id;
        
        // Get electronic resources
        $electronicSql = "
            SELECT 
                'electronic' as resource_type,
                r.resource_id as id,
                r.name as title,
                r.item_url,
                r.description,
                r.external_note,
                r.internal_note,
                cr.start_visibility,
                cr.end_visibility,
                cr.use_resource_visibility,
                r.use_proxy,
                COALESCE(cr.folder_id, r.folder_id) as folder_id,
                f.name as folder_name,
                cr.course_resource_id,
                cr.order,
                cr.use_primary_link_visibility,
                cr.primary_link_start_visibility,
                cr.primary_link_end_visibility,
                rl.link_id,
                rl.url as link_url,
                rl.title as link_title,
                rl.description as link_description,
                rl.use_proxy as link_use_proxy,
                rl.order as link_order,
                rl.start_visibility as link_start_visibility,
                rl.end_visibility as link_end_visibility,
                rl.use_link_visibility
            FROM course_resources cr
            JOIN resources r ON cr.resource_id = r.resource_id
            LEFT JOIN folders f ON COALESCE(cr.folder_id, r.folder_id) = f.folder_id
            LEFT JOIN resource_links rl ON r.resource_id = rl.resource_id
            WHERE cr.offering_id = :offering_id
            ORDER BY cr.order ASC, rl.order ASC
        ";
        
        $electronicRows = Yii::$app->db->createCommand($electronicSql, [
            ':offering_id' => $offeringId
        ])->queryAll();
        
        // Group electronic resources and their links
        $electronicResources = [];
        foreach ($electronicRows as $row) {
            $resourceId = $row['id'];
            
            if (!isset($electronicResources[$resourceId])) {
                // Create the base resource entry
                $electronicResources[$resourceId] = [
                    'resource_type' => $row['resource_type'],
                    'id' => $row['id'],
                    'title' => $row['title'],
                    'item_url' => $row['item_url'],
                    'description' => $row['description'],
                    'external_note' => $row['external_note'],
                    'internal_note' => $row['internal_note'],
                    'start_visibility' => $row['start_visibility'],
                    'end_visibility' => $row['end_visibility'],
                    'use_resource_visibility' => $row['use_resource_visibility'],
                    'use_proxy' => $row['use_proxy'],
                    'folder_id' => $row['folder_id'],
                    'folder_name' => $row['folder_name'],
                    'course_resource_id' => $row['course_resource_id'],
                    'order' => $row['order'],
                    'use_primary_link_visibility' => $row['use_primary_link_visibility'],
                    'primary_link_start_visibility' => $row['primary_link_start_visibility'],
                    'primary_link_end_visibility' => $row['primary_link_end_visibility'],
                    'links' => []
                ];
            }
            
            // Add link if it exists
            if ($row['link_id'] !== null) {
                $electronicResources[$resourceId]['links'][] = [
                    'link_id' => $row['link_id'],
                    'url' => $row['link_url'],
                    'title' => $row['link_title'],
                    'description' => $row['link_description'],
                    'use_proxy' => (bool)$row['link_use_proxy'],
                    'order' => $row['link_order'],
                    'start_visibility' => $row['link_start_visibility'],
                    'end_visibility' => $row['link_end_visibility'],
                    'use_link_visibility' => (bool)$row['use_link_visibility']
                ];
            }
        }
        
        // Convert to indexed array
        $electronicResources = array_values($electronicResources);
        
        // Get physical resources
        $physicalSql = "
            SELECT 
                'physical' as resource_type,
                pr.external_resource_id as id,
                pr.display_name as title,
                pr.resource_type,
                null as item_url,
                null as description,
                null as external_note,
                null as internal_note,
                null as start_visibility,
                null as end_visibility,
                0 as use_proxy,
                pr.folder_id,
                f.name as folder_name,
                pr.reference_id as course_resource_id,
                pr.`order`
            FROM physical_resource_references pr
            LEFT JOIN folders f ON pr.folder_id = f.folder_id
            WHERE pr.offering_id = :offering_id
        ";
        
        $physicalResources = Yii::$app->db->createCommand($physicalSql, [
            ':offering_id' => $offeringId
        ])->queryAll();
        
        // Add empty links array to physical resources for consistency
        foreach ($physicalResources as &$resource) {
            $resource['links'] = [];
            $resource['use_resource_visibility'] = null;
            $resource['use_primary_link_visibility'] = null;
            $resource['primary_link_start_visibility'] = null;
            $resource['primary_link_end_visibility'] = null;
        }
        unset($resource); // Break the reference
        
        // Merge the two arrays
        $mergedResources = array_merge($electronicResources, $physicalResources);
        
        // Sort by order with special handling for electronic resources with order = 999
        usort($mergedResources, function($a, $b) {
            // For electronic resources with order = 999, sort by course_resource_id ASC (matches backend)
            if ($a['resource_type'] === 'electronic' && $a['order'] == 999 && 
                $b['resource_type'] === 'electronic' && $b['order'] == 999) {
                return $a['course_resource_id'] - $b['course_resource_id']; // ASC order
            }
            
            // If one is electronic with order = 999 and the other isn't, handle specially
            if ($a['resource_type'] === 'electronic' && $a['order'] == 999) {
                // Compare against physical order or non-999 electronic order
                return 999 - $b['order'];
            }
            if ($b['resource_type'] === 'electronic' && $b['order'] == 999) {
                // Compare against physical order or non-999 electronic order
                return $a['order'] - 999;
            }
            
            // For all other cases (physical resources, or electronic with order != 999), sort by order
            if ($a['order'] != $b['order']) {
                return $a['order'] - $b['order'];
            }
            
            // If orders are the same, sort by title
            return strcmp($a['title'], $b['title']);
        });
        
        return [
            'resources' => $mergedResources,
            'count' => count($mergedResources)
        ];
    }

        public function actionCreateResource()
        {
            // Retrieve the courseId from POST parameters (non-JSON)
            $courseId = Yii::$app->request->post('courseId');
            $folioData = Yii::$app->request->post('folioData');

            // Decode the JSON raw body into an associative array
            $body = json_decode(Yii::$app->request->getRawBody(), true);

            // Verify that the course exists
            $course = Courses::findOne($courseId);
            if (!$course) {
                throw new NotFoundHttpException('Course not found.');
            }

            // Use the exact offering selected in the React form. Looking up an
            // offering by course and term is ambiguous when a course has
            // multiple sections in the same term.
            $offeringId = filter_var(
                $body['offering_id'] ?? null,
                FILTER_VALIDATE_INT,
                ['options' => ['min_range' => 1]]
            );
            if ($offeringId === false) {
                throw new BadRequestHttpException('A valid "offering_id" is required.');
            }

            $courseOffering = CourseOfferings::findOne($offeringId);
            if (!$courseOffering) {
                throw new NotFoundHttpException('Course offering not found.');
            }
            if ((int)$courseOffering->course_id !== (int)$courseId) {
                throw new BadRequestHttpException('The selected offering does not belong to this course.');
            }

            $folioCourseId = $folioData['courseListingId'] ?? null;
            if (!$folioCourseId) {
                throw new BadRequestHttpException('A FOLIO course listing is required.');
            }
            if ((string)$courseOffering->folio_course_id !== (string)$folioCourseId) {
                throw new BadRequestHttpException('The selected offering does not match the FOLIO course listing.');
            }

            // Ensure the required "title" field is present
            $title = $body['title'] ?? null;
            if (!$title) {
                throw new BadRequestHttpException('Resource "title" is required.');
            }

            // Retrieve other data from the request
            $link              = $body['link'] ?? null;
            $notes             = $body['notes'] ?? null;
            $materialTypeId    = $body['material_type_id'] ?? null;

            // New fields from the form:
            $internalNote      = $body['internal_note'] ?? null;
            $externalNote      = $body['external_note'] ?? null;
            $startVisibility   = $body['start_visibility'] ?? null;
            $endVisibility     = $body['end_visibility'] ?? null;
            $primaryLinkStartVisibility = $body['primary_link_start_visibility'] ?? null;
            $primaryLinkEndVisibility = $body['primary_link_end_visibility'] ?? null;
            $useResourceVisibility = isset($body['use_resource_visibility']) ? (int)$body['use_resource_visibility'] : 0;
            $usePrimaryLinkVisibility = isset($body['use_primary_link_visibility']) ? (int)$body['use_primary_link_visibility'] : 0;
            $useProxy          = isset($body['use_proxy']) ? (int)$body['use_proxy'] : 0;
            $folderId          = $body['folder'] ?? null;

            // Get additional links if provided
            $additionalLinks   = $body['links'] ?? [];

            // Start transaction
            $transaction = Yii::$app->db->beginTransaction();

            try {
                // Create and populate the resource model
                $resource = new Resources();
                $resource->name = $title;
                $resource->item_url = $link;
                $resource->description = $notes;
                $resource->material_type_id = $materialTypeId;
                $resource->internal_note = $internalNote;
                $resource->external_note = $externalNote;
                // Note: Visibility will be set on course_resources, but keep for backward compatibility
                $resource->start_visibility = $startVisibility;
                $resource->end_visibility = $endVisibility;
                $resource->use_proxy = $useProxy;
                $resource->folder_id = $folderId;

                if (!$resource->save()) {
                    throw new ServerErrorHttpException('Failed to create resource: ' . json_encode($resource->getErrors()));
                }

                // Process and save additional links
                if (!empty($additionalLinks) && is_array($additionalLinks)) {
                    foreach ($additionalLinks as $index => $linkData) {
                        // Skip empty URLs
                        if (empty($linkData['url'])) {
                            continue;
                        }

                        $resourceLink = new ResourceLinks();
                        $resourceLink->resource_id = $resource->resource_id;
                        $resourceLink->url = $linkData['url'];
                        $resourceLink->title = $linkData['title'] ?? null;
                        $resourceLink->description = $linkData['description'] ?? null;
                        $resourceLink->use_proxy = isset($linkData['use_proxy']) && $linkData['use_proxy'] ? 1 : 0;
                        $resourceLink->order = $index + 1;

                        if (!$resourceLink->save()) {
                            throw new ServerErrorHttpException('Failed to save link: ' . json_encode($resourceLink->getErrors()));
                        }
                    }
                }

                // Process and save metadata if provided
                if (!empty($body['metadata']) && is_array($body['metadata'])) {
                    foreach ($body['metadata'] as $fieldName => $fieldValue) {
                        // Skip if the field value is blank or only whitespace.
                        if (is_string($fieldValue) && trim($fieldValue) === '') {
                            continue;
                        }
                        $metadata = new ResourceMetadata();
                        $metadata->resource_id = $resource->resource_id;
                        $metadata->field_name = $fieldName;
                        $metadata->field_value = $fieldValue;
                        if (!$metadata->save()) {
                            throw new ServerErrorHttpException('Failed to save metadata: ' . json_encode($metadata->getErrors()));
                        }
                    }
                }

                // Link the resource to the course with visibility settings
                $courseResource = new CourseResources();
                $courseResource->offering_id = $courseOffering->offering_id;
                $courseResource->resource_id = $resource->resource_id;
                
                // Set visibility fields on the course_resources relationship
                $courseResource->start_visibility = $startVisibility;
                $courseResource->end_visibility = $endVisibility;
                $courseResource->use_resource_visibility = $useResourceVisibility;
                $courseResource->primary_link_start_visibility = $primaryLinkStartVisibility;
                $courseResource->primary_link_end_visibility = $primaryLinkEndVisibility;
                $courseResource->use_primary_link_visibility = $usePrimaryLinkVisibility;
                
                if (!$courseResource->save()) {
                    throw new ServerErrorHttpException('Failed to link resource: ' . json_encode($courseResource->getErrors()));
                }

                // Commit transaction
                $transaction->commit();

                return [
                    'resource' => $resource,
                    'course_offering' => $courseOffering->offering_id,
                    'links' => ResourceLinks::findAll(['resource_id' => $resource->resource_id]),
                    'metadata' => ResourceMetadata::findAll(['resource_id' => $resource->resource_id]),
                    'success'  => true,
                ];
            } catch (\Exception $e) {
                // Roll back transaction on error
                $transaction->rollBack();
                throw $e;
            }
        }


    /**
     * 5) POST /course/link-resource?courseId=X&resourceId=Y
     *    Already exists in your code as actionLinkResource()—unchanged for clarity
     */
    public function actionLinkResource()
    {
        $body = Yii::$app->request->getRawBody();
        $body = json_decode($body, true);
        $courseId = $body['courseId'] ?? null;
        $resourceId = $body['resourceId'] ?? null;
        $course = Courses::findOne($courseId);
        if (!$course) {
            throw new NotFoundHttpException('Course not found.');
        }

        $resource = Resources::findOne($resourceId);
        if (!$resource) {
            throw new NotFoundHttpException('Resource not found.');
        }

        // Check if the resource is already linked
        $existingLink = CourseResources::find()
            ->where(['course_id' => $courseId, 'resource_id' => $resourceId])
            ->exists();

        if ($existingLink) {
            throw new BadRequestHttpException('Resource is already linked to the course.');
        }

        $courseResource = new CourseResources();
        $courseResource->course_id = $courseId;
        $courseResource->resource_id = $resourceId;

        if ($courseResource->save()) {
            return [
                'success' => true,
                'message' => 'Resource linked to course successfully.',
            ];
        } else {
            throw new ServerErrorHttpException('Failed to link resource to course.');
        }
    }

    /**
     * 7) DELETE /course/unlink-resource?courseId=X&resourceId=Y
     *    Unlink a resource from a course.
     */

    public function actionUnlinkResource()
    {
        $body = Yii::$app->request->post();
        $courseResourceId = $body['courseResourceId'] ?? null;

        $courseResource = CourseResources::findOne(['course_resource_id' => $courseResourceId]);
        if (!$courseResource) {
            throw new NotFoundHttpException('Link not found.');
        }

        if ($courseResource->delete()) {
            return [
                'success' => true,
                'message' => 'Resource unlinked from course successfully.',
            ];
        } else {
            throw new ServerErrorHttpException('Failed to unlink resource from course.');
        }
    }

    /**
     * 6) GET /course/search-resources?search=...
     *    For reusing existing resources. Simple example searching by title.
     */
    public function actionSearchResources()
    {
        $searchTerm = Yii::$app->request->get('search');
        if (!$searchTerm) {
            $all = Resources::find()->limit(100)->all();
            return ['resources' => $all];
        }

        // Case-insensitive search using LOWER()
        $query = Resources::find()
            ->where(['like', 'LOWER(name)', strtolower($searchTerm)])
            ->limit(100); // limit to avoid huge results

        $resources = $query->all();

        // Optionally join material type info
        // For quick demonstration, let's do raw SQL:
        // If you want to keep it purely AR, you'd map each resource to its MaterialTypes relation.

        // We'll do a simpler approach: just return them as is
        // (If needed, you can do a custom join query here.)
        return ['resources' => $resources];
    }
}
