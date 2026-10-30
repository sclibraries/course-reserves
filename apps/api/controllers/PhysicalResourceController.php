<?php

namespace app\controllers;

use Yii;
use app\components\Roles;
use app\components\CorsOriginPolicy;
use app\filters\RoleAccessFilter;
use app\models\CourseOfferings;
use app\models\PhysicalResourceReferences;
use app\services\PhysicalResourceReferenceIdentity;
use yii\filters\Cors;
use yii\filters\auth\HttpBearerAuth;
use yii\rest\Controller;
use yii\web\BadRequestHttpException;
use yii\web\NotFoundHttpException;
use yii\web\Response;
use yii\web\ServerErrorHttpException;

class PhysicalResourceController extends Controller
{
    private $referenceFields = [
        'reference_id', 'external_resource_id', 'resource_type', 'display_name', 'offering_id',
        'folder_id', 'order', 'created_at', 'updated_at',
    ];

    public function behaviors()
    {
        $behaviors = parent::behaviors();
        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            'except' => ['options', 'get-references'],
        ];
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => CorsOriginPolicy::allowedOrigins(),
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 3600,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
            ],
        ];
        $behaviors['roleAccess'] = [
            'class' => RoleAccessFilter::class,
            'rules' => [
                'create-or-update-reference' => Roles::STAFF,
                'update-resource-order' => Roles::STAFF,
                'cleanup-references' => Roles::STAFF,
                'get-by-external-id' => Roles::STAFF,
            ],
        ];
        return CorsOriginPolicy::corsFirst($behaviors);
    }

    public function actionOptions()
    {
        Yii::info('OPTIONS request received for PhysicalResourceController');
        Yii::$app->response->headers->set('Allow', 'POST, GET, OPTIONS');
    }

    public function actionCreateOrUpdateReference()
    {
        $data = Yii::$app->request->post();
        if (!isset($data['external_resource_id'], $data['offering_id'])
            || !is_scalar($data['external_resource_id'])
            || trim((string)$data['external_resource_id']) === ''
        ) {
            throw new BadRequestHttpException('external_resource_id and offering_id are required.');
        }

        $data['external_resource_id'] = trim((string)$data['external_resource_id']);
        $reference = PhysicalResourceReferences::findOne([
            'external_resource_id' => $data['external_resource_id'],
            'offering_id' => $data['offering_id'],
        ]);
        $isNew = !$reference;
        if (!$reference) {
            $reference = new PhysicalResourceReferences();
        }
        $this->setMetadata($reference, $data);
        if ($isNew || !$reference->identity_status) {
            $identity = (new PhysicalResourceReferenceIdentity())->resolve(null, [
                'external_resource_id' => $data['external_resource_id'],
                'destination_class' => 'print',
            ]);
            $this->setIdentity($reference, $identity);
        }

        if ($reference->save()) {
            return $this->staffReference($reference);
        }
        Yii::$app->response->statusCode = 400;
        return ['errors' => $reference->errors];
    }

    public function actionGetReferences($offering_id)
    {
        $references = PhysicalResourceReferences::find()
            ->where(['offering_id' => $offering_id])
            ->orderBy('order ASC')
            ->all();
        return array_map([$this, 'publicReference'], $references);
    }

    public function actionUpdateResourceOrder()
    {
        $body = json_decode(Yii::$app->request->getRawBody(), true);
        if (!is_array($body)) {
            $body = Yii::$app->request->post();
        }
        if (!isset($body['offering_id'], $body['resources']) || !is_array($body['resources'])) {
            throw new BadRequestHttpException('Missing offering_id or resources data.');
        }

        $offeringId = $body['offering_id'];
        if (!CourseOfferings::findOne($offeringId)) {
            throw new NotFoundHttpException('Course offering not found.');
        }
        foreach ($body['resources'] as $resourceData) {
            if (!is_array($resourceData) || !isset($resourceData['external_resource_id'], $resourceData['order'])
                || !is_scalar($resourceData['external_resource_id'])
                || trim((string)$resourceData['external_resource_id']) === ''
            ) {
                continue;
            }
            $externalId = trim((string)$resourceData['external_resource_id']);
            $reference = PhysicalResourceReferences::findOne([
                'external_resource_id' => $externalId,
                'offering_id' => $offeringId,
            ]);
            if (!$reference) {
                $reference = new PhysicalResourceReferences([
                    'external_resource_id' => $externalId,
                    'offering_id' => $offeringId,
                    'display_name' => $resourceData['display_name'] ?? '',
                ]);
                $identity = (new PhysicalResourceReferenceIdentity())->resolve(null, [
                    'external_resource_id' => $externalId,
                    'destination_class' => 'print',
                ]);
                $this->setIdentity($reference, $identity);
            }
            $reference->order = $resourceData['order'];
            if (!$reference->save()) {
                Yii::error('Failed to save physical resource reference: ' . json_encode($reference->errors));
                throw new ServerErrorHttpException('Failed to update resource order.');
            }
        }
        return ['success' => true];
    }

    public function actionCleanupReferences()
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        $data = json_decode(Yii::$app->request->getRawBody(), true);
        if (!is_array($data) || !array_key_exists('offering_id', $data)
            || !array_key_exists('folio_resource_ids', $data)
        ) {
            throw new BadRequestHttpException('Missing required parameters: offering_id and folio_resource_ids');
        }
        if (!is_array($data['folio_resource_ids'])) {
            throw new BadRequestHttpException('folio_resource_ids must be an array');
        }

        try {
            $deletedCount = $this->cleanupOrphanedReferences($data['offering_id'], $data['folio_resource_ids']);
            return [
                'success' => true,
                'message' => "Cleaned up {$deletedCount} orphaned physical resource references",
                'deleted_count' => $deletedCount,
            ];
        } catch (BadRequestHttpException $exception) {
            throw $exception;
        } catch (\Throwable $exception) {
            Yii::error('Failed to cleanup physical resource references: ' . $exception->getMessage());
            throw new ServerErrorHttpException('Failed to cleanup physical resource references');
        }
    }

    public function actionGetByExternalId($external_id, $offering_id = null)
    {
        $query = PhysicalResourceReferences::find()->where(['external_resource_id' => $external_id]);
        if ($offering_id !== null) {
            $query->andWhere(['offering_id' => $offering_id]);
        }
        $reference = $query->one();
        if ($reference) {
            return $this->staffReference($reference);
        }
        if ($offering_id !== null) {
            $matches = PhysicalResourceReferences::find()
                ->where([
                    'folio_instance_id' => $external_id,
                    'offering_id' => $offering_id,
                    'identity_status' => 'verified',
                ])
                ->limit(2)
                ->all();
            if (count($matches) === 1) {
                return $this->staffReference($matches[0]);
            }
        }
        throw new NotFoundHttpException('Physical resource reference not found.');
    }

    private function cleanupOrphanedReferences($offeringId, array $folioResourceIds)
    {
        $offeringId = filter_var($offeringId, FILTER_VALIDATE_INT);
        if ($offeringId === false || $offeringId < 1 || !$folioResourceIds) {
            return 0;
        }
        $ids = [];
        foreach ($folioResourceIds as $id) {
            if (!is_scalar($id) || trim((string)$id) === '') {
                throw new BadRequestHttpException('folio_resource_ids must contain non-empty identifiers.');
            }
            $ids[] = (string)$id;
        }
        $ids = array_values(array_unique($ids));
        if (!$ids) {
            return 0;
        }

        $matchingOfferingIds = PhysicalResourceReferences::find()
            ->select(['offering_id'])
            ->where(['external_resource_id' => $ids])
            ->column();
        $hasCurrentOfferingMatch = false;
        foreach ($matchingOfferingIds as $matchingOfferingId) {
            if ((int)$matchingOfferingId !== (int)$offeringId) {
                return 0;
            }
            $hasCurrentOfferingMatch = true;
        }
        if (!$hasCurrentOfferingMatch) {
            return 0;
        }

        $params = [':offering' => $offeringId];
        $placeholders = [];
        foreach ($ids as $index => $id) {
            $placeholder = ':resource' . $index;
            $placeholders[] = $placeholder;
            $params[$placeholder] = $id;
        }
        $sql = 'SELECT pr.reference_id FROM physical_resource_references pr '
            . 'WHERE pr.offering_id = :offering AND pr.identity_status = "verified" '
            . 'AND pr.external_resource_id NOT IN (' . implode(', ', $placeholders) . ') '
            . 'AND NOT EXISTS (SELECT 1 FROM submission_publication_state ps '
            . 'WHERE (JSON_UNQUOTE(JSON_EXTRACT(ps.published_destination_json, "$.kind")) = "physical" '
            . 'AND JSON_UNQUOTE(JSON_EXTRACT(ps.published_destination_json, "$.physical_reference_id")) '
            . '= CAST(pr.reference_id AS CHAR)) OR '
            . '(JSON_UNQUOTE(JSON_EXTRACT(ps.published_snapshot, "$.kind")) = "physical" '
            . 'AND JSON_UNQUOTE(JSON_EXTRACT(ps.published_snapshot, "$.reference.reference_id")) '
            . '= CAST(pr.reference_id AS CHAR))) '
            . 'AND NOT EXISTS (SELECT 1 FROM submission_new_resources n '
            . 'WHERE n.materialized_physical_reference_id = pr.reference_id) '
            . 'AND NOT EXISTS (SELECT 1 FROM submission_reuse_resources r '
            . 'WHERE r.materialized_physical_reference_id = pr.reference_id)';
        $referenceIds = Yii::$app->db->createCommand($sql, $params)->queryColumn();
        if (!$referenceIds) {
            return 0;
        }
        return Yii::$app->db->createCommand()->delete(
            'physical_resource_references', ['reference_id' => $referenceIds]
        )->execute();
    }

    private function setMetadata(PhysicalResourceReferences $reference, array $data)
    {
        foreach (['external_resource_id', 'resource_type', 'display_name', 'offering_id', 'folder_id', 'order'] as $field) {
            if (array_key_exists($field, $data)) {
                $reference->$field = $data[$field];
            }
        }
    }

    private function setIdentity(PhysicalResourceReferences $reference, array $identity)
    {
        $reference->external_resource_id = $identity['external_resource_id'];
        $reference->folio_instance_id = $identity['folio_instance_id'];
        $reference->legacy_identifier = $identity['legacy_identifier'];
        $reference->legacy_identifier_type = $identity['legacy_identifier_type'];
        $reference->identity_status = $identity['identity_status'];
        $reference->identity_provenance_json = json_encode($identity['provenance'], JSON_UNESCAPED_SLASHES);
    }

    private function staffReference(PhysicalResourceReferences $reference)
    {
        return array_intersect_key(
            $reference->getAttributes(),
            array_flip(array_merge($this->referenceFields, [
                'folio_instance_id', 'legacy_identifier', 'legacy_identifier_type', 'identity_status',
            ]))
        );
    }

    private function publicReference(PhysicalResourceReferences $reference)
    {
        $data = array_intersect_key($reference->getAttributes(), array_flip($this->referenceFields));
        if ($this->hasVerifiedIdentity($reference)) {
            $data['folio_instance_id'] = $reference->folio_instance_id;
        }
        return $data;
    }

    private function hasVerifiedIdentity(PhysicalResourceReferences $reference)
    {
        return $reference->hasAttribute('identity_status')
            && $reference->identity_status === 'verified'
            && $reference->hasAttribute('folio_instance_id')
            && $this->hasValue($reference->folio_instance_id);
    }

    private function hasValue($value)
    {
        return $value !== null && trim((string)$value) !== '';
    }
}
