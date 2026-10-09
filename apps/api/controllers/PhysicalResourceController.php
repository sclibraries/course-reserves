<?php

namespace app\controllers;

use Yii;
use yii\rest\Controller;
use yii\filters\Cors;
use yii\filters\auth\HttpBearerAuth;
use app\models\PhysicalResourceReferences;
use app\models\CourseOfferings;
use yii\web\NotFoundHttpException;
use yii\web\BadRequestHttpException;
use yii\web\Response;
use yii\web\ServerErrorHttpException;

class PhysicalResourceController extends Controller
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();

        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            'except' => ['options', 'get-references', 'create-or-update-reference', 'cleanup-references'],
        ];

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

        return $behaviors;
    }

    public function actionOptions() {
        Yii::info('OPTIONS request received for PhysicalResourceController');
        Yii::$app->response->headers->set('Allow', 'POST, GET, OPTIONS');
    }

    public function actionCreateOrUpdateReference()
    {
        $data = Yii::$app->request->post();
        
        // Find existing reference or create new one
        $reference = PhysicalResourceReferences::findOne([
            'external_resource_id' => $data['external_resource_id'],
            'offering_id' => $data['offering_id']
        ]);
        
        if (!$reference) {
            $reference = new PhysicalResourceReferences();
        }
        
        $reference->attributes = $data;
        
        if ($reference->save()) {
            return $reference;
        } else {
            Yii::$app->response->statusCode = 400;
            return ['errors' => $reference->errors];
        }
    }

    public function actionGetReferences($offering_id)
    {
        return PhysicalResourceReferences::find()
            ->where(['offering_id' => $offering_id])
            ->orderBy('order ASC')
            ->all();
    }

    public function actionUpdateResourceOrder()
    {
        // Handle both JSON and form data
        $body = json_decode(Yii::$app->request->getRawBody(), true);
        if ($body === null) {
            $body = Yii::$app->request->post();
        }
        
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
        
        foreach ($resources as $resource) {
            if (!isset($resource['external_resource_id']) || !isset($resource['order'])) {
                continue;
            }
            
            $reference = PhysicalResourceReferences::findOne([
                'external_resource_id' => $resource['external_resource_id'],
                'offering_id' => $offeringId
            ]);
            
            if (!$reference) {
                $reference = new PhysicalResourceReferences([
                    'external_resource_id' => $resource['external_resource_id'],
                    'offering_id' => $offeringId,
                    'display_name' => $resource['display_name'] ?? null,
                ]);
            }
            
            $reference->order = $resource['order'];
            if (!$reference->save()) {
                Yii::error('Failed to save physical resource reference: ' . json_encode($reference->errors));
                throw new \yii\web\ServerErrorHttpException('Failed to update resource order.');
            }
        }
        
        return ['success' => true];
    }

    /**
     * Cleanup orphaned physical resource references
     * Removes references that no longer exist in FOLIO
     * 
     * @return array
     */
    public function actionCleanupReferences()
    {
        \Yii::$app->response->format = Response::FORMAT_JSON;
        
        $request = \Yii::$app->request;
        $data = json_decode($request->getRawBody(), true);
        
        if (!isset($data['offering_id']) || !isset($data['folio_resource_ids'])) {
            throw new BadRequestHttpException('Missing required parameters: offering_id and folio_resource_ids');
        }
        
        $offeringId = $data['offering_id'];
        $folioResourceIds = $data['folio_resource_ids'];
        
        // Validate that folio_resource_ids is an array
        if (!is_array($folioResourceIds)) {
            throw new BadRequestHttpException('folio_resource_ids must be an array');
        }
        
        try {
            $deletedCount = $this->cleanupOrphanedReferences($offeringId, $folioResourceIds);
            
            return [
                'success' => true,
                'message' => "Cleaned up {$deletedCount} orphaned physical resource references",
                'deleted_count' => $deletedCount
            ];
        } catch (\Exception $e) {
            \Yii::error("Failed to cleanup physical resource references: " . $e->getMessage());
            throw new ServerErrorHttpException('Failed to cleanup physical resource references');
        }
    }

    /**
     * Remove physical resource references that no longer exist in FOLIO
     * 
     * @param int $offeringId The course offering ID
     * @param array $folioResourceIds Array of current FOLIO resource IDs
     * @return int Number of deleted references
     */
    private function cleanupOrphanedReferences($offeringId, $folioResourceIds)
    {
        // Get all existing physical resource references for this offering
        $existingReferences = PhysicalResourceReferences::find()
            ->where(['offering_id' => $offeringId])
            ->all();
        
        $deletedCount = 0;
        
        foreach ($existingReferences as $reference) {
            // If this reference's external_resource_id is not in the current FOLIO list, delete it
            if (!in_array($reference->external_resource_id, $folioResourceIds)) {
                \Yii::info("Deleting orphaned physical resource reference: {$reference->external_resource_id} for offering {$offeringId}");
                
                if ($reference->delete()) {
                    $deletedCount++;
                } else {
                    \Yii::warning("Failed to delete physical resource reference: " . json_encode($reference->errors));
                }
            }
        }
        
        return $deletedCount;
    }

    /**
     * Get a physical resource reference by its external ID
     * 
     * @param string $external_id The external resource ID
     * @param integer $offering_id Optional offering ID to narrow the search
     * @return PhysicalResourceReferences|array
     * @throws NotFoundHttpException
     */
    public function actionGetByExternalId($external_id, $offering_id = null)
    {
        $query = PhysicalResourceReferences::find()
            ->where(['external_resource_id' => $external_id]);
            
        if ($offering_id !== null) {
            $query->andWhere(['offering_id' => $offering_id]);
        }
        
        $reference = $query->one();
        
        if (!$reference) {
            throw new NotFoundHttpException('Physical resource reference not found.');
        }
        
        return $reference;
    }
}
