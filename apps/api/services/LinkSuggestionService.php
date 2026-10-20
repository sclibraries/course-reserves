<?php

namespace app\services;

use Yii;
use app\models\FacultySubmission;
use yii\web\ConflictHttpException;
use yii\web\NotFoundHttpException;

/** Coordinates FOLIO checks, persisted suggestions, background refresh requests, and list output. */
class LinkSuggestionService
{
    private $candidateService;
    private $repository;
    private $eventLog;
    private $submittedScope;

    public function __construct(
        $folioService = null,
        ?SubmissionLinkMatchRule $matchRule = null,
        ?LinkSuggestionRepository $repository = null,
        ?WorkflowEventLog $eventLog = null
    ) {
        $folioService = $folioService ?: Yii::$container->get(FolioService::class);
        $matchRule = $matchRule ?: new SubmissionLinkMatchRule();
        $this->candidateService = new SubmissionLinkCandidateService($folioService, $matchRule, true);
        $this->repository = $repository ?: new LinkSuggestionRepository();
        $this->eventLog = $eventLog ?: new WorkflowEventLog();
        $this->submittedScope = new SubmittedSubmissionScope();
    }

    public function candidates($uuid, $manualQuery = null)
    {
        $submission = $this->findSubmission($uuid);
        if ($blocked = $this->submittedScope->guardStatus($submission->status)) {
            return $blocked;
        }
        if ($manualQuery !== null && trim((string)$manualQuery) !== '') {
            return $this->candidateService->candidates($submission, $manualQuery);
        }

        $summary = $this->repository->summary($this->repository->latestRows($submission->submission_id));
        if ($summary['checked_at'] === null) {
            return $this->candidateService->candidates($submission);
        }
        return ['items' => $summary['items'], 'checked_at' => $summary['checked_at']];
    }

    public function recheck($uuid, array $actor)
    {
        $submission = $this->findSubmission($uuid);
        if ($blocked = $this->submittedScope->guardStatus($submission->status)) {
            return $blocked;
        }
        if ($submission->link_state !== 'needs_linking') {
            throw new ConflictHttpException('Only unlinked submissions can be rechecked.');
        }
        $result = $this->checkSubmissionId($submission->submission_id, $actor);
        return $result['summary'];
    }

    public function needsLinking($page = 1, $term = null)
    {
        $settings = Yii::$app->params['linkSuggestions'] ?? [];
        $staleMinutes = max(1, (int)($settings['staleMinutes'] ?? 10));
        $refreshLimit = max(1, min(50, (int)($settings['refreshLimit'] ?? 10)));
        $pageSize = max(1, min(100, (int)($settings['pageSize'] ?? 20)));
        $this->repository->queueStale($staleMinutes, $refreshLimit);

        $page = max(1, (int)$page);
        $result = $this->repository->needsLinkingPage($page, $term, $pageSize);
        $items = [];
        foreach ($result['items'] as $submission) {
            $summary = $this->repository->summary($this->repository->latestRows($submission['submission_id']));
            $submittedAt = empty($submission['submitted_at']) ? null : strtotime($submission['submitted_at']);
            $items[] = [
                'submission_id' => (int)$submission['submission_id'],
                'submission_uuid' => $submission['submission_uuid'],
                'faculty_display_name' => $submission['faculty_display_name'],
                'course_code' => $submission['course_code'],
                'section' => $submission['section'],
                'term_code' => $submission['term_code'],
                'its_course_id' => $submission['its_course_id'],
                'submitted_at' => $submission['submitted_at'],
                'waiting_hours' => $submittedAt === null ? 0 : round(max(0, time() - $submittedAt) / 3600, 1),
                'suggestion' => $summary['match'],
                'checked_at' => $summary['checked_at'],
            ];
        }

        return ['items' => $items, 'count' => (int)$result['count']];
    }

