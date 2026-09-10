<?php

namespace app\controllers;

use Yii;
use yii\rest\Controller;
use yii\filters\auth\HttpBearerAuth;
use yii\filters\ContentNegotiator;
use yii\web\Response;
use yii\web\NotFoundHttpException;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;
use yii\data\ActiveDataProvider;
use app\models\FacultyProxyPermission;
use app\models\FacultyProxyCoursePermission;

/**
 * Faculty Proxy Management Controller
 * Handles proxy invitations and permissions
 */
class FacultyProxyController extends Controller
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();
        
        $behaviors['contentNegotiator'] = [
            'class' => ContentNegotiator::class,
            'formats' => [
                'application/json' => Response::FORMAT_JSON,
            ],
        ];

        // CORS handling (must run before auth)
        $behaviors['corsFilter'] = [
            'class' => \yii\filters\Cors::class,
            'cors' => [
                'Origin' => [
                    'https://libtools2.smith.edu',
                    'http://localhost:3001',
                    'http://localhost:5173',
                    'http://127.0.0.1:3001',
                    'http://127.0.0.1:5173',
                ],
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
                'Access-Control-Request-Headers' => ['*'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 86400,
            ],
        ];

        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            'except' => ['options', 'accept-invitation', 'validate-token'],
        ];

        return $behaviors;
    }

    /**
     * Validate faculty session before each action
     */
    public function beforeAction($action)
    {
        if (in_array($action->id, ['options', 'accept-invitation', 'validate-token'])) {
            return true; // Skip auth for these actions
        }

        // Validate faculty session (same as FacultySubmissionController)
        $authHeader = Yii::$app->request->headers->get('Authorization');
        if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            throw new ForbiddenHttpException('Missing authorization header');
        }

        $sessionToken = $matches[1];
        
        session_start();
        if (!isset($_SESSION['faculty_auth']) || $_SESSION['faculty_auth']['session_token'] !== $sessionToken) {
            throw new ForbiddenHttpException('Invalid session token');
        }

        if (strtotime($_SESSION['faculty_auth']['expires_at']) < time()) {
            unset($_SESSION['faculty_auth']);
            throw new ForbiddenHttpException('Session expired');
        }

        Yii::$app->params['facultyUser'] = $_SESSION['faculty_auth'];

        return parent::beforeAction($action);
    }

    /**
     * Handle OPTIONS requests for CORS
     */
    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    /**
     * Get faculty's proxy permissions (who they've granted access to)
     */
    public function actionMyProxies()
    {
        $facultyUser = Yii::$app->params['facultyUser'];
        
        $dataProvider = new ActiveDataProvider([
            'query' => FacultyProxyPermission::find()
                ->where(['faculty_shibboleth_id' => $facultyUser['user_id']])
                ->with(['coursePermissions'])
                ->orderBy(['created_at' => SORT_DESC]),
            'pagination' => [
                'pageSize' => 20,
            ],
        ]);

        return $dataProvider;
    }

    /**
     * Get permissions where current user is a proxy
     */
    public function actionMyFacultyAccess()
    {
        $facultyUser = Yii::$app->params['facultyUser'];
        
        $dataProvider = new ActiveDataProvider([
            'query' => FacultyProxyPermission::find()
                ->where([
                    'proxy_shibboleth_id' => $facultyUser['user_id'],
                    'status' => FacultyProxyPermission::STATUS_ACTIVE
                ])
                ->with(['coursePermissions'])
                ->orderBy(['accepted_at' => SORT_DESC]),
            'pagination' => [
                'pageSize' => 20,
            ],
        ]);

        return $dataProvider;
    }

    /**
     * Invite a proxy
     */
    public function actionInviteProxy()
    {
        $facultyUser = Yii::$app->params['facultyUser'];
        $data = Yii::$app->request->getBodyParams();

        // Validate required fields
        if (empty($data['proxy_email'])) {
            throw new BadRequestHttpException('proxy_email is required');
        }

        // Check for existing invitation
        $existing = FacultyProxyPermission::find()
            ->where([
                'faculty_shibboleth_id' => $facultyUser['user_id'],
                'proxy_email' => $data['proxy_email']
            ])
            ->andWhere(['!=', 'status', FacultyProxyPermission::STATUS_REVOKED])
            ->one();

        if ($existing) {
            throw new BadRequestHttpException('An active invitation already exists for this email');
        }

        // Create invitation
        $permission = new FacultyProxyPermission();
        $permission->faculty_shibboleth_id = $facultyUser['user_id'];
        $permission->faculty_display_name = $facultyUser['display_name'];
        $permission->proxy_email = $data['proxy_email'];
        $permission->permission_type = $data['permission_type'] ?? FacultyProxyPermission::PERMISSION_FULL_ACCESS;
        $permission->notes = $data['notes'] ?? null;
        
        // Set expiration if provided
        if (!empty($data['expires_at'])) {
            $permission->expires_at = $data['expires_at'];
        }

        // For specific courses permission, we need the proxy_shibboleth_id
        // This is a limitation - we can't add course permissions without knowing the proxy's ID
        if ($permission->permission_type === FacultyProxyPermission::PERMISSION_SPECIFIC_COURSES) {
            if (empty($data['proxy_shibboleth_id'])) {
                throw new BadRequestHttpException('proxy_shibboleth_id required for specific course permissions');
            }
            $permission->proxy_shibboleth_id = $data['proxy_shibboleth_id'];
        } else {
            // Use email as temporary ID until they accept
            $permission->proxy_shibboleth_id = 'pending_' . md5($data['proxy_email']);
        }

        if ($permission->save()) {
            // Add specific course permissions if provided
            if ($permission->permission_type === FacultyProxyPermission::PERMISSION_SPECIFIC_COURSES 
                && !empty($data['course_permissions'])) {
                
                foreach ($data['course_permissions'] as $courseData) {
                    $coursePermission = new FacultyProxyCoursePermission();
                    $coursePermission->permission_id = $permission->permission_id;
                    $coursePermission->folio_course_listing_id = $courseData['folio_course_listing_id'];
                    $coursePermission->course_title = $courseData['course_title'] ?? null;
                    $coursePermission->term_id = $courseData['term_id'] ?? null;
                    $coursePermission->save();
                }
            }

            // Send invitation email
            $permission->sendInvitationEmail();

            return [
                'success' => true,
                'permission' => $permission,
                'message' => 'Invitation sent successfully'
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $permission->errors];
        }
    }

    /**
     * Revoke proxy permission
     */
    public function actionRevokeProxy($id)
    {
        $facultyUser = Yii::$app->params['facultyUser'];
        
        $permission = FacultyProxyPermission::find()
            ->where([
                'permission_id' => $id,
                'faculty_shibboleth_id' => $facultyUser['user_id']
            ])
            ->one();

        if (!$permission) {
            throw new NotFoundHttpException('Permission not found');
        }

        if ($permission->revoke()) {
            $permission->logActivity('revoked_by_faculty');
            
            return [
                'success' => true,
                'message' => 'Proxy access revoked'
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $permission->errors];
        }
    }

    /**
     * Accept proxy invitation (no auth required - uses token)
     */
    public function actionAcceptInvitation()
    {
        $data = Yii::$app->request->getBodyParams();
        
        if (empty($data['invitation_token'])) {
            throw new BadRequestHttpException('invitation_token is required');
        }

        $permission = FacultyProxyPermission::find()
            ->where([
                'invitation_token' => $data['invitation_token'],
                'status' => FacultyProxyPermission::STATUS_PENDING
            ])
            ->one();

        if (!$permission) {
            throw new NotFoundHttpException('Invalid or expired invitation token');
        }

        // Validate proxy user via Shibboleth data (passed in request)
        if (empty($data['proxy_shibboleth_id'])) {
            throw new BadRequestHttpException('Proxy must be authenticated via Shibboleth');
        }

        // Update permission with actual proxy ID
        $permission->proxy_shibboleth_id = $data['proxy_shibboleth_id'];
        
        $proxyUserData = [
            'display_name' => $data['proxy_display_name'] ?? null,
            'email' => $data['proxy_email'] ?? null
        ];

        if ($permission->acceptInvitation($proxyUserData)) {
            $permission->logActivity('invitation_accepted');
            
            return [
                'success' => true,
                'permission' => $permission,
                'message' => 'Invitation accepted successfully'
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $permission->errors];
        }
    }

    /**
     * Validate invitation token (no auth required)
     */
    public function actionValidateToken($token)
    {
        $permission = FacultyProxyPermission::find()
            ->where([
                'invitation_token' => $token,
                'status' => FacultyProxyPermission::STATUS_PENDING
            ])
            ->one();

        if (!$permission) {
            return [
                'valid' => false,
                'message' => 'Invalid or expired invitation token'
            ];
        }

        return [
            'valid' => true,
            'invitation' => [
                'faculty_name' => $permission->faculty_display_name,
                'permission_type' => $permission->permission_type,
                'notes' => $permission->notes,
                'invited_at' => $permission->invited_at
            ]
        ];
    }

    /**
     * Check if current user can act as proxy for a faculty member
     */
    public function actionCanActAsProxy($facultyId, $courseId = null)
    {
        $facultyUser = Yii::$app->params['facultyUser'];
        
        $query = FacultyProxyPermission::find()
            ->where([
                'faculty_shibboleth_id' => $facultyId,
                'proxy_shibboleth_id' => $facultyUser['user_id'],
                'status' => FacultyProxyPermission::STATUS_ACTIVE
            ]);

        $permission = $query->one();
        
        if (!$permission || !$permission->isActive()) {
            return [
                'can_act_as_proxy' => false,
                'reason' => 'No active permission found'
            ];
        }

        $canAccess = true;
        $canEdit = $permission->canEdit();

        if ($courseId && !$permission->canAccessCourse($courseId)) {
            $canAccess = false;
        }

        return [
            'can_act_as_proxy' => $canAccess,
            'can_edit' => $canEdit,
            'permission_type' => $permission->permission_type,
            'faculty_name' => $permission->faculty_display_name
        ];
    }

    /**
     * Get proxy activity log
     */
    public function actionActivityLog($facultyId = null)
    {
        $facultyUser = Yii::$app->params['facultyUser'];
        
        // If facultyId provided, check if current user can access it (they are proxy or owner)
        $query = \app\models\FacultyProxyActivityLog::find();
        
        if ($facultyId) {
            // Check permission to view this faculty's log
            $hasPermission = ($facultyUser['user_id'] === $facultyId) || 
                FacultyProxyPermission::find()
                    ->where([
                        'faculty_shibboleth_id' => $facultyId,
                        'proxy_shibboleth_id' => $facultyUser['user_id'],
                        'status' => FacultyProxyPermission::STATUS_ACTIVE
                    ])
                    ->exists();
            
            if (!$hasPermission) {
                throw new ForbiddenHttpException('Access denied to this activity log');
            }
            
            $query->where(['faculty_shibboleth_id' => $facultyId]);
        } else {
            // Show activities where current user is either faculty or proxy
            $query->where([
                'or',
                ['faculty_shibboleth_id' => $facultyUser['user_id']],
                ['proxy_shibboleth_id' => $facultyUser['user_id']]
            ]);
        }

        $dataProvider = new ActiveDataProvider([
            'query' => $query->orderBy(['created_at' => SORT_DESC]),
            'pagination' => [
                'pageSize' => 50,
            ],
        ]);

        return $dataProvider;
    }
}