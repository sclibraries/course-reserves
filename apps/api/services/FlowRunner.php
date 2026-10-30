<?php

namespace app\services;

use Yii;

/** Runs item flow versions while delegating claim rules to ItemClaimService. */
class FlowRunner
{
    use ServiceResult;

    private $flows;
    private $items;
    private $claims;
    private $groups;
    private $events;
    private $presenter;
    private $publication;
    private $configuration;

    public function __construct(
        $flows = null,
        $items = null,
        $claims = null,
        $groups = null,
        $events = null,
        $accessPathMappings = null,
        $publication = null
    )
    {
        $this->flows = $flows ?: new FlowRepository();
        $this->items = $items ?: new ItemClaimRepository();
        $this->claims = $claims ?: Yii::$container->get(ItemClaimService::class);
        $this->groups = $groups ?: new StaffGroupRepository();
        $this->events = $events ?: new WorkflowEventLog();
        $this->presenter = new FlowStatePresenter($this->flows);
        $this->publication = $publication ?: new SubmissionPublicationStateService(
            null, $this->claims, $this->items, $this->flows, $this->events
        );
        $this->configuration = new FlowConfigurationService(
            $this->flows,
            $this->items,
            $this->claims,
            $this->events,
            $accessPathMappings ?: new AccessPathMappingRepository(),
            $this->publication
        );
    }

    public function getItemFlow($kind, $itemId, array $actor)
    {
        return $this->claims->withLinkedItem($kind, $itemId, function ($item, $transaction, $now) use ($kind, $itemId, $actor) {
            $latest = $this->flows->latestRun($kind, $itemId, true);
            $state = $this->publication->lockForWrite($kind, $itemId, $item['submission_id']);
            if ($latest && (int)$latest['draft_revision'] < (int)$state['draft_revision']) {
                if (empty($latest['closed_at'])) {
                    $this->flows->updateRun($latest['id'], [
                        'current_step_key' => null,
                        'finish_state' => 'superseded',
                        'closed_at' => $now,
                        'closed_reason' => 'draft_inputs_changed',
                    ]);
                }
                $latest = null;
            }
            if (!$latest) {
                $mapping = $this->flows->mappedFlow(EffectiveMaterialType::id($item));
                if ($mapping) {
                    $latest = $this->startRun($kind, $itemId, $item, $mapping, $actor);
                }
            }
            $state = $this->presenter->present(
                $kind, $itemId, $item, $latest, $this->claims->claimActorMatches($item, $actor)
            );
            return $this->result(200, $state);
        });
    }

