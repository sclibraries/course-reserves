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

    public function testFlowReadinessMustMatchTheCurrentDraftRevision()
    {
        $run = [
            'id' => 12,
            'closed_at' => '2026-10-29 12:00:00',
            'finish_state' => 'prepared',
            'draft_revision' => 2,
        ];
        $this->assertTrue(PublicationPolicy::runMatchesDraft($run, ['draft_revision' => 2]));
        $this->assertFalse(PublicationPolicy::runMatchesDraft($run, ['draft_revision' => 1]));
    }
}
