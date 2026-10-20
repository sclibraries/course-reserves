<?php

namespace app\controllers;

use Yii;
use app\services\FacultyDraftService;

/** Creates and discards server-side faculty drafts. */
class FacultyDraftController extends BaseRestController
{
    public function actionCreate()
    {
        $result = (new FacultyDraftService())->create(
            $this->facultyUser(),
            Yii::$app->request->getBodyParams()
        );
        Yii::$app->response->statusCode = $result['status_code'];
        return $result['body'];
    }

    public function actionDelete($id)
    {
        return (new FacultyDraftService())->deleteDraft($id, $this->facultyUser());
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    private function facultyUser()
    {
        $user = Yii::$app->params['facultyUser'];
        $user['internal_id'] = Yii::$app->user->identity->internalId ?? null;
        return $user;
    }
}
