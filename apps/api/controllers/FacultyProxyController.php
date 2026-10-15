<?php

namespace app\controllers;

use app\components\Roles;
use app\services\FacultyProxyAccessService;
use app\services\ProxyInvitationService;
use Yii;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;

/**
 * Authenticated proxy grant endpoints for faculty, designees and library staff.
 */
class FacultyProxyController extends BaseRestController
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();
        $behaviors['authenticator']['except'][] = 'validate-token';
        return $behaviors;
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    public function actionMyProxies()
    {
        return $this->accessService()->myProxies($this->actor()['user_id']);
    }

    public function actionMyFacultyAccess()
    {
        return $this->accessService()->myFacultyAccess($this->actor()['user_id']);
    }

    public function actionInviteProxy()
    {
        $actor = $this->actor();
        return $this->invitationService()->invite($actor, Yii::$app->request->getBodyParams());
    }

    public function actionRevokeProxy($id)
    {
        return $this->accessService()->revoke($id, $this->actor());
    }

    public function actionAcceptInvitation()
    {
        $data = Yii::$app->request->getBodyParams();
        if (empty($data['invitation_token'])) {
            throw new BadRequestHttpException('invitation_token is required');
        }
        return $this->invitationService()->accept($data['invitation_token'], $this->actor());
    }

    public function actionValidateToken($token)
    {
        return $this->invitationService()->validateToken($token);
    }

    public function actionCanActAsProxy($facultyId, $courseId = null)
    {
        return $this->accessService()->canActAsProxy($this->actor(), $facultyId, $courseId);
    }

    public function actionActivityLog($facultyId = null)
    {
        return $this->accessService()->activityLog($this->actor(), $facultyId);
    }

    public function actionStaffGrants()
    {
        $this->requireStaff();
        return $this->accessService()->staffGrants(
            Yii::$app->request->get('status'),
            Yii::$app->request->get('faculty_id')
        );
    }

    public function actionStaffActivityLog()
    {
        $this->requireStaff();
        return $this->accessService()->staffActivityLog(Yii::$app->request->get('faculty_id'));
    }

    public function actionStaffRevokeGrant($id)
    {
        $actor = $this->actor();
        if (!Roles::isStaff($actor['role'] ?? null)) {
            throw new ForbiddenHttpException('Library staff access required');
        }
        return $this->accessService()->revoke($id, $actor);
    }

    private function actor()
    {
        $actor = Yii::$app->params['facultyUser'];
        $actor['internal_id'] = Yii::$app->user->identity->internalId ?? null;
        return $actor;
    }

    private function requireStaff()
    {
        if (!Roles::isStaff($this->actor()['role'] ?? null)) {
            throw new ForbiddenHttpException('Library staff access required');
        }
    }

    private function invitationService()
    {
        return Yii::$container->get(ProxyInvitationService::class);
    }

    private function accessService()
    {
        return Yii::$container->get(FacultyProxyAccessService::class);
    }
}
