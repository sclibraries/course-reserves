<?php

use app\services\PublicationPolicy;

class PublicationPolicyTest extends \Codeception\Test\Unit
{
    public function testOnlySuccessfulFinishedRunsAreReady()
    {
        foreach (['prepared', 'on_reserve', 'available_online'] as $finishState) {
            $this->assertTrue(PublicationPolicy::isReadyRun([
                'closed_at' => '2026-10-29 12:00:00',
                'finish_state' => $finishState,
            ]));
        }

        foreach (['needs_access_path', 'unavailable', 'withdrawn', null] as $finishState) {
            $this->assertFalse(PublicationPolicy::isReadyRun([
                'closed_at' => '2026-10-29 12:00:00',
                'finish_state' => $finishState,
            ]));
        }
        $this->assertFalse(PublicationPolicy::isReadyRun([
            'closed_at' => null,
            'finish_state' => 'prepared',
        ]));
        $this->assertFalse(PublicationPolicy::isReadyRun([
            'closed_at' => '2026-10-29 12:00:00',
            'finish_state' => null,
        ]));
    }

    public function testFlowReadinessMustMatchBothCurrentRevisions()
    {
        $run = [
            'id' => 12,
            'closed_at' => '2026-10-29 12:00:00',
            'finish_state' => 'prepared',
            'draft_revision' => 2,
            'workflow_revision' => 3,
        ];
        $state = ['draft_revision' => 2, 'workflow_revision' => 3];
        $this->assertTrue(PublicationPolicy::runMatchesDraft($run, $state));
        $this->assertFalse(PublicationPolicy::runMatchesDraft($run, [
            'draft_revision' => 1, 'workflow_revision' => 3,
        ]));
        $this->assertFalse(PublicationPolicy::runMatchesDraft($run, [
            'draft_revision' => 2, 'workflow_revision' => 4,
        ]));
        $this->assertFalse(PublicationPolicy::runMatchesDraft($run, ['draft_revision' => 2]));
    }
}