    public function checkSubmissionId($submissionId, array $actor)
    {
        $submission = FacultySubmission::findOne($submissionId);
        if (!$submission || $submission->status === \app\models\FacultySubmission::STATUS_DRAFT ||
            $submission->link_state !== 'needs_linking') {
            $this->repository->clearQueue($submissionId);
            return ['state' => 'skipped', 'summary' => $this->summary($submissionId)];
        }

        try {
            // The term lookup and all FOLIO searches happen before the write transaction.
            $items = $this->candidateService->suggestions($submission);
        } catch (\Exception $exception) {
            Yii::warning('FOLIO suggestion check failed for submission ' . $submissionId . ': ' . $exception->getMessage());
            return $this->recordFailure($submissionId);
        }

        $transaction = Yii::$app->db->beginTransaction();
        try {
            $locked = Yii::$app->db->createCommand(
                'SELECT submission_id, link_state, course_code, section, roster_term_id, term_code, academic_period '
                . 'FROM faculty_submissions WHERE submission_id = :submission_id FOR UPDATE',
                [':submission_id' => $submissionId]
            )->queryOne();
            if (!$locked || $locked['link_state'] !== 'needs_linking' || !$this->sameMatchInput($submission, $locked)) {
                $this->repository->clearQueue($submissionId);
                $transaction->commit();
                return ['state' => 'skipped', 'summary' => $this->summary($submissionId)];
            }

            $beforeRows = $this->repository->latestRows($submissionId);
            $before = $this->repository->summary($beforeRows);
            $hadPreviousCheck = !empty($beforeRows);
            $checkedAt = date('Y-m-d H:i:s');
            $this->repository->replaceResults($submissionId, $items, $checkedAt);
            $after = $this->summary($submissionId);

            if ($this->signature($before) !== $this->signature($after)) {
                $this->eventLog->record(
                    $submissionId,
                    null,
                    $actor,
                    $hadPreviousCheck ? 'rechecked' : 'suggested',
                    null,
                    $this->eventSnapshot($before),
                    $this->eventSnapshot($after)
                );
            }
            $transaction->commit();
            return ['state' => $this->signature($before) === $this->signature($after) ? 'unchanged' : 'changed', 'summary' => $after];
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    public function runChecks($queuedOnly, $limit, array $actor)
    {
        $ids = $queuedOnly
            ? $this->repository->queuedSubmissionIds($limit)
            : $this->repository->submissionIdsForCheck($limit);
        $counts = ['checked' => 0, 'changed' => 0, 'unchanged' => 0, 'errors' => 0, 'skipped' => 0];
        foreach ($ids as $submissionId) {
            $result = $this->checkSubmissionId($submissionId, $actor);
            $counts['checked']++;
            if (isset($counts[$result['state']])) {
                $counts[$result['state']]++;
            }
        }
        return $counts;
    }

    private function recordFailure($submissionId)
    {
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $locked = Yii::$app->db->createCommand(
                'SELECT submission_id, link_state FROM faculty_submissions '
                . 'WHERE submission_id = :submission_id FOR UPDATE',
                [':submission_id' => $submissionId]
            )->queryOne();
            if ($locked && $locked['link_state'] === 'needs_linking') {
                $errorAt = date('Y-m-d H:i:s');
                $this->repository->recordError($submissionId, $errorAt);
            } else {
                $errorAt = null;
                $this->repository->clearQueue($submissionId);
            }
            $transaction->commit();
            $summary = $this->summary($submissionId);
            if ($errorAt !== null) {
                $summary['error_at'] = $errorAt;
            }
            return ['state' => 'errors', 'summary' => $summary];
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    private function findSubmission($uuid)
    {
        $submission = FacultySubmission::find()->where(['submission_uuid' => $uuid])->one();
        if (!$submission) {
            throw new NotFoundHttpException('Submission not found.');
        }
        return $submission;
    }

    private function summary($submissionId)
    {
        return $this->repository->summary($this->repository->latestRows($submissionId));
    }

    private function sameMatchInput($submission, array $locked)
    {
        foreach (['course_code', 'section', 'roster_term_id', 'term_code', 'academic_period'] as $field) {
            if ((string)($submission->$field ?? '') !== (string)($locked[$field] ?? '')) {
                return false;
            }
        }
        return true;
    }

    private function signature(array $summary)
    {
        $items = [];
        foreach ($summary['items'] as $item) {
            $items[] = [
                'folio_course_listing_id' => $item['folio_course_listing_id'],
                'match' => $item['match'],
                'fields' => $item['fields'],
            ];
        }
        return json_encode(['match' => $summary['match'], 'items' => $items]);
    }

    private function eventSnapshot(array $summary)
    {
        return [
            'match' => $summary['match'],
            'items' => array_map(function ($item) {
                return [
                    'folio_course_listing_id' => $item['folio_course_listing_id'],
                    'match' => $item['match'],
                    'fields' => $item['fields'],
                ];
            }, $summary['items']),
        ];
    }
}
