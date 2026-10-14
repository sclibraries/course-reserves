<?php

namespace tests\unit\models;

use app\models\FacultySubmission;

class FacultySubmissionConfirmationStateTest extends \Codeception\Test\Unit
{
    /**
     * @dataProvider allowedStateProvider
     */
    public function testKnownConfirmationStatesPassValidation($state)
    {
        $submission = $this->makeSubmission();
        $submission->email_confirmation_status = $state;

        $this->assertTrue(
            $submission->validate(['email_confirmation_status']),
            json_encode($submission->getErrors('email_confirmation_status'))
        );
    }

    public function testUnknownConfirmationStateFailsValidation()
    {
        $submission = $this->makeSubmission();
        $submission->email_confirmation_status = 'delivered_by_owl';

        $this->assertFalse($submission->validate(['email_confirmation_status']));
        $this->assertNotEmpty($submission->getErrors('email_confirmation_status'));
    }

    /**
     * @dataProvider compatibilityBooleanProvider
     */
    public function testValidationSetsCompatibilityBooleanOnlyForVerifiedSent($state, $initial, $expected)
    {
        $submission = $this->makeSubmission();
        $submission->email_confirmation_status = $state;
        $submission->email_confirmation_sent = $initial;

        $this->assertTrue($submission->validate(['email_confirmation_status']));
        $this->assertSame($expected, (int) $submission->email_confirmation_sent);
    }

    public function testRequestingConfirmationClearsStaleDeliveryDetails()
    {
        $submission = $this->makeSubmissionWithStaleDeliveryDetails();

        $submission->requestEmailConfirmation(true);

        $this->assertSame('requested', $submission->email_confirmation_status);
        $this->assertSame(0, (int) $submission->email_confirmation_sent);
        $this->assertSame(1, preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $submission->email_confirmation_requested_at));
        $this->assertNull($submission->email_confirmation_queued_at);
        $this->assertNull($submission->email_confirmation_sent_at);
        $this->assertNull($submission->email_confirmation_failed_at);
        $this->assertNull($submission->email_confirmation_error_at);
        $this->assertNull($submission->email_confirmation_error);
    }

    public function testNotRequestingConfirmationClearsAllConfirmationDetails()
    {
        $submission = $this->makeSubmissionWithStaleDeliveryDetails();

        $submission->requestEmailConfirmation(false);

        $this->assertSame('not_requested', $submission->email_confirmation_status);
        $this->assertSame(0, (int) $submission->email_confirmation_sent);
        $this->assertNull($submission->email_confirmation_requested_at);
        $this->assertNull($submission->email_confirmation_queued_at);
        $this->assertNull($submission->email_confirmation_sent_at);
        $this->assertNull($submission->email_confirmation_failed_at);
        $this->assertNull($submission->email_confirmation_error_at);
        $this->assertNull($submission->email_confirmation_error);
    }

    public function allowedStateProvider()
    {
        return [
            ['not_requested'],
            ['requested'],
            ['queued'],
            ['sent'],
            ['failed'],
            ['error'],
            ['legacy_unknown'],
        ];
    }

    public function compatibilityBooleanProvider()
    {
        return [
            ['not_requested', 1, 0],
            ['requested', 1, 0],
            ['queued', 1, 0],
            ['sent', 0, 1],
            ['failed', 1, 0],
            ['error', 1, 0],
            ['legacy_unknown', 1, 0],
        ];
    }

    private function makeSubmission()
    {
        return new class extends FacultySubmission {
            public function attributes()
            {
                return [
                    'email_confirmation_status',
                    'email_confirmation_sent',
                    'email_confirmation_requested_at',
                    'email_confirmation_queued_at',
                    'email_confirmation_sent_at',
                    'email_confirmation_failed_at',
                    'email_confirmation_error_at',
                    'email_confirmation_error',
                    'email_confirmation_legacy_sent',
                ];
            }
        };
    }

    private function makeSubmissionWithStaleDeliveryDetails()
    {
        $submission = $this->makeSubmission();
        $submission->email_confirmation_status = 'sent';
        $submission->email_confirmation_sent = 1;
        $submission->email_confirmation_requested_at = '2026-07-20 10:00:00';
        $submission->email_confirmation_queued_at = '2026-07-20 10:01:00';
        $submission->email_confirmation_sent_at = '2026-07-20 10:02:00';
        $submission->email_confirmation_failed_at = '2026-07-20 10:03:00';
        $submission->email_confirmation_error_at = '2026-07-20 10:04:00';
        $submission->email_confirmation_error = 'stale test error';

        return $submission;
    }
}
