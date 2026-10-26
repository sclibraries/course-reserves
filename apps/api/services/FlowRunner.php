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
    private $accessPathMappings;
    private $accessPathPresenter;

    public function __construct($flows = null, $items = null, $claims = null, $groups = null, $events = null, $accessPathMappings = null)
    {
        $this->flows = $flows ?: new FlowRepository();
        $this->items = $items ?: new ItemClaimRepository();
        $this->claims = $claims ?: Yii::$container->get(ItemClaimService::class);
        $this->groups = $groups ?: new StaffGroupRepository();
        $this->events = $events ?: new WorkflowEventLog();
        $this->presenter = new FlowStatePresenter($this->flows);
        $this->accessPathMappings = $accessPathMappings ?: new AccessPathMappingRepository();
        $this->accessPathPresenter = new AccessPathResponsePresenter();
    }

    public function getItemFlow($kind, $itemId, array $actor)
    {
        return $this->claims->withLinkedItem($kind, $itemId, function ($item) use ($kind, $itemId, $actor) {
            $latest = $this->flows->latestRun($kind, $itemId, true);
            if (!$latest) {
                $mapping = $this->flows->mappedFlow($item['material_type_id']);
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
            if (in_array($step['kind'] ?? null, ['confirm_on_reserve', 'publish_online'], true)) {
                return $this->result(409, ['error_code' => 'step_not_available_yet']);
            }
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
            $state = $this->presenter->present(
                $kind, $itemId, $item, $run, $this->claims->claimActorMatches($item, $actor)
            );
            return $this->result(200, $state);
        });
    }

    public function switchFlow($kind, $itemId, array $actor, array $body)
    {
        $reason = $this->trimmedString($body['reason'] ?? null);
        if ($reason === '') {
            return $this->result(400, ['error_code' => 'reason_required']);
        }
        $flowValue = $body['flow_id'] ?? 0;
        $flowId = is_scalar($flowValue) ? (int)$flowValue : 0;
        return $this->claims->withLinkedItem($kind, $itemId, function ($item, $transaction, $now) use (
            $kind, $itemId, $actor, $flowId, $reason
        ) {
            if (!$this->claims->claimActorMatches($item, $actor)) {
                return $this->result(409, ['error_code' => 'not_claimed_by_you']);
            }
            $replacement = $this->replaceOpenRun($kind, $itemId, $flowId, $reason, $now);
            if ($replacement['status'] !== 200) {
                $transaction->rollBack();
                return $replacement;
            }
            $run = $replacement['body']['run'];
            $this->claims->renewClaimLocked($kind, $itemId, $now);
            if ($replacement['body']['changed']) {
                $this->events->record(
                    $item['submission_id'], $itemId, $actor, 'flow_changed', $reason,
                    $replacement['body']['before'] ?? [], [
                        'run_id' => (int)$run['id'], 'flow_id' => $flowId,
                        'version' => (int)$run['version'], 'current_step_key' => $run['current_step_key'],
                    ], $kind
                );
            }
            $item = $this->items->find($kind, $itemId);
            $state = $this->presenter->present(
                $kind, $itemId, $item, $run, $this->claims->claimActorMatches($item, $actor)
            );
            return $this->result(200, $state);
        });
    }

    public function setAccessPath($kind, $itemId, array $actor, array $body)
    {
        $value = $body['access_path'] ?? null;
        $accessPath = is_scalar($value) ? trim((string)$value) : '';
        $reason = $this->trimmedString($body['reason'] ?? null);
        return $this->claims->withLinkedItem($kind, $itemId, function ($item, $transaction, $now) use (
            $kind, $itemId, $actor, $accessPath, $reason
        ) {
            if (!$this->claims->claimActorMatches($item, $actor)) {
                return $this->result(409, ['error_code' => 'not_claimed_by_you']);
            }
            if (!in_array($accessPath, AccessPathPolicy::allowedForItem($item), true)) {
                return $this->result(422, ['error_code' => 'access_path_not_allowed']);
            }
            $currentPath = (string)($item['access_path'] ?? '');
            if ($currentPath === $accessPath) {
                $this->claims->renewClaimLocked($kind, $itemId, $now);
                $mapping = $this->accessPathMappings->find($accessPath);
                $hasFlowMapping = $mapping && $mapping['flow_id'] !== null;
                if (!$hasFlowMapping && ($openRun = $this->flows->openRun($kind, $itemId, true))) {
                    $this->closeOpenRun($openRun, $reason ?: 'access_path_unmapped', $now);
                }
                $run = $hasFlowMapping ? $this->flows->latestRun($kind, $itemId) : null;
                return $this->result(200, $this->accessPathPresenter->present($accessPath, $run, $item, $mapping));
            }
            if ($currentPath !== '' && $reason === '') {
                return $this->result(400, ['error_code' => 'reason_required']);
            }
            $mapping = $this->accessPathMappings->find($accessPath);
            $flowId = $mapping && $mapping['flow_id'] !== null ? (int)$mapping['flow_id'] : null;
            $groupId = $mapping && $mapping['group_id'] !== null ? (int)$mapping['group_id'] : null;
            if ($flowId !== null) {
                $replacement = $this->replaceOpenRun($kind, $itemId, $flowId, $reason ?: null, $now);
                if ($replacement['status'] !== 200) {
                    $transaction->rollBack();
                    return $replacement;
                }
            } else {
                $openRun = $this->flows->openRun($kind, $itemId, true);
                if ($openRun) {
                    $this->closeOpenRun($openRun, $reason ?: 'access_path_unmapped', $now);
                }
            }
            $this->claims->renewClaimLocked($kind, $itemId, $now);
            if ($groupId !== null) {
                $handoff = $this->claims->handoffToGroup($kind, $itemId, $groupId, $actor, $reason ?: null);
                if ($handoff['status'] !== 200) {
                    $transaction->rollBack();
                    return $this->result($handoff['status'], $handoff['body']);
                }
            }
            $this->items->setAccessPath($kind, $itemId, $accessPath);
            $item = $this->items->find($kind, $itemId);
            $run = $flowId === null ? null : $this->flows->latestRun($kind, $itemId);
            $after = $this->accessPathPresenter->present($accessPath, $run, $item, $mapping);
            $eventAfter = $after;
            unset($eventAfter['warning']);
            $this->events->record(
                $item['submission_id'], $itemId, $actor, 'access_path_set', $reason ?: null,
                ['access_path' => $currentPath === '' ? null : $currentPath], $eventAfter, $kind
            );
            return $this->result(200, $after);
        });
    }

    private function replaceOpenRun($kind, $itemId, $flowId, $reason, $now)
    {
        if (!$this->flows->flow($flowId, true)) {
            return $this->result(404, ['error_code' => 'unknown_flow']);
        }
        $oldRun = $this->flows->openRun($kind, $itemId, true);
        if ($oldRun && (int)$oldRun['flow_id'] === (int)$flowId) {
            return $this->result(200, ['run' => $oldRun, 'changed' => false, 'before' => null]);
        }
        $version = $this->flows->latestVersion($flowId);
        if (!$version) {
            return $this->result(409, ['error_code' => 'flow_version_missing']);
        }
        $steps = json_decode($version['steps_json'], true);
        $firstStep = is_array($steps) && isset($steps[0]['key']) ? trim((string)$steps[0]['key']) : '';
        if ($firstStep === '') {
            return $this->result(409, ['error_code' => 'flow_has_no_steps']);
        }
        $before = $oldRun ? $this->presenter->runSnapshot($oldRun) : null;
        if ($oldRun) {
            $this->closeOpenRun($oldRun, $reason, $now);
        }
        $runId = $this->flows->insertRun($kind, $itemId, $flowId, $version['version'], $firstStep);
        return $this->result(200, [
            'run' => $this->flows->run($runId), 'changed' => true, 'before' => $before,
        ]);
    }

    private function closeOpenRun(array $run, $reason, $now)
    {
        $this->flows->updateRun($run['id'], [
            'current_step_key' => null, 'closed_at' => $now, 'closed_reason' => $reason,
        ]);
    }

    private function startRun($kind, $itemId, array $item, array $mapping, array $actor)
    {
        $steps = json_decode($mapping['steps_json'], true) ?: [];
        $firstStep = $steps[0]['key'];
        $runId = $this->flows->insertRun($kind, $itemId, $mapping['id'], $mapping['version'], $firstStep);
        $this->events->record(
            $item['submission_id'], $itemId, $actor, 'flow_selected', null, [],
            ['run_id' => $runId, 'flow_id' => (int)$mapping['id'], 'version' => (int)$mapping['version'], 'current_step_key' => $firstStep], $kind
        );
        return $this->flows->run($runId);
    }

    private function trimmedString($value)
    {
        return is_scalar($value) ? trim((string)$value) : '';
    }
}
