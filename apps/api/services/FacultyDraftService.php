<?php

namespace app\services;

use Yii;
use app\components\Roles;
use app\models\FacultySubmission;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

/** Owns the faculty draft lifecycle and shared submit-complete promotion. */
class FacultyDraftService
{
    private $ownership;
    private $payloads;
    private $contexts;

    public function __construct(
        ?SubmissionOwnershipPolicy $ownership = null,
        ?SubmissionPayloadService $payloads = null,
        ?FacultySubmissionContext $contexts = null
    )
    {
        $this->ownership = $ownership ?: new SubmissionOwnershipPolicy();
        $this->payloads = $payloads ?: new SubmissionPayloadService();
        $this->contexts = $contexts ?: new FacultySubmissionContext($this->ownership);
    }

    public function create(array $actor, array $data)
    {
        $resolved = $this->resolveAndValidate($actor, $data, true);
        if (isset($resolved['status_code'])) {
            return $resolved;
        }
        $context = $resolved['context'];
        $existing = $this->contexts->findForCourse($context);
        if ($existing) {
            if ($existing->status !== FacultySubmission::STATUS_DRAFT) {
                throw new BadRequestHttpException('Submission already exists for this course and section');
            }
            return [
                'status_code' => 200,
                'body' => [
                    'submission_uuid' => $existing->submission_uuid,
                    'status' => FacultySubmission::STATUS_DRAFT,
                    'draft_version' => (int)$existing->draft_version,
                    'existing' => true,
                ],
            ];
        }

        $submission = Transactional::run(function () use ($context, $data, $actor) {
            $submission = $this->contexts->newSubmission($context, FacultySubmission::STATUS_DRAFT);
            $submission->draft_version = 1;
            if (!$submission->save()) {
                throw new \RuntimeException('Failed to save draft: ' . json_encode($submission->errors));
            }
            $this->payloads->replace($submission->submission_id, $data, $actor);
            return $submission;
        });
        return [
            'status_code' => 201,
            'body' => [
                'submission_uuid' => $submission->submission_uuid,
                'status' => FacultySubmission::STATUS_DRAFT,
                'draft_version' => 1,
            ],
        ];
    }

    public function submitComplete(array $actor, array $data)
    {
        $resolved = $this->resolveAndValidate($actor, $data);
        if (isset($resolved['status_code'])) {
            Yii::$app->response->statusCode = $resolved['status_code'];
            return $resolved['body'];
        }
        $context = $resolved['context'];
        $existing = $this->contexts->findForCourse($context);
        if ($existing && $existing->status !== FacultySubmission::STATUS_DRAFT) {
            throw new BadRequestHttpException('Submission already exists for this course and section');
        }

        try {
            $submission = Transactional::run(function () use ($existing, $context, $data, $actor) {
                if ($existing) {
                    $submission = $existing;
                    $this->contexts->apply($submission, $context);
                    $submission->status = FacultySubmission::STATUS_SUBMITTED;
                    $submission->submitted_at = date('Y-m-d H:i:s');
                } else {
                    $submission = $this->contexts->newSubmission($context, FacultySubmission::STATUS_SUBMITTED);
                }
                SubmissionConfirmationState::request(
                    $submission,
                    !empty(($data['metadata'] ?? [])['emailConfirmation'])
                );
                if (!$submission->save()) {
                    throw new \RuntimeException('Failed to save submission: ' . json_encode($submission->errors));
                }
                $this->payloads->replace($submission->submission_id, $data, $actor);
                return $submission;
            });
            return FacultySubmissionPresenter::submitCompleteResponse([
                'success' => true,
                'message' => 'Submission completed successfully',
                'submission' => SubmissionConfirmationState::projectResponse($submission),
                'stats' => $this->payloads->submissionStats($data),
            ]);
        } catch (\Exception $exception) {
            Yii::error('Submission creation failed: ' . $exception->getMessage(), __METHOD__);
            throw new BadRequestHttpException('Failed to create submission: ' . $exception->getMessage());
        }
    }

    public function updateDraft($submission, array $actor, array $data)
    {
        return Transactional::run(function ($transaction) use ($submission, $actor, $data) {
            $submission = FacultySubmission::findBySql(
                'SELECT * FROM faculty_submissions WHERE submission_id = :id FOR UPDATE',
                [':id' => $submission->submission_id]
            )->one();
            if (!$submission) {
                throw new NotFoundHttpException('Submission not found');
            }
            $this->assertDraftEditable($submission, $actor);
            if (!isset($data['draft_version']) || !is_numeric($data['draft_version'])) {
                $transaction->rollBack();
                Yii::$app->response->statusCode = 422;
                return ['error_code' => 'draft_version_required'];
            }
            if ((int)$data['draft_version'] !== (int)$submission->draft_version) {
                $transaction->rollBack();
                Yii::$app->response->statusCode = 409;
                return [
                    'error_code' => 'draft_conflict',
                    'draft_version' => (int)$submission->draft_version,
                ];
            }

            $this->ownership->assertUpdateDoesNotChangeOwnership($data);
            $payload = array_merge($this->payloads->rawPayload($submission->submission_id), $data);
            if (isset($data['courseInfo']) && is_array($data['courseInfo'])) {
                $payload['courseInfo'] = array_merge($payload['courseInfo'] ?? [], $data['courseInfo']);
            }
            if (array_key_exists('items', $data) && !array_key_exists('resources', $data)) {
                unset($payload['resources']);
                $payload['items'] = $data['items'];
            }
            $course = $payload['courseInfo'] ?? [
                'courseCode' => $submission->course_code,
                'courseTitle' => $submission->course_title,
                'term' => $submission->term_code,
                'section' => $submission->section,
            ];
            $this->payloads->validateDraft($course, $this->payloads->payloadResources($payload));
            $payload['courseInfo'] = $course;

            $this->applyDraftCourseFields($submission, $payload);
            $this->payloads->replace($submission->submission_id, $payload, $actor);
            $submission->draft_version = (int)$submission->draft_version + 1;
            if (!$submission->save()) {
                throw new \RuntimeException('Failed to save draft: ' . json_encode($submission->errors));
            }
            return ['draft_version' => (int)$submission->draft_version];
        });
    }