    public function stepResult($kind, $itemId, array $actor, array $body)
    {
        $stepKey = $this->trimmedString($body['step_key'] ?? null);
        $outcomeKey = $this->trimmedString($body['outcome_key'] ?? null);
        if ($stepKey === '' || $outcomeKey === '') {
            return $this->result(400, ['error_code' => 'unknown_outcome']);
        }
        return $this->claims->withLinkedItem($kind, $itemId, function ($item, $transaction, $now) use (
            $kind, $itemId, $actor, $body, $stepKey, $outcomeKey
        ) {
            if (!$this->claims->claimActorMatches($item, $actor)) {
                return $this->result(409, ['error_code' => 'not_claimed_by_you']);
            }
            $run = $this->flows->openRun($kind, $itemId, true);
            if (!$run) {
                $transaction->rollBack();
                return $this->result(409, ['error_code' => 'stale_step']);
            }
            if ($run['current_step_key'] !== $stepKey) {
                return $this->result(409, ['error_code' => 'stale_step']);
            }
            $steps = json_decode($run['steps_json'], true) ?: [];
            $step = FlowStepLookup::stepByKey($steps, $stepKey);
            $outcome = FlowStepLookup::outcomeByKey($step, $outcomeKey);
            if (!$outcome) {
                return $this->result(400, ['error_code' => 'unknown_outcome']);
            }
            $next = $outcome['next'] ?? [];
            $finish = isset($next['finish'])
                ? FlowStepLookup::stepByKey($steps, $next['finish'])
                : (isset($next['step']) ? FlowStepLookup::stepByKey($steps, $next['step']) : []);
            if (($finish['kind'] ?? null) !== 'finish') {
                $finish = [];
            }
            $reason = $this->trimmedString($body['reason'] ?? null);
            $notes = $this->trimmedString($body['notes'] ?? null);
            if (!empty($outcome['reason_required']) || !empty($finish['reason_required'])) {
                if ($reason === '') {
                    return $this->result(400, ['error_code' => 'reason_required']);
                }
            }

            $group = null;
            if (isset($next['handoff_group'])) {
                $group = $this->groups->findByName($next['handoff_group']);
                if (!$group) {
                    return $this->result(409, ['error_code' => 'unknown_group']);
                }
            }

            $before = $this->presenter->runSnapshot($run);
            $this->claims->renewClaimLocked($kind, $itemId, $now);
            $nullableReason = $reason === '' ? null : $reason;
            $nullableNotes = $notes === '' ? null : $notes;
            $eventReason = $reason ?: null;
            $this->flows->insertResult(
                $run['id'], $stepKey, $outcomeKey, $nullableNotes, $nullableReason, $actor['username']
            );
            $finished = null;
            if ($finish) {
                $this->flows->updateRun($run['id'], [
                    'current_step_key' => null,
                    'finish_state' => $finish['finish_state'],
                    'finish_reason' => $nullableReason,
                    'closed_at' => $now,
                    'closed_reason' => $nullableReason,
                ]);
                $finished = ['finish_state' => $finish['finish_state'], 'reason' => $nullableReason];
            } elseif (isset($next['step'])) {
                $this->flows->updateRun($run['id'], ['current_step_key' => $next['step']]);
            }
            $after = ['run_id' => (int)$run['id'], 'current_step_key' => $finished ? null : ($next['step'] ?? $stepKey), 'finished' => $finished];
            $this->events->record($item['submission_id'], $itemId, $actor, 'step_result', $eventReason, $before, $after, $kind);
            if ($finished) {
                $this->events->record($item['submission_id'], $itemId, $actor, 'finished', $eventReason, $before, $finished, $kind);
            }
            if ($group) {
                $handoff = $this->claims->handoffToGroup($kind, $itemId, $group['id'], $actor, $eventReason);
                if ($handoff['status'] !== 200) {
                    $transaction->rollBack();
                    return $this->result($handoff['status'], $handoff['body']);
                }
            }
            $run = $this->flows->run($run['id']);
            $item = $this->items->find($kind, $itemId);
            $this->publication->syncFlowReadiness($kind, $itemId, $item, $run);
            $state = $this->presenter->present(
                $kind, $itemId, $item, $run, $this->claims->claimActorMatches($item, $actor)
            );
            return $this->result(200, $state);
        });
    }

    public function switchFlow($kind, $itemId, array $actor, array $body)
    {
        return $this->configuration->switchFlow($kind, $itemId, $actor, $body);
    }

    public function setAccessPath($kind, $itemId, array $actor, array $body)
    {
        return $this->configuration->setAccessPath($kind, $itemId, $actor, $body);
    }

    private function startRun($kind, $itemId, array $item, array $mapping, array $actor)
    {
        $steps = json_decode($mapping['steps_json'], true) ?: [];
        $firstStep = $steps[0]['key'];
        $publicationState = $this->publication->lockForWrite($kind, $itemId, $item['submission_id']);
        $runId = $this->flows->insertRun(
            $kind, $itemId, $mapping['id'], $mapping['version'], $firstStep, $publicationState['draft_revision']
        );
        $this->events->record(
            $item['submission_id'], $itemId, $actor, 'flow_selected', null, [],
            ['run_id' => $runId, 'flow_id' => (int)$mapping['id'], 'version' => (int)$mapping['version'], 'current_step_key' => $firstStep], $kind
        );
        $run = $this->flows->run($runId);
        $this->publication->syncFlowReadiness($kind, $itemId, $item, $run);
        return $run;
    }

    private function trimmedString($value)
    {
        return is_scalar($value) ? trim((string)$value) : '';
    }
}
