<?php

namespace app\services;

class SubmissionConfirmationState
{
    const NOT_REQUESTED = 'not_requested';
    const REQUESTED = 'requested';
    const QUEUED = 'queued';
    const SENT = 'sent';
    const FAILED = 'failed';
    const ERROR = 'error';
    const LEGACY_UNKNOWN = 'legacy_unknown';

    public static function allowedStatuses()
    {
        return [
            self::NOT_REQUESTED,
            self::REQUESTED,
            self::QUEUED,
            self::SENT,
            self::FAILED,
            self::ERROR,
            self::LEGACY_UNKNOWN,
        ];
    }

    /**
     * Apply the submit action's only state transition; delivery transitions belong to API-045.
     */
    public static function request($submission, $requested)
    {
        $submission->email_confirmation_status = $requested ? self::REQUESTED : self::NOT_REQUESTED;
        $submission->email_confirmation_requested_at = $requested ? date('Y-m-d H:i:s') : null;

        foreach (self::deliveryTimestamps() as $attribute) {
            $submission->$attribute = null;
        }

        $submission->email_confirmation_error = null;
        self::synchronizeCompatibilityBoolean($submission);
    }

    public static function synchronizeCompatibilityBoolean($submission)
    {
        $submission->email_confirmation_sent = $submission->email_confirmation_status === self::SENT ? 1 : 0;
    }

    public static function projectResponse($submission)
    {
        return array_merge($submission->toArray(), [
            'email_confirmation_status' => $submission->email_confirmation_status,
            'email_confirmation_requested_at' => $submission->email_confirmation_requested_at,
            'email_confirmation_queued_at' => $submission->email_confirmation_queued_at,
            'email_confirmation_sent_at' => $submission->email_confirmation_sent_at,
            'email_confirmation_failed_at' => $submission->email_confirmation_failed_at,
            'email_confirmation_error_at' => $submission->email_confirmation_error_at,
            'email_confirmation_error' => $submission->email_confirmation_error,
            'email_confirmation_sent' => (int) $submission->email_confirmation_sent,
        ]);
    }

    private static function deliveryTimestamps()
    {
        return [
            'email_confirmation_queued_at',
            'email_confirmation_sent_at',
            'email_confirmation_failed_at',
            'email_confirmation_error_at',
        ];
    }
}
