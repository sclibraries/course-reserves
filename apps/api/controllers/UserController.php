<?php

namespace app\controllers;

use Yii;
use yii\rest\Controller;
use yii\filters\Cors;
use yii\filters\auth\HttpBearerAuth;
use yii\web\Response;
use yii\web\NotFoundHttpException;
use yii\web\ForbiddenHttpException;
use yii\web\UnauthorizedHttpException;
use app\models\User;
use yii\rest\ActiveController;

class UserController extends ActiveController
{

    public $modelClass = 'app\models\User';

    public function init()
    {
        parent::init();
        \Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
    }

    public function behaviors()
    {
        $behaviors = parent::behaviors();

                // CORS settings (must come before auth in order to handle preflight)
                $behaviors['corsFilter'] = [
                    'class' => Cors::class,
                    'cors' => [
                        // Allowed origins
                        'Origin' => \app\components\CorsOriginPolicy::allowedOrigins(),
                        // Allowed request methods
                        'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                        // Allowed request headers sent by the browser in preflight
                        'Access-Control-Request-Headers' => ['Authorization', 'Content-Type', 'X-Requested-With'],
                        // Optional exposed headers
                        'Access-Control-Expose-Headers' => [],
                        // Allow credentials (cookies/authorization) with specific origins only
                        'Access-Control-Allow-Credentials' => true,
                        // Cache preflight response
                        'Access-Control-Max-Age' => 3600,
                    ],
                ];
        
        
        // Ensure all responses are in JSON format
        $behaviors['contentNegotiator'] = [
            'class' => 'yii\filters\ContentNegotiator',
            'formats' => [
                'application/json' => Response::FORMAT_JSON,
            ],
        ];

        // JWT authentication
        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::className(),
            'except' => ['options','view-by-username'],
        ];