    public function submitDraft($submission, array $actor)
    {
        $this->assertDraftEditable($submission, $actor);
        $payload = $this->payloads->rawPayload($submission->submission_id);
        $access = $this->ownership->accessDetails($submission, $actor);
        if ($access['access'] === 'proxy') {
            $payload['acting_for_faculty_id'] = $submission->shibboleth_user_id;
        }
        $context = $this->contexts->resolve($actor, $payload);
        if (isset($context['error_code'])) {
            Yii::$app->response->statusCode = $context['status_code'];
            return ['error_code' => $context['error_code']];
        }
        if ($context['owner_id'] !== $submission->shibboleth_user_id) {
            if ($access['access'] !== 'co_instructor') {
                throw new ForbiddenHttpException('Draft ownership no longer matches the course roster');
            }
            $context['owner_id'] = $submission->shibboleth_user_id;
        }
        $this->payloads->validate(
            $payload['courseInfo'] ?? [],
            $this->payloads->validationResources($this->payloads->payloadResources($payload))
        );

        return Transactional::run(function () use ($submission, $context, $payload) {
            $this->contexts->apply($submission, $context);
            $submission->status = FacultySubmission::STATUS_SUBMITTED;
            $submission->submitted_at = date('Y-m-d H:i:s');
            SubmissionConfirmationState::request(
                $submission,
                !empty(($payload['metadata'] ?? [])['emailConfirmation'])
            );
            if (!$submission->save()) {
                throw new \RuntimeException('Failed to submit draft: ' . json_encode($submission->errors));
            }
            return ['status' => FacultySubmission::STATUS_SUBMITTED];
        });
    }

    public function deleteDraft($uuid, array $actor)
    {
        $submission = FacultySubmission::find()->where(['submission_uuid' => $uuid])->one();
        if (!$submission) {
            throw new NotFoundHttpException('Submission not found');
        }
        if ($submission->status !== FacultySubmission::STATUS_DRAFT) {
            Yii::$app->response->statusCode = 409;
            return ['error_code' => 'not_a_draft'];
        }
        if (Roles::isStaff($actor['role'] ?? null)) {
            throw new ForbiddenHttpException('Only the faculty owner or proxy may discard a draft');
        }
        $access = $this->ownership->accessDetails($submission, $actor);
        if ($access['access'] !== 'owner' &&
            ($access['access'] !== 'proxy' || empty($access['proxy_can_edit']))) {
            throw new ForbiddenHttpException('Only the faculty owner or an editing proxy may discard a draft');
        }
        Transactional::run(function () use ($submission) {
            $this->payloads->deletePayload($submission->submission_id, true);
            $submission->delete();
        });
        Yii::$app->response->statusCode = 204;
        return null;
    }

    private function resolveAndValidate(array $actor, array $data, $draft = false)
    {
        $context = $this->contexts->resolve($actor, $data);
        if (isset($context['error_code'])) {
            return [
                'status_code' => $context['status_code'],
                'body' => ['error_code' => $context['error_code']],
            ];
        }
        $resources = $this->payloads->payloadResources($data);
        if ($draft) {
            $this->payloads->validateDraft($data['courseInfo'], $resources);
        } else {
            $this->payloads->validate($data['courseInfo'], $this->payloads->validationResources($resources));
        }
        return ['context' => $context];
    }

    private function assertDraftEditable($submission, array $actor)
    {
        if ($submission->status !== FacultySubmission::STATUS_DRAFT) {
            throw new BadRequestHttpException('Submission is not a draft');
        }
        if (Roles::isStaff($actor['role'] ?? null) || !$this->ownership->canAccess($submission, $actor, true)) {
            throw new ForbiddenHttpException('Only the faculty owner or editing proxy may change this draft');
        }
        if ($submission->isLocked()) {
            Yii::$app->response->statusCode = 423;
            throw new BadRequestHttpException('Draft is locked');
        }
    }

    private function applyDraftCourseFields($submission, array $payload)
    {
        $course = $payload['courseInfo'] ?? [];
        if (isset($course['courseTitle'])) {
            $submission->course_title = $course['courseTitle'];
        } elseif (isset($payload['course_title'])) {
            $submission->course_title = $payload['course_title'];
        }
        if (isset($payload['submission_notes'])) {
            $submission->submission_notes = $payload['submission_notes'];
        }
        if (isset($payload['needed_by_date'])) {
            $submission->needed_by_date = $payload['needed_by_date'];
        }
    }
}
