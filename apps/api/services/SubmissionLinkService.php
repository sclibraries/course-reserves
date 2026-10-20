<?php

namespace app\services;

use Yii;
use app\models\FacultySubmission;
use app\models\SubmissionCommunication;
use app\models\SubmissionNewResource;
use app\models\SubmissionReuseResource;
use yii\db\IntegrityException;
use yii\web\BadRequestHttpException;
use yii\web\ConflictHttpException;
use yii\web\ServerErrorHttpException;

/** Coordinates course matching, link changes, faculty correction messages, and event logging. */
class SubmissionLinkService
{
    private $folioService;
    private $courseOfferingService;
    private $matchRule;
    private $candidateService;
    private $eventLog;
    private $communicationService;

    public function __construct(
        $folioService = null,
        ?CourseOfferingLinkService $courseOfferingService = null,
        ?SubmissionLinkMatchRule $matchRule = null,
        ?SubmissionLinkCandidateService $candidateService = null,
        ?WorkflowEventLog $eventLog = null,
        ?SubmissionCommunicationService $communicationService = null
    ) {
        $this->folioService = $folioService ?: Yii::$container->get(FolioService::class);
        $this->courseOfferingService = $courseOfferingService ?: new CourseOfferingLinkService($this->folioService);
        $this->matchRule = $matchRule ?: new SubmissionLinkMatchRule();
        $this->candidateService = $candidateService ?: new SubmissionLinkCandidateService($this->folioService, $this->matchRule);
        $this->eventLog = $eventLog ?: new WorkflowEventLog();
        $this->communicationService = $communicationService ?: new SubmissionCommunicationService();
    }

    public function candidates($uuid, $manualQuery = null)
    {
        $submission = $this->findSubmission($uuid);
        if ($blocked = $this->draftConflict($submission)) return $blocked;
        return $this->candidateService->candidates($submission, $manualQuery);
    }

    public function timeline($uuid)
    {
        $submission = $this->findSubmission($uuid);
        if ($blocked = $this->draftConflict($submission)) return $blocked;
        return ['items' => $this->eventLog->timeline($submission->submission_id)];
    }

    public function link($uuid, $listingId, array $actor)
    {
        return $this->linkListing($uuid, $listingId, $actor, null, false);
    }

    public function override($uuid, $listingId, $reason, array $actor)
    {
        $reason = $this->requiredReason($reason);
        return $this->linkListing($uuid, $listingId, $actor, $reason, true);
    }

    public function correct($uuid, array $data, array $actor)
    {
        $reason = $this->requiredReason($data['reason'] ?? null);
        if (array_key_exists('term_code', $data) || array_key_exists('roster_term_id', $data) || array_key_exists('academic_period', $data)) {
            return ['status' => 422, 'body' => ['error_code' => 'term_change_not_allowed']];
        }
        if (!array_key_exists('course_code', $data) && !array_key_exists('section', $data)) {
            throw new BadRequestHttpException('course_code or section is required.');
        }

        $transaction = Yii::$app->db->beginTransaction();
        try {
            $submission = $this->findSubmissionForUpdate($uuid);
            if ($blocked = $this->draftConflict($submission, true)) {
                $transaction->rollBack();
                return $blocked;
            }
            if ($submission->link_state === 'linked') {
                $transaction->rollBack();
                return ['status' => 409, 'body' => ['error_code' => 'already_linked']];
            }
            $before = SubmissionLinkSnapshot::fromSubmission($submission);
            foreach (['course_code', 'section'] as $field) {
                if (array_key_exists($field, $data)) {
                    $submission->$field = trim((string)$data[$field]);
                }
            }
            if (!$submission->save()) {
                throw new ServerErrorHttpException('Failed to correct submission: ' . json_encode($submission->getErrors()));
            }

            $message = (new SubmissionCorrectionMessageBuilder())->build(
                $before,
                SubmissionLinkSnapshot::fromSubmission($submission)
            );
            $created = $this->communicationService->create($submission, [
                'message' => $message,
                'subject' => 'Course information updated',
                'visibility' => SubmissionCommunication::VISIBILITY_FACULTY,
            ], [
                'id' => $actor['username'],
                'name' => 'Library staff',
                'email' => null,
            ], false);
            if (empty($created['saved'])) {
                throw new ServerErrorHttpException('Failed to create faculty correction message.');
            }

            $this->eventLog->record(
                $submission->submission_id,
                null,
                $actor,
                'corrected',
                $reason,
                $before,
                SubmissionLinkSnapshot::fromSubmission($submission)
            );
            // TODO(API-045): emit the submission_corrected email event here.
            $transaction->commit();
            return ['status' => 200, 'body' => (new SubmissionLinkPresenter())->present($submission)];
        } catch (\Throwable $exception) {
            if ($transaction->isActive) $transaction->rollBack();
            throw $exception;
        }
    }

