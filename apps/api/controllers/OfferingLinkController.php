<?php
namespace app\controllers;

use Yii;
use yii\rest\ActiveController;
use yii\web\BadRequestHttpException;
use yii\web\NotFoundHttpException;
use app\models\OfferingLink;
use app\models\CourseOfferings;
use app\models\Courses;
use app\models\CourseResources;
use yii\filters\Cors;
use yii\filters\auth\HttpBearerAuth;
use app\components\Roles;
use app\filters\RoleAccessFilter;

class OfferingLinkController extends ActiveController
{
    public $modelClass = OfferingLink::class;

    public function behaviors()
    {
        $behaviors = parent::behaviors();

        // Re-add the authenticator and exclude OPTIONS requests from authentication
        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            'except' => ['options', 'find-links', 'find-linked-offerings', 'find-linked-resources', 'get-linked-resources'],
        ];
        // Add the CORS filter first so that it handles OPTIONS requests properly
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => array_merge([
                    'http://localhost:5173',
                ], Yii::$app->params['corsOrigins'] ?? []),
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 3600,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
            ],
        ];


        $behaviors['roleAccess'] = [
            'class' => RoleAccessFilter::class,
            'rules' => [
                'create' => Roles::STAFF,
                'update' => Roles::STAFF,
                'delete' => Roles::STAFF,
                'link-existing-resources' => Roles::STAFF,
                'update-resource-order' => Roles::STAFF,
            ],
        ];

        return $behaviors;
    }

    public function actions()
    {
        $actions = parent::actions();

        // Customize create action to handle bidirectional links
        unset($actions['create']);
        
        // Customize delete action to handle both directions
        unset($actions['delete']);

        return $actions;
    }

    public function actionCreate()
    {
        $model = new OfferingLink();
        $model->load(Yii::$app->request->post(), '');

        // Start transaction for atomic operation
        $transaction = Yii::$app->db->beginTransaction();
        try {
            if ($model->save()) {
                $transaction->commit();
                Yii::$app->response->setStatusCode(201);
                return $model;
            }
            
            $transaction->rollBack();
            throw new BadRequestHttpException(json_encode($model->errors));
            
        } catch (\Exception $e) {
            $transaction->rollBack();
            throw new BadRequestHttpException($e->getMessage());
        }
    }

    public function actionDelete($id)
    {
        // Find and delete both directions
        $model = OfferingLink::findOne($id);
        
        if (!$model) {
            throw new NotFoundHttpException("Link not found");
        }

        $offeringId = $model->offering_id;
        $linkedOfferingId = $model->linked_offering_id;

        $transaction = Yii::$app->db->beginTransaction();
        try {
            if ($model->delete()) {
                // Delete reverse link
                OfferingLink::deleteAll([
                    'offering_id' => $linkedOfferingId,
                    'linked_offering_id' => $offeringId,
                ]);
                
                $transaction->commit();
                Yii::$app->response->setStatusCode(204);
                return;
            }
            
            $transaction->rollBack();
            throw new BadRequestHttpException("Failed to delete link");

        } catch (\Exception $e) {
            $transaction->rollBack();
            throw new BadRequestHttpException($e->getMessage());
        }
    }

    // Additional custom action for finding links by offering
    public function actionFindLinks($offering_id)
    {
        return OfferingLink::find()
            ->where(['offering_id' => $offering_id])
            ->orWhere(['linked_offering_id' => $offering_id])
            ->all();
    }

    public function actionFindLinkedOfferings($offering_id)
    {
        $sql = "SELECT co.*, c.course_name, c.course_number, c.department_name, co.folio_course_id, ol.offering_link_id
                FROM course_offerings co
                JOIN courses c ON co.course_id = c.course_id
                JOIN offering_links ol ON co.offering_id = ol.linked_offering_id
                WHERE ol.offering_id = :offering_id";
        return Yii::$app->db->createCommand($sql, [':offering_id' => $offering_id])->queryAll();
    }

    public function actionFindLinkedResources($offering_id)
    {
        $sql = "SELECT * FROM resources 
                WHERE resource_id IN (
                    SELECT resource_id 
                    FROM course_resources 
                    WHERE offering_id = :offering_id
                )";
        return Yii::$app->db->createCommand($sql, [':offering_id' => $offering_id])->queryAll();
    }

    public function actionLinkExistingResources()
    {
        $offeringId = Yii::$app->request->get('offering_id');
        $resourceId = Yii::$app->request->get('resource_id');
        
        $transaction = Yii::$app->db->beginTransaction();
        try {
            // Check if a specific order was provided
            $order = Yii::$app->request->get('order', null);
            
            $model = new CourseResources([
                'offering_id' => $offeringId,
                'resource_id' => $resourceId,
            ]);
            
            // Assign order if provided, otherwise it will use the default (999)
            if ($order !== null) {
                $model->order = (int)$order;
            }
            
            $model->save();
            
            $transaction->commit();
            Yii::$app->response->setStatusCode(201);
            return $model;
            
        } catch (\Exception $e) {
            $transaction->rollBack();
            throw new BadRequestHttpException($e->getMessage());
        }
    }

    /**
     * Update the order of resources for a specific course offering
     */
    public function actionUpdateResourceOrder()
    {
        $body = Yii::$app->request->post();
        
        if (!isset($body['offering_id']) || !isset($body['resources'])) {
            throw new BadRequestHttpException('Missing offering_id or resources data.');
        }
        
        $offeringId = $body['offering_id'];
        $resources = $body['resources'];
        
        // Verify the offering exists
        $offering = CourseOfferings::findOne($offeringId);
        if (!$offering) {
            throw new NotFoundHttpException('Course offering not found.');
        }
        
        $transaction = Yii::$app->db->beginTransaction();
        try {
            foreach ($resources as $resource) {
                if (!isset($resource['resource_id']) || !isset($resource['order'])) {
                    continue;
                }
                
                $courseResource = CourseResources::findOne([
                    'resource_id' => $resource['resource_id'],
                    'offering_id' => $offeringId
                ]);
                
                if ($courseResource) {
                    $courseResource->order = (int)$resource['order'];
                    if (!$courseResource->save()) {
                        throw new BadRequestHttpException(json_encode($courseResource->errors));
                    }
                }
            }
            
            $transaction->commit();
            return ['success' => true];
            
        } catch (\Exception $e) {
            $transaction->rollBack();
            throw new BadRequestHttpException($e->getMessage());
        }
    }

    public function actionGetLinkedResources()
    {
        $courseListingId = Yii::$app->request->get('courseListingId'); 

        //find the latest course. There could be many
        $latestOffering = CourseOfferings::find()
            ->where(['folio_course_id' => $courseListingId])
            ->orderBy(['start_date' => SORT_DESC])
            ->one();

        $course = Courses::findOne($latestOffering->course_id);
        if(!$course) {
            throw new NotFoundHttpException('Course not found.');
        }

        if (!$latestOffering) {
            throw new NotFoundHttpException('Course offering not found.');
        }
        

        // Fetch linked offerings
        $linkedOffering = OfferingLink::findOne(['offering_id' => $latestOffering->offering_id]);
        
        if (!$linkedOffering) {
            return [
                'course' => $course,
                'resources' => [],
                'count' => 0,
            ];
        }
    
        $sql = "
            SELECT r.resource_id, r.name, r.item_url, r.description, r.external_note, r.internal_note, 
                   r.start_visibility, r.end_visibility, r.use_proxy, r.folder_id,
                   mt.name AS material_type_name,
                   rm.field_name, rm.field_value,
                   cr.course_resource_id, cr.order,
                   f.folder_id, f.name as folder_name
            FROM course_resources cr
            JOIN resources r ON cr.resource_id = r.resource_id
            LEFT JOIN material_types mt ON r.material_type_id = mt.material_type_id
            LEFT JOIN resource_metadata rm ON r.resource_id = rm.resource_id
            LEFT JOIN folders f ON r.folder_id = f.folder_id
            WHERE cr.offering_id = :linked_offering_id
            ORDER BY cr.order ASC
        ";
        
        $rows = Yii::$app->db->createCommand($sql, [
            ':linked_offering_id' => $linkedOffering->linked_offering_id
        ])->queryAll();
        
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
                    'order' => $row['order'], // Make sure order is included in the response
                    'metadata' => []
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
        
        // Re-index the array to return a list rather than an associative array keyed by resource_id.
        $resources = array_values($resources);
    
        return [
            'course' => $course,
            'offering' => $linkedOffering,
            'resources' => $resources,
            'count' => count($resources),
        ];
    }
}
