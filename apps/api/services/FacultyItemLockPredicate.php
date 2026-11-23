<?php

namespace app\services;

use app\models\FacultySubmission;

/**
 * Evaluates item locks from supplied attributes and evidence only.
 * E supplies advisory bulk plain-read evidence keyed by kind and id. H/I/J supply current reads made in their transaction
 * and rebuild the evidence on every retry.
 */
class FacultyItemLockPredicate
{
    private const LOCK_MESSAGES = [
        'published' => 'This item is on your course page.',
        'finished' => 'The library has finished this item.',
        'legacy' => "This item can't be changed here.",
        'in_progress' => 'The library is working on this item.',
        'review' => 'The library is checking this item.',
    ];

    private const MESSAGE_ENDING = ' To change it, send a message.';
    private const COURSE_LOCK_MESSAGE = 'This course is locked by the library.';

    private $now;

    public function __construct($now)
    {
        $this->now = $now;
    }

    public function evaluate(
        FacultySubmission $submission,
        $kind,
        array $item,
        array $evidence,
        $ambiguousFolder
    ) {
        $courseLocked = $submission->isLocked();
        $lock = null;

        if ($courseLocked) {
            $message = self::COURSE_LOCK_MESSAGE . self::MESSAGE_ENDING;
        } else {
            if ($submission->status !== FacultySubmission::STATUS_DRAFT) {
                $hasL4Evidence = $item['locked_for_faculty_at'] !== null || $evidence['publication_history'];
                $activeClaim = !empty($item['claimed_by']) && !ItemClaimExpiryService::isDue($item, $this->now);

                if ($hasL4Evidence && $evidence['published']) {
                    $lock = 'published';
                } elseif ($hasL4Evidence) {
                    $lock = 'finished';
                } elseif ($kind === 'reuse') {
                    $lock = 'legacy';
                } elseif ($activeClaim || (!empty($item['assigned_group_id']) && $evidence['open_run'])) {
                    $lock = 'in_progress';
                } elseif ($kind === 'new' && $evidence['open_review']) {
                    $lock = 'review';
                }
            }

            $message = $lock === null ? null : self::LOCK_MESSAGES[$lock] . self::MESSAGE_ENDING;
        }

        $canEdit = $submission->canEdit();
        $itemLocked = $lock !== null;

        return [
            'locked' => $courseLocked || $itemLocked,
            'lock' => $lock,
            'message' => $message,
            'capabilities' => [
                'edit' => $canEdit && !$itemLocked,
                'delete' => $canEdit && !$itemLocked,
                'move' => $canEdit && !$itemLocked && !$ambiguousFolder,
                'reorder' => $canEdit && !$ambiguousFolder,
            ],
        ];
    }
}
