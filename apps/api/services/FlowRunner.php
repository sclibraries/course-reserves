<?php

namespace app\services;

use Yii;

/** Runs item flow versions while delegating claim rules to ItemClaimService. */
class FlowRunner
{
    private $flows;
    private $items;
    private $claims;
    private $groups;
    private $events;
    private $presenter;

    public function __construct($flows = null, $items = null, $claims = null, $groups = null, $events = null)
    {
        $this->flows = $flows ?: new FlowRepository();
        $this->items = $items ?: new ItemClaimRepository();
        $this->claims = $claims ?: Yii::$container->get(ItemClaimService::class);
        $this->groups = $groups ?: new StaffGroupRepository();
        $this->events = $events ?: new WorkflowEventLog();
        $this->presenter = new FlowStatePresenter($this->flows);
    }

    public function getItemFlow($kind, $itemId, array $actor)
    {
        $transaction = Yii::$app->db->beginTransaction();
        $notification = null;
        try {
            $item = $this->items->find($kind, $itemId, true);
            if (!$item) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'item_not_found']);
            }
            if ($blocked = (new SubmittedSubmissionScope())->guardServiceResult($item['submission_status'], $transaction)) return $blocked;
            if ($item['link_state'] !== 'linked') {
                $transaction->rollBack();
                return $this->result(409, ['error_code' => 'submission_not_linked']);
            }
            $latest = $this->flows->latestRun($kind, $itemId, true);
            if (!$latest) {
                $mapping = $this->flows->mappedFlow($item['material_type_id']);
                if ($mapping) {
                    $latest = $this->startRun($kind, $itemId, $item, $mapping, $actor);
                }
            }
            $notification = $this->claims->expireClaimLocked($kind, $item, $this->claims->claimNow());
            if ($notification) {
                $item = $this->items->find($kind, $itemId, true);
            }
            $state = $this->presenter->present(
                $kind, $itemId, $item, $latest, $this->claims->claimActorMatches($item, $actor)
            );
            $transaction->commit();
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
        $this->claims->notifyClaimExpiry($notification);
        return $this->result(200, $state);
    }

    public function stepResult($kind, $itemId, array $actor, array $body)
    {
        $stepKey = $this->trimmedString($body['step_key'] ?? null);
        $outcomeKey = $this->trimmedString($body['outcome_key'] ?? null);
        if ($stepKey === '' || $outcomeKey === '') {
            return $this->result(400, ['error_code' => 'unknown_outcome']);
        }
        $transaction = Yii::$app->db->beginTransaction();
        $notification = null;
        try {
            $item = $this->items->find($kind, $itemId, true);
            if (!$item) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'item_not_found']);
            }
            if ($blocked = (new SubmittedSubmissionScope())->guardServiceResult($item['submission_status'], $transaction)) return $blocked;
            if ($item['link_state'] !== 'linked') {
                $transaction->rollBack();
                return $this->result(409, ['error_code' => 'submission_not_linked']);
            }
            $now = $this->claims->claimNow();
            $notification = $this->claims->expireClaimLocked($kind, $item, $now);
            if ($notification) {
                $item = $this->items->find($kind, $itemId, true);
            }
            if (!$this->claims->claimActorMatches($item, $actor)) {
                $transaction->commit();
                $this->claims->notifyClaimExpiry($notification);
                return $this->result(409, ['error_code' => 'not_claimed_by_you']);
            }
            $run = $this->flows->openRun($kind, $itemId, true);
            if (!$run) {
                $transaction->rollBack();
                return $this->result(409, ['error_code' => 'stale_step']);
            }
            if ($run['current_step_key'] !== $stepKey) {
                $transaction->commit();
                $this->claims->notifyClaimExpiry($notification);
                return $this->result(409, ['error_code' => 'stale_step']);
            }
            $steps = json_decode($run['steps_json'], true) ?: [];
            $step = $this->presenter->stepByKey($steps, $stepKey);
            if (in_array($step['kind'] ?? null, ['confirm_on_reserve', 'publish_online'], true)) {
                $transaction->commit();
                $this->claims->notifyClaimExpiry($notification);
                return $this->result(409, ['error_code' => 'step_not_available_yet']);
            }
            $outcome = $this->presenter->outcomeByKey($step, $outcomeKey);
            if (!$outcome) {
                $transaction->commit();
                $this->claims->notifyClaimExpiry($notification);
                return $this->result(400, ['error_code' => 'unknown_outcome']);
            }
            $next = $outcome['next'] ?? [];
            $finish = isset($next['finish'])
                ? $this->presenter->stepByKey($steps, $next['finish'])
                : (isset($next['step']) ? $this->presenter->stepByKey($steps, $next['step']) : []);
            if (($finish['kind'] ?? null) !== 'finish') {
                $finish = [];
            }
            $reason = $this->trimmedString($body['reason'] ?? null);
            $notes = $this->trimmedString($body['notes'] ?? null);
            if (!empty($outcome['reason_required']) || !empty($finish['reason_required'])) {
                if ($reason === '') {
                    $transaction->commit();
                    $this->claims->notifyClaimExpiry($notification);
                    return $this->result(400, ['error_code' => 'reason_required']);
                }
            }
            $group = null;
            if (isset($next['handoff_group'])) {
                $group = $this->groups->findByName($next['handoff_group']);
                if (!$group) {
                    $transaction->commit();
                    $this->claims->notifyClaimExpiry($notification);
                    return $this->result(409, ['error_code' => 'unknown_group']);
                }
            }

            $before = $this->presenter->runSnapshot($run);
            $this->claims->renewClaimLocked($kind, $itemId, $now);
            $this->flows->insertResult(
                $run['id'], $stepKey, $outcomeKey, $notes === '' ? null : $notes, $reason === '' ? null : $reason, $actor['username']
            );
            $finished = null;
            if ($finish) {
                $this->flows->updateRun($run['id'], [
                    'current_step_key' => null,
                    'finish_state' => $finish['finish_state'],
                    'finish_reason' => $reason === '' ? null : $reason,
                    'closed_at' => $now,
                    'closed_reason' => $reason === '' ? null : $reason,
                ]);
                $finished = ['finish_state' => $finish['finish_state'], 'reason' => $reason === '' ? null : $reason];
            } elseif (isset($next['step'])) {
                $target = $this->presenter->stepByKey($steps, $next['step']);
                if (($target['kind'] ?? null) === 'finish') {
                    $this->flows->updateRun($run['id'], [
                        'current_step_key' => null,
                        'finish_state' => $target['finish_state'],
                        'finish_reason' => $reason === '' ? null : $reason,
                        'closed_at' => $now,
                        'closed_reason' => $reason === '' ? null : $reason,
                    ]);
                    $finished = ['finish_state' => $target['finish_state'], 'reason' => $reason === '' ? null : $reason];
                } else {
                    $this->flows->updateRun($run['id'], ['current_step_key' => $next['step']]);
                }
            }
            $after = ['run_id' => (int)$run['id'], 'current_step_key' => $finished ? null : ($next['step'] ?? $stepKey), 'finished' => $finished];
            $this->events->record($item['submission_id'], $itemId, $actor, 'step_result', $reason ?: null, $before, $after, $kind);
            if ($finished) {
                $this->events->record($item['submission_id'], $itemId, $actor, 'finished', $reason ?: null, $before, $finished, $kind);
            }
            if ($group) {
                $handoff = $this->claims->handoffToGroup($kind, $itemId, $group['id'], $actor, $reason ?: null);
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
            $transaction->commit();
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
        $this->claims->notifyClaimExpiry($notification);
        return $this->result(200, $state);
    }

    public function switchFlow($kind, $itemId, array $actor, array $body)
    {
        $reason = $this->trimmedString($body['reason'] ?? null);
        if ($reason === '') {
            return $this->result(400, ['error_code' => 'reason_required']);
        }
        $flowValue = $body['flow_id'] ?? 0;
        $flowId = is_scalar($flowValue) ? (int)$flowValue : 0;
        $transaction = Yii::$app->db->beginTransaction();
        $notification = null;
        try {
            $item = $this->items->find($kind, $itemId, true);
            if (!$item) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'item_not_found']);
            }
            if ($blocked = (new SubmittedSubmissionScope())->guardServiceResult($item['submission_status'], $transaction)) return $blocked;
            if ($item['link_state'] !== 'linked') {
                $transaction->rollBack();
                return $this->result(409, ['error_code' => 'submission_not_linked']);
            }
            $now = $this->claims->claimNow();
            $notification = $this->claims->expireClaimLocked($kind, $item, $now);
            if ($notification) {
                $item = $this->items->find($kind, $itemId, true);
            }
            if (!$this->claims->claimActorMatches($item, $actor)) {
                $transaction->commit();
                $this->claims->notifyClaimExpiry($notification);
                return $this->result(409, ['error_code' => 'not_claimed_by_you']);
            }
            $flow = $this->flows->flow($flowId, true);
            if (!$flow) {
                $transaction->commit();
                $this->claims->notifyClaimExpiry($notification);
                return $this->result(404, ['error_code' => 'unknown_flow']);
            }
            $version = $this->flows->latestVersion($flowId);
            $oldRun = $this->flows->openRun($kind, $itemId, true);
            $before = $oldRun ? $this->presenter->runSnapshot($oldRun) : null;
            if ($oldRun) {
                $this->flows->updateRun($oldRun['id'], [
                    'current_step_key' => null,
                    'closed_at' => $now,
                    'closed_reason' => $reason,
                ]);
            }
            $steps = json_decode($version['steps_json'], true) ?: [];
            $firstStep = $steps[0]['key'];
            $runId = $this->flows->insertRun($kind, $itemId, $flowId, $version['version'], $firstStep);
            $this->claims->renewClaimLocked($kind, $itemId, $now);
            $this->events->record(
                $item['submission_id'], $itemId, $actor, 'flow_changed', $reason, $before,
                ['run_id' => $runId, 'flow_id' => $flowId, 'version' => (int)$version['version'], 'current_step_key' => $firstStep], $kind
            );
            $run = $this->flows->run($runId);
            $item = $this->items->find($kind, $itemId);
            $state = $this->presenter->present(
                $kind, $itemId, $item, $run, $this->claims->claimActorMatches($item, $actor)
            );
            $transaction->commit();
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
        $this->claims->notifyClaimExpiry($notification);
        return $this->result(200, $state);
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

    private function result($status, array $body)
    {
        return ['status' => $status, 'body' => $body];
    }

    private function trimmedString($value)
    {
        return is_scalar($value) ? trim((string)$value) : '';
    }
}
