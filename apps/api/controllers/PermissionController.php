<?php
// filepath: /var/www/html/course-reserves/backend/controllers/PermissionController.php
namespace app\controllers;

use Yii;
use yii\rest\ActiveController;
use yii\filters\Cors;
use yii\web\Response;
use yii\web\UnauthorizedHttpException;
use yii\web\NotFoundHttpException;
use app\models\InstitutionPermission;
use yii\filters\auth\HttpBearerAuth;

class PermissionController extends ActiveController
{
    public $modelClass = 'app\models\InstitutionPermission';

    public function behaviors()
    {
        $behaviors = parent::behaviors();
        
        // Add authentication via Bearer token
        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            'except' => ['options'],
        ];
        
        // Ensure all responses are in JSON format
        $behaviors['contentNegotiator'] = [
            'class' => 'yii\filters\ContentNegotiator',
            'formats' => [
                'application/json' => Response::FORMAT_JSON,
            ],
        ];

        // CORS settings
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => \app\components\CorsOriginPolicy::allowedOrigins(),
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 3600,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
                'Access-Control-Expose-Headers' => [],
            ],
        ];
        
        // Add access control
        $behaviors['access'] = [
            'class' => \yii\filters\AccessControl::className(),
            'rules' => [
                [
                    'allow' => true,
                    'roles' => ['@'],
                    'matchCallback' => function ($rule, $action) {
                        // Only admin users can manage permissions
                        return Yii::$app->user->identity->role === 'admin';
                    },
                ],
            ],
            'except' => ['options'],
        ];

        return \app\components\CorsOriginPolicy::corsFirst($behaviors);
    }
    
    public function actions()
    {
        $actions = parent::actions();
        
        // Customize the index action
        $actions['index'] = [
            'class' => 'yii\rest\IndexAction',
            'modelClass' => $this->modelClass,
            'prepareDataProvider' => function() {
                $dataProvider = new \yii\data\ActiveDataProvider([
                    'query' => InstitutionPermission::find()
                        ->orderBy(['institution' => SORT_ASC, 'permission_key' => SORT_ASC]),
                ]);
                return $dataProvider;
            }
        ];
        
        return $actions;
    }
    
    public function actionOptions($id = null) 
    {
        if (Yii::$app->request->method === 'OPTIONS') {
            if ($id !== null) {
                Yii::$app->response->headers->set('Allow', 'GET, PUT, DELETE, OPTIONS');
            } else {
                Yii::$app->response->headers->set('Allow', 'GET, POST, OPTIONS');
            }
        }
        return [];
    }

    /**
     * Get permissions grouped by institution
     */
    public function actionGrouped()
    {
        if (Yii::$app->user->identity->role !== 'admin') {
            throw new UnauthorizedHttpException('Admin access required');
        }
        
        // Get all permissions grouped by institution
        $permissions = InstitutionPermission::find()
            ->orderBy(['institution' => SORT_ASC, 'permission_key' => SORT_ASC])
            ->all();
            
        // Group by institution
        $result = [];
        foreach ($permissions as $permission) {
            if (!isset($result[$permission->institution])) {
                $result[$permission->institution] = [];
            }
            
            $result[$permission->institution][] = [
                'id' => $permission->id,
                'institution' => $permission->institution,
                'permission_key' => $permission->permission_key,
                'granted' => (bool)$permission->granted,
                'created_at' => $permission->created_at,
                'updated_at' => $permission->updated_at,
            ];
        }
        
        return ['institutions' => $result];
    }
    
    /**
     * Toggle permission granted status
     */
    public function actionToggle($id)
    {
        if (Yii::$app->user->identity->role !== 'admin') {
            throw new UnauthorizedHttpException('Admin access required');
        }
        
        $model = InstitutionPermission::findOne($id);
        if (!$model) {
            throw new NotFoundHttpException("Permission with ID $id not found");
        }
        
        $model->granted = !$model->granted;
        
        if ($model->save()) {
            return $model;
        }
        
        Yii::$app->response->statusCode = 400;
        return ['errors' => $model->errors];
    }
    
    /**
     * Get available permission keys
     */
    public function actionAvailable()
    {
        if (Yii::$app->user->identity->role !== 'admin') {
            throw new UnauthorizedHttpException('Admin access required');
        }
        
        // Return list of standard permission keys
        return [
            'permissions' => [
                'manage_courses' => 'Manage Courses',
                'manage_resources' => 'Manage Resources',
                'view_reports' => 'View Reports',
                'customize_smith.edu' => 'Customize Smith College',
                'customize_hampshire.edu' => 'Customize Hampshire College',
                'customize_amherst.edu' => 'Customize Amherst College',
                'customize_mtholyoke.edu' => 'Customize Mount Holyoke College',
                'customize_umass.edu' => 'Customize UMass Amherst',
            ],
            'institutions' => [
                'smith.edu' => 'Smith College',
                'hampshire.edu' => 'Hampshire College',
                'amherst.edu' => 'Amherst College',
                'mtholyoke.edu' => 'Mount Holyoke College',
                'umass.edu' => 'UMass Amherst',
            ]
        ];
    }
}