        $behaviors['access'] = [
            'class' => \yii\filters\AccessControl::className(),
            'rules' => [
                [
                    'actions' => ['index', 'view', 'create', 'update', 'delete', 'approve', 'reject', 'pending'],
                    'allow' => true,
                    'roles' => ['@'],
                    'matchCallback' => function () {
                        return $this->isAdminUser(Yii::$app->user->identity);
                    },
                ],
                [
                    'actions' => ['me', 'current'],
                    'allow' => true,
                    'roles' => ['@'], // Authenticated users
                ],
                [
                    'actions' => ['options'],
                    'allow' => true,
                    'roles' => ['?', '@'], // Allow anyone to hit OPTIONS for CORS
                ],
            ],
        ];
       
        
        return \app\components\CorsOriginPolicy::corsFirst($behaviors);
    }

    public function actionCurrent()
    {
        return $this->currentUserResponse();
    }

    public function actionMe()
    {
        return $this->currentUserResponse();
    }

    private function currentUserResponse()
    {
        $identity = Yii::$app->user->identity;
        if (!$identity) {
            throw new UnauthorizedHttpException('Not authenticated');
        }

        $user = User::findByUsername($identity->username);
        if (!$user) {
            throw new ForbiddenHttpException('No user account for this login.');
        }

        return [
            'id' => $user->id,
            'username' => $user->username,
            'full_name' => $user->full_name,
            'email' => $user->email,
            'department' => $user->department,
            'institution' => $user->institution,
            'role' => $user->role,
            'is_admin' => $user->role === 'admin',
            'permissions' => $user->getPermissions(),
        ];
    }
    
    public function actionOptions() 
    {
        if (Yii::$app->request->method === 'OPTIONS') {
            Yii::$app->response->headers->set('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
        }
        return [];
    }

    /**
     * List all users (admin only)
     */
    public function actionIndex()
    {
        $this->checkAdminAccess();
        
        $query = User::find();
        
        // Filter by approval status if provided
        $status = Yii::$app->request->get('status');
        if ($status !== null) {
            $query->andWhere(['approved' => $status]);
        }
        
        // Order by most recent first
        $query->orderBy(['created_at' => SORT_DESC]);
        
        return $query->all();
    }
    
    /**
     * Get a specific user by ID
     */
    public function actionView($id)
    {
        $this->checkAdminAccess();
        
        $user = User::findOne($id);
        if (!$user) {
            throw new NotFoundHttpException('User not found');
        }
        
        return $user;
    }
    
    /**
     * Create a new user (admin only)
     */
    public function actionCreate()
    {
        $this->checkAdminAccess();
        
        $user = new User();
        $user->load(Yii::$app->request->getBodyParams(), '');
        $user->created_at = date('Y-m-d H:i:s');
        
        if ($user->validate() && $user->save()) {
            Yii::$app->response->setStatusCode(201); // Created
            return $user;
        }
        
        Yii::$app->response->setStatusCode(422); // Unprocessable Entity
        return ['errors' => $user->errors];
    }
    
    /**
     * Update a user (admin only)
     */
    public function actionUpdate($id)
    {
        $this->checkAdminAccess();
        
        $user = User::findOne($id);
        if (!$user) {
            throw new NotFoundHttpException('User not found');
        }
        
        $user->load(Yii::$app->request->getBodyParams(), '');
        
        if ($user->validate() && $user->save()) {
            return $user;
        }
        
        Yii::$app->response->setStatusCode(422); // Unprocessable Entity
        return ['errors' => $user->errors];
    }
    
    /**
     * Delete a user (admin only)
     */
    public function actionDelete($id)
    {
        $this->checkAdminAccess();
        
        $user = User::findOne($id);
        if (!$user) {
            throw new NotFoundHttpException('User not found');
        }
        
        if ($user->delete()) {
            Yii::$app->response->setStatusCode(204); // No Content
            return [];
        }
        
        Yii::$app->response->setStatusCode(500); // Server Error
        return ['error' => 'Failed to delete user'];
    }
    
    /**
     * Approve a pending user (admin only)
     */
    public function actionApprove($id)
    {
        $this->checkAdminAccess();
        
        $user = User::findOne($id);
        if (!$user) {
            throw new NotFoundHttpException('User not found');
        }
        
        $user->approved = 1;
        
        if ($user->save()) {
            // Send notification email to the approved user
            $this->sendApprovalNotification($user);
            
            return [
                'message' => 'User approved successfully',
                'user' => $user
            ];
        }
        
        Yii::$app->response->setStatusCode(500); // Server Error
        return ['error' => 'Failed to approve user'];
    }
    
    /**
     * Reject a pending user (admin only)
     */
    public function actionReject($id)
    {
        $this->checkAdminAccess();
        
        $user = User::findOne($id);
        if (!$user) {
            throw new NotFoundHttpException('User not found');
        }
        
        // Delete the user or mark as rejected
        if ($user->delete()) {
            return [
                'message' => 'User rejected and removed'
            ];
        }
        
        Yii::$app->response->setStatusCode(500); // Server Error
        return ['error' => 'Failed to reject user'];
    }
    
    /**
     * Get pending user requests
     */
    public function actionPending()
    {
        $this->checkAdminAccess();
        
        return User::find()
            ->where(['approved' => 0])
            ->orderBy(['created_at' => SORT_DESC])
            ->all();
    }
    
    /**
     * Send notification email to user when their account is approved
     */
    private function sendApprovalNotification($user)
    {
        try {
            if (!empty($user->email)) {
                Yii::$app->mailer->compose()
                    ->setTo($user->email)
                    ->setFrom(['coursereserves@smith.edu' => 'Course Reserves System'])
                    ->setSubject('Course Reserves System - Account Approved')
                    ->setTextBody("Dear {$user->full_name},\n\n" .
                                 "Your account for the Course Reserves System has been approved. " .
                                 "You can now log in at:\n\n" .
                                 "https://libtools2.smith.edu/course-reserves/\n\n" .
                                 "Thank you,\n" .
                                 "Smith College Library")
                    ->send();
            }
        } catch (\Exception $e) {
            Yii::error('Failed to send approval email: ' . $e->getMessage(), 'user');
        }
    }

    public function actionViewByUsername($username)
    {
        $user = User::find()->where(['username' => $username])->one();
    
        if (!$user) {
            throw new NotFoundHttpException("User not found.");
        }
    
        return $user;
    }
        
    /**
     * Check if current user has admin access
     */
    private function checkAdminAccess()
    {
        $user = Yii::$app->user->identity;
        
        if (!$this->isAdminUser($user)) {
            throw new ForbiddenHttpException('You do not have permission to perform this action.');
        }
    }

    private function isAdminUser($user): bool
    {
        return $user && $user->role === 'admin';
    }
}
