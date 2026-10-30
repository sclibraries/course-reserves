<?php

namespace app\services;

use Yii;

/** Owns publication readiness, revisions, and the staff-only contract. */
class SubmissionPublicationStateService
{
    use ServiceResult;

    private $states;
    private $claims;
    private $items;
    private $flows;
    private $events;
    private $policy;

    public function __construct($states = null, $claims = null, $items = null, $flows = null, $events = null, $policy = null)
    {
        $this->states = $states ?: new SubmissionPublicationStateRepository();
        $this->claims = $claims ?: Yii::$container->get(ItemClaimService::class);
        $this->items = $items ?: new ItemClaimRepository();
        $this->flows = $flows ?: new FlowRepository();
        $this->events = $events ?: new WorkflowEventLog();
        $this->policy = $policy ?: new PublicationPolicy();
    }

    public function contract($kind, $itemId, array $actor)
    {
        return $this->claims->withLinkedItem($kind, $itemId, function ($item) use ($kind, $itemId, $actor) {
            $state = $this->states->lock($kind, $itemId, $item['submission_id']);
            $run = $this->flows->latestRun($kind, $itemId);
            $mapping = $run ? null : $this->flows->mappedFlow(EffectiveMaterialType::id($item));
            $lastEvents = $this->states->lastClaimEvents([['kind' => $kind, 'id' => $itemId]]);
            return $this->result(200, [
                'publication' => $this->policy->present(
                    $item,
                    $state,
                    $actor,
                    $run,
                    $lastEvents[$kind . ':' . (int)$itemId] ?? null,
                    $mapping
                ),
            ]);
        });
    }

    public function contractsForSubmission($submissionId, array $items, array $actor, array $runs, array $mappings)
    {
        $states = $this->states->forSubmission($submissionId);
        $references = [];
        foreach ($items as $item) {
            $references[] = ['kind' => $item['kind'], 'id' => $item['id']];
        }
        $lastEvents = $this->states->lastClaimEvents($references);
        $contracts = [];
        foreach ($items as $entry) {
            $key = $entry['kind'] . ':' . (int)$entry['id'];
            $item = $entry['item'];
            $state = $states[$key] ?? $this->emptyState($submissionId, $entry['kind'], $entry['id']);
            $run = $runs[$key] ?? null;
            $materialTypeId = (int)EffectiveMaterialType::id($item);
            $mapping = $run ? null : ($mappings[$materialTypeId] ?? null);
            $contracts[$key] = $this->policy->present(
                $item,
                $state,
                $actor,
                $run,
                $lastEvents[$key] ?? null,
                $mapping
            );
        }
        return $contracts;
    }

    /** Call after the item row is locked and while its write transaction is active. */
    public function lockForWrite($kind, $itemId, $submissionId)
    {
        $transaction = Yii::$app->db->getTransaction();
        if (!$transaction || !$transaction->isActive) {
            throw new \LogicException('Publication state changes require the item write transaction.');
        }
        return $this->states->lock($kind, $itemId, $submissionId);
    }

    public function markReady($kind, $itemId, array $actor, $reason)
    {
        $reason = is_scalar($reason) ? trim((string)$reason) : '';
        return $this->claims->withLinkedItem($kind, $itemId, function ($item, $transaction, $now) use (
            $kind, $itemId, $actor, $reason
        ) {
            if (!$this->claims->claimActorMatches($item, $actor)) {
                return $this->result(409, ['error_code' => 'not_claimed_by_you']);
            }
            if ($reason === '') {
                return $this->result(400, ['error_code' => 'reason_required']);
            }
            if (strlen($reason) > 65535) {
                return $this->result(400, ['error_code' => 'reason_too_long']);
            }
            $state = $this->states->lock($kind, $itemId, $item['submission_id']);
            $run = $this->flows->latestRun($kind, $itemId, true);
            $mapping = $run ? null : $this->flows->mappedFlow(EffectiveMaterialType::id($item));
            $context = $this->policy->context($item, $run, $mapping);
            $before = $this->readinessSnapshot($state);
            $this->claims->renewClaimLocked($kind, $itemId, $now);
            $this->states->save($kind, $itemId, [
                'state' => 'ready',
                'readiness_source' => 'manual',
                'readiness_reason' => $reason,
                'readiness_run_id' => $run ? (int)$run['id'] : null,
                'readiness_revision' => (int)$state['draft_revision'],
                'readiness_context_json' => json_encode($context, JSON_UNESCAPED_SLASHES),
                'pending_changes' => $state['published_revision'] === null
                    ? 'none'
                    : ((int)$state['draft_revision'] > (int)$state['published_revision'] ? 'pending' : $state['pending_changes']),
            ]);
            $this->events->record(
                $item['submission_id'], $itemId, $actor, 'item_marked_ready', $reason,
                $before, ['source' => 'manual', 'revision' => (int)$state['draft_revision'], 'context' => $context], $kind
            );
            $updated = $this->items->find($kind, $itemId);
            $saved = $this->states->find($kind, $itemId);
            $lastEvents = $this->states->lastClaimEvents([['kind' => $kind, 'id' => $itemId]]);
            return $this->result(200, [
                'publication' => $this->policy->present(
                    $updated,
                    $saved,
                    $actor,
                    $run,
                    $lastEvents[$kind . ':' . (int)$itemId] ?? null,
                    $mapping
                ),
            ]);
        });
    }

