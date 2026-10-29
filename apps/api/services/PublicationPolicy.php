<?php

namespace app\services;

/** Defines the staff-facing state and readiness rules without publishing a destination. */
class PublicationPolicy
{
    const READY_FINISH_STATES = ['prepared', 'on_reserve', 'available_online'];

    public static function isReadyRun(?array $run)
    {
        return $run !== null
            && !empty($run['closed_at'])
            && empty($run['current_step_key'])
            && in_array($run['finish_state'] ?? null, self::READY_FINISH_STATES, true);
    }

    public static function runMatchesDraft(?array $run, ?array $state)
    {
        return self::isReadyRun($run)
            && $state !== null
            && isset($run['draft_revision'])
            && (int)$run['draft_revision'] === (int)$state['draft_revision'];
    }

    public function context(array $item, ?array $run = null, ?array $mapping = null)
    {
        return [
            'material_type_id' => isset($item['material_type_id']) ? (int)$item['material_type_id'] : null,
            'access_path' => $item['access_path'] ?? null,
            'run_id' => $run ? (int)$run['id'] : null,
            'flow_id' => $run ? (int)$run['flow_id'] : null,
            'flow_version' => $run ? (int)$run['version'] : null,
            'mapped_flow_id' => !$run && $mapping ? (int)$mapping['id'] : null,
            'mapped_flow_version' => !$run && $mapping ? (int)$mapping['version'] : null,
            'finish_state' => $run['finish_state'] ?? null,
            'closed_at' => $run['closed_at'] ?? null,
        ];
    }

    public function present(
        array $item,
        array $state,
        array $actor,
        ?array $run,
        $lastClaimEvent = null,
        ?array $mapping = null
    )
    {
        $flowReady = self::runMatchesDraft($run, $state);
        $manualReady = $state['readiness_source'] === 'manual'
            && (int)$state['readiness_revision'] === (int)$state['draft_revision']
            && json_decode($state['readiness_context_json'] ?: 'null', true) === $this->context($item, $run, $mapping);
        $readiness = null;
        if ($flowReady) {
            $readiness = [
                'source' => 'flow',
                'reason' => ($run['finish_reason'] ?? null) ?: 'Flow finished in ' . $run['finish_state'] . '.',
                'revision' => (int)$state['draft_revision'],
                'context' => [
                    'run_id' => (int)$run['id'],
                    'flow_id' => (int)$run['flow_id'],
                    'flow_version' => (int)$run['version'],
                    'finish_state' => $run['finish_state'],
                ],
            ];
        } elseif ($manualReady) {
            $readiness = [
                'source' => 'manual',
                'reason' => $state['readiness_reason'],
                'revision' => (int)$state['readiness_revision'],
                'context' => json_decode($state['readiness_context_json'], true),
            ];
        }

        $hasPublished = $state['published_revision'] !== null;
        $draftRevision = (int)$state['draft_revision'];
        $publishedRevision = $hasPublished ? (int)$state['published_revision'] : null;
        $pendingChanges = $state['pending_changes'] ?: 'none';
        if ($hasPublished && $publishedRevision < $draftRevision && $pendingChanges === 'none') {
            $pendingChanges = 'pending';
        }
        $ready = $readiness !== null;
        $publicationState = $ready ? 'ready' : ($hasPublished
            ? ($publishedRevision < $draftRevision ? 'published_with_pending_edits' : 'published')
            : 'pending');

        $actorName = (string)($actor['username'] ?? $actor['id'] ?? '');
        $claimedBy = (string)($item['claimed_by'] ?? '');
        $isClaimHolder = $claimedBy !== '' && $claimedBy === $actorName;
        $blockers = [];
        if (!$isClaimHolder) {
            if ($claimedBy !== '') {
                $blockers[] = 'claimed_by_another_staff_member';
            } else {
                if ($lastClaimEvent === 'claim_expired') {
                    $blockers[] = 'claim_expired';
                }
                if (!empty($item['assigned_group_id']) || !empty($item['assigned_group']['id'])) {
                    $blockers[] = 'assigned_to_group';
                }
                if (!$blockers) {
                    $blockers[] = 'claim_required';
                }
            }
        }
        if (!$ready) {
            $blockers[] = 'not_ready';
        }
        $blockers[] = 'publication_not_available_yet';

        return [
            'state' => $publicationState,
            'has_published_version' => $hasPublished,
            'pending_changes' => $pendingChanges,
            'has_pending_edits' => $pendingChanges === 'unknown' ? null : $pendingChanges === 'pending',
            'pending_edits_publishable' => $ready && (!$hasPublished || $draftRevision > $publishedRevision),
            'readiness' => $readiness ?: [
                'source' => null, 'reason' => null, 'revision' => null, 'context' => null,
            ],
            'revision' => ['draft' => $draftRevision, 'published' => $publishedRevision],
            'published_destination' => $this->decode($state['published_destination_json']),
            'reconciliation' => [
                'status' => $state['reconciliation_status'],
                'reason' => $state['reconciliation_reason'],
            ],
            'actions' => [
                'can_mark_ready' => $isClaimHolder,
                'can_publish' => false,
                'blockers' => array_values(array_unique($blockers)),
            ],
        ];
    }

    private function decode($json)
    {
        $value = json_decode((string)$json, true);
        return is_array($value) ? $value : null;
    }
}