    public function unlink($uuid, $reason, array $actor)
    {
        $reason = $this->requiredReason($reason);
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $submission = $this->findSubmissionForUpdate($uuid);
            if ($blocked = $this->draftConflict($submission, true)) {
                $transaction->rollBack();
                return $blocked;
            }
            if ($submission->link_state !== 'linked') {
                $transaction->rollBack();
                return ['status' => 409, 'body' => ['error_code' => 'submission_not_linked']];
            }
            if ($this->hasMaterializedItems($submission->submission_id)) {
                $transaction->rollBack();
                return ['status' => 409, 'body' => ['error_code' => 'items_published']];
            }

            $before = SubmissionLinkSnapshot::fromSubmission($submission);
            $submission->link_state = 'needs_linking';
            $submission->link_flag = null;
            $submission->offering_id = null;
            $submission->folio_course_listing_id = null;
            $submission->linked_at = null;
            $submission->linked_by = null;
            if (!$submission->save()) {
                throw new ServerErrorHttpException('Failed to unlink submission: ' . json_encode($submission->getErrors()));
            }
            $this->eventLog->record(
                $submission->submission_id,
                null,
                $actor,
                'unlinked',
                $reason,
                $before,
                SubmissionLinkSnapshot::fromSubmission($submission)
            );
            $transaction->commit();
            return ['status' => 200, 'body' => (new SubmissionLinkPresenter())->present($submission)];
        } catch (\Throwable $exception) {
            if ($transaction->isActive) $transaction->rollBack();
            throw $exception;
        }
    }

    private function linkListing($uuid, $listingId, array $actor, $reason, $override)
    {
        if (!$listingId) throw new BadRequestHttpException('folio_course_listing_id is required.');
        $submission = $this->findSubmission($uuid);
        if ($blocked = $this->draftConflict($submission, true)) return $blocked;
        if ($submission->link_state === 'linked') {
            return ['status' => 409, 'body' => [
                'error_code' => 'already_linked',
                'linked_by' => $submission->linked_by,
            ]];
        }

        try {
            $listing = $this->courseOfferingService->fetchListing($listingId, $submission->course_code);
        } catch (FolioListingLookupException $exception) {
            return $exception->getResult();
        }
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $submission = $this->findSubmissionForUpdate($uuid);
            if ($submission->link_state === 'linked') {
                $transaction->rollBack();
                return ['status' => 409, 'body' => [
                    'error_code' => 'already_linked',
                    'linked_by' => $submission->linked_by,
                ]];
            }
            $before = SubmissionLinkSnapshot::fromSubmission($submission);
            $matchAttributes = (new SubmissionRosterTermResolver($this->folioService))
                ->attributesForMatch($submission->attributes);
            if (empty($submission->roster_term_id) && !empty($matchAttributes['roster_term_id'])) {
                $submission->roster_term_id = $matchAttributes['roster_term_id'];
                $submission->term_code = $matchAttributes['term_code'];
            }
            $match = $this->matchRule->evaluate($matchAttributes, $listing);
            if (!$override && $match['match'] !== 'exact') {
                $transaction->rollBack();
                return ['status' => 409, 'body' => [
                    'error_code' => 'not_exact_match',
                    'fields' => $match['fields'],
                    'term_verified' => $match['term_verified'],
                ]];
            }
            $result = $this->courseOfferingService->findOrCreateFromListing($listing);
            $submission->link_state = 'linked';
            $submission->link_flag = $override ? 'mismatch_override' : null;
            $submission->offering_id = $result['offering']->offering_id;
            $submission->folio_course_listing_id = $result['offering']->folio_course_id;
            $submission->linked_at = date('Y-m-d H:i:s');
            $submission->linked_by = $actor['username'];
            if (!$submission->save()) {
                throw new ServerErrorHttpException('Failed to link submission: ' . json_encode($submission->getErrors()));
            }
            (new SubmissionCourseScaffoldService())->ensureSubmissionCourseScaffold($submission);
            $this->eventLog->record(
                $submission->submission_id,
                null,
                $actor,
                $override ? 'link_override' : 'linked',
                $reason,
                $before,
                SubmissionLinkSnapshot::fromSubmission($submission)
            );
            $transaction->commit();
            $response = (new SubmissionLinkPresenter())->present($submission);
            $response['course'] = $result['course']->toArray();
            $response['offering'] = $result['offering']->toArray();
            return ['status' => 200, 'body' => $response];
        } catch (IntegrityException $exception) {
            if ($transaction->isActive) $transaction->rollBack();
            return ['status' => 409, 'body' => ['error_code' => 'unique_key_conflict']];
        } catch (ConflictHttpException $exception) {
            if ($transaction->isActive) $transaction->rollBack();
            return ['status' => 409, 'body' => ['error_code' => 'course_offering_conflict']];
        } catch (\Throwable $exception) {
            if ($transaction->isActive) $transaction->rollBack();
            throw $exception;
        }
    }

    private function hasMaterializedItems($submissionId)
    {
        $newItems = SubmissionNewResource::find()->where(['submission_id' => $submissionId])
            ->andWhere('(materialized_resource_id IS NOT NULL OR materialized_course_resource_id IS NOT NULL '
                . 'OR materialized_physical_reference_id IS NOT NULL OR materialized_at IS NOT NULL)')->exists();
        $reuseItems = SubmissionReuseResource::find()->where(['submission_id' => $submissionId])
            ->andWhere('(materialized_resource_id IS NOT NULL OR materialized_course_resource_id IS NOT NULL '
                . 'OR materialized_physical_reference_id IS NOT NULL OR materialized_at IS NOT NULL)')->exists();
        return $newItems || $reuseItems;
    }

    private function findSubmission($uuid)
    {
        $submission = FacultySubmission::find()->where(['submission_uuid' => $uuid])->one();
        if (!$submission) throw new \yii\web\NotFoundHttpException('Submission not found.');
        return $submission;
    }

    private function findSubmissionForUpdate($uuid)
    {
        return (new SubmissionLinkRepository())->findForUpdate($uuid);
    }

    private function requiredReason($reason)
    {
        $reason = trim((string)$reason);
        if ($reason === '') throw new BadRequestHttpException('reason is required.');
        return $reason;
    }

    private function draftConflict($submission, $asResult = false)
    {
        $body = (new SubmittedSubmissionScope())->guardStatus($submission->status);
        return $body === null ? null : ($asResult ? ['status' => 409, 'body' => $body] : $body);
    }


}