    public function invalidateDraft($kind, $itemId, $submissionId)
    {
        $state = $this->lockForWrite($kind, $itemId, $submissionId);
        $hasPublished = $state['published_revision'] !== null;
        $revision = (int)$state['draft_revision'] + 1;
        $this->states->save($kind, $itemId, array_merge($this->clearReadiness(), [
            'draft_revision' => $revision,
            'state' => $hasPublished ? 'published_with_pending_edits' : 'pending',
            'pending_changes' => $hasPublished ? 'pending' : 'none',
        ]));
    }

    public function invalidateContext($kind, $itemId, $submissionId)
    {
        $state = $this->lockForWrite($kind, $itemId, $submissionId);
        $this->states->save($kind, $itemId, array_merge($this->clearReadiness(), [
            'state' => $this->stateWithoutReadiness($state),
        ]));
    }

    public function syncFlowReadiness($kind, $itemId, array $item, ?array $run = null)
    {
        $state = $this->lockForWrite($kind, $itemId, $item['submission_id']);
        $ready = PublicationPolicy::runMatchesDraft($run, $state);
        $values = array_merge($this->clearReadiness(), [
            'state' => $this->stateWithoutReadiness($state),
        ]);
        if ($ready) {
            $values = array_merge($values, [
                'state' => 'ready',
                'readiness_source' => 'flow',
                'readiness_reason' => ($run['finish_reason'] ?? null) ?: null,
                'readiness_run_id' => (int)$run['id'],
                'readiness_revision' => (int)$state['draft_revision'],
                'readiness_context_json' => json_encode($this->policy->context($item, $run), JSON_UNESCAPED_SLASHES),
            ]);
        }
        $this->states->save($kind, $itemId, $values);
    }

    public function remove($kind, $itemId)
    {
        $this->states->delete($kind, $itemId);
    }

    private function stateWithoutReadiness(array $state)
    {
        if ($state['published_revision'] !== null
            && (int)$state['draft_revision'] > (int)$state['published_revision']) {
            return 'published_with_pending_edits';
        }
        return $state['published_revision'] !== null ? 'published' : 'pending';
    }

    private function clearReadiness()
    {
        return [
            'readiness_source' => null,
            'readiness_reason' => null,
            'readiness_run_id' => null,
            'readiness_revision' => null,
            'readiness_context_json' => null,
        ];
    }

    private function readinessSnapshot(array $state)
    {
        return [
            'state' => $state['state'],
            'source' => $state['readiness_source'],
            'reason' => $state['readiness_reason'],
            'revision' => $state['readiness_revision'] === null ? null : (int)$state['readiness_revision'],
            'context' => json_decode($state['readiness_context_json'] ?: 'null', true),
        ];
    }

    private function emptyState($submissionId, $kind, $itemId)
    {
        return [
            'submission_id' => (int)$submissionId,
            'item_kind' => $kind,
            'item_id' => (int)$itemId,
            'state' => 'pending',
            'draft_revision' => 1,
            'published_revision' => null,
            'pending_changes' => 'none',
            'readiness_source' => null,
            'readiness_reason' => null,
            'readiness_run_id' => null,
            'readiness_revision' => null,
            'readiness_context_json' => null,
            'published_destination_json' => null,
            'reconciliation_status' => 'not_reconciled',
            'reconciliation_reason' => null,
        ];
    }
}
