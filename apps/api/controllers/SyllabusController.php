<?php

namespace app\controllers;

use Yii;
use app\components\Roles;
use app\models\FacultySubmission;
use app\services\SubmissionOwnershipPolicy;
use app\services\SyllabusException;
use app\services\SyllabusStore;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;
use yii\web\Response;

/** Submission-scoped faculty and staff syllabus endpoints. */
class SyllabusController extends BaseRestController
{
    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    public function actionFacultyList($uuid)
    {
        list($submission) = $this->facultyContext($uuid, false);
        return $this->store()->listForSubmission($submission->submission_id, false);
    }

    public function actionFacultyCreate($uuid)
    {
        list($submission, $actor) = $this->facultyContext($uuid, true);
        return $this->add($submission, $actor);
    }

    public function actionFacultyFile($uuid, $sid)
    {
        list($submission) = $this->facultyContext($uuid, false);
        return $this->download($submission->submission_id, $sid);
    }

    public function actionStaffList($id)
    {
        list($submission) = $this->staffContext($id);
        return $this->store()->listForSubmission($submission->submission_id, true);
    }

    public function actionStaffCreate($id)
    {
        list($submission, $actor) = $this->staffContext($id);
        return $this->add($submission, $actor);
    }

    public function actionStaffFile($id, $sid)
    {
        list($submission) = $this->staffContext($id);
        return $this->download($submission->submission_id, $sid);
    }

    public function actionGoogleDocText()
    {
        list(, $actor) = $this->staffContext(0, false);
        return $this->serviceResult(function () use ($actor) {
            return ['extracted_text' => $this->store()->googleDocText(
                Yii::$app->request->getBodyParams()['google_doc_url'] ?? null
            )];
        });
    }

    private function facultyContext($uuid, $requireEdit)
    {
        $actor = Yii::$app->params['facultyUser'] ?? null;
        $identity = Yii::$app->user->identity;
        if (!is_array($actor) || !$identity) {
            throw new ForbiddenHttpException('Faculty user not authenticated.');
        }
        $actor['internal_id'] = $identity->internalId ?? null;
        $submission = (new SubmissionOwnershipPolicy())->findSubmissionWithAccess($uuid, $actor, $requireEdit);
        $actor['username'] = $identity->username;
        $actor['role'] = $identity->role;
        return [$submission, $actor];
    }

    private function staffContext($id, $requireSubmission = true)
    {
        $identity = Yii::$app->user->identity;
        if (!$identity || !Roles::isStaff($identity->role ?? null)) {
            throw new ForbiddenHttpException('Staff workflow access requires a staff or admin role.');
        }
        $actor = ['username' => $identity->username, 'role' => $identity->role];
        if (!$requireSubmission) {
            return [null, $actor];
        }
        $submission = FacultySubmission::findOne((int)$id);
        if (!$submission) {
            throw new NotFoundHttpException('Submission not found.');
        }
        return [$submission, $actor];
    }

    private function add($submission, array $actor)
    {
        return $this->serviceResult(function () use ($submission, $actor) {
            $result = $this->store()->add(
                $submission->submission_id,
                Yii::$app->request->getBodyParams(),
                $actor
            );
            Yii::$app->response->statusCode = 201;
            return $result;
        });
    }

    private function download($submissionId, $syllabusId)
    {
        return $this->serviceResult(function () use ($submissionId, $syllabusId) {
            $file = $this->store()->fileForSubmission($submissionId, $syllabusId);
            $response = Yii::$app->response;
            $response->format = Response::FORMAT_RAW;
            $response->statusCode = 200;
            $response->headers->set('Content-Type', $file['mime_type']);
            $response->headers->set('Content-Disposition', 'attachment; filename="' . $file['filename'] . '"');
            $response->headers->set('X-Content-Type-Options', 'nosniff');
            $response->content = $file['contents'];
            return $response;
        });
    }

    private function serviceResult(callable $action)
    {
        try {
            return $action();
        } catch (SyllabusException $error) {
            Yii::$app->response->statusCode = $error->getStatusCode();
            return $error->toResponse();
        }
    }

    private function store()
    {
        return Yii::$container->get(SyllabusStore::class);
    }
}
