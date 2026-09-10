<?php

namespace app\controllers;

use Yii;
use yii\rest\ActiveController;
use yii\filters\Cors;
use yii\web\NotFoundHttpException;
use app\models\MaterialTypes;
use app\models\MaterialTypeFields;

class MaterialTypeController extends ActiveController
{
    public $modelClass = 'app\models\MaterialTypes';

    /**
     * Define behaviors for authentication, CORS, and access rules.
     */
    public function behaviors()
    {
        $behaviors = parent::behaviors();

        // Enable CORS
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => ['http://localhost:5173', 'https://libtools2.smith.edu'], 
                'Access-Control-Request-Method' => ['GET'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization'],
            ],
        ];

        return $behaviors;
    }

    /**
     * Get all material types.
     * Example API Endpoint: GET /material-type/all
     */
    public function actionAll()
    {
        $materialTypes = MaterialTypes::find()
            ->select(['material_type_id', 'name', 'description'])
            ->orderBy(['name' => SORT_ASC])
            ->asArray()
            ->all();

        return ['status' => 'success', 'data' => $materialTypes];
    }

    /**
     * Get all fields for a specific material type.
     * Example API Endpoint: GET /material-type/fields?material_type_id=1
     */
    public function actionFields($material_type_id)
    {
        // Ensure the material type exists before querying fields
        $materialType = MaterialTypes::findOne(['material_type_id' => $material_type_id]);
        if (!$materialType) {
            throw new NotFoundHttpException('Invalid material type specified.');
        }

        $fields = MaterialTypeFields::find()
            ->where(['material_type_id' => $materialType->material_type_id])
            ->orderBy(['sort_order' => SORT_ASC])
            ->asArray()
            ->all();

        if (!$fields) {
            throw new NotFoundHttpException('No fields found for this material type.');
        }

        return ['status' => 'success', 'data' => $fields];
    }
}
