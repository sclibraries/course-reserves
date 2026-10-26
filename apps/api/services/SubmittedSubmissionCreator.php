<?php

namespace app\services;

use app\models\FacultySubmission;

/** Creates a submitted submission and its faculty payload in one transaction. */
class SubmittedSubmissionCreator
{
    private $contexts;
    private $payloads;

    public function __construct(
        ?FacultySubmissionContext $contexts = null,
        ?SubmissionPayloadService $payloads = null
    ) {
        $this->contexts = $contexts ?: new FacultySubmissionContext();
        $this->payloads = $payloads ?: new SubmissionPayloadService();
    }

    public function create(array $context, array $actor, array $data, array $attributes = [],
        callable $afterCreate = null, callable $onFailure = null, bool $reuseDraft = true)
    {
        $existing = $this->contexts->findForCourse($context);
        if ($existing && $existing->status === FacultySubmission::STATUS_DRAFT && !$reuseDraft) {
            return ['draft_exists' => true];
        }
        if ($existing && $existing->status !== FacultySubmission::STATUS_DRAFT) {
            return ['duplicate' => true];
        }

        $submission = Transactional::run(function () use (
            $existing, $context, $data, $actor, $attributes, $afterCreate
        ) {
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
            foreach ($attributes as $name => $value) {
                $submission->setAttribute($name, $value);
            }
            if (!$submission->save()) {
                throw new \RuntimeException('Failed to save submission: ' . json_encode($submission->errors));
            }
            $this->payloads->replace($submission->submission_id, $data, $actor);
            if ($afterCreate !== null) {
                call_user_func($afterCreate, $submission);
            }
            return $submission;
        }, null, $onFailure);

        return ['duplicate' => false, 'submission' => $submission];
    }
}
