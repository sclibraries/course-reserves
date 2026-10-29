<?php

namespace app\services;

use Yii;

/** Owns staff flow switching and access-path transitions. */
class FlowConfigurationService
{
    use ServiceResult;

    private $flows;
    private $items;
    private $claims;
    private $events;
    private $presenter;
    private $accessPathMappings;
    private $accessPathPresenter;
    private $publication;

    public function __construct($flows, $items, $claims, $events, $accessPathMappings, $publication)
    {
        $this->flows = $flows;
        $this->items = $items;
        $this->claims = $claims;
        $this->events = $events;
        $this->presenter = new FlowStatePresenter($flows);
        $this->accessPathMappings = $accessPathMappings;
        $this->accessPathPresenter = new AccessPathResponsePresenter();
        $this->publication = $publication;
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
            if ($replacement['body']['changed']) {
                $this->publication->invalidateContext($kind, $itemId, $item['submission_id']);
            }
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
            $this->publication->syncFlowReadiness($kind, $itemId, $item, $run);
            return $this->result(200, $this->presenter->present(
                $kind, $itemId, $item, $run, $this->claims->claimActorMatches($item, $actor)
            ));
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
                $openRun = $this->flows->openRun($kind, $itemId, true);
                if (!$hasFlowMapping && $openRun) {
                    $this->closeOpenRun($openRun, $reason ?: 'access_path_unmapped', $now);
                    $this->publication->invalidateContext($kind, $itemId, $item['submission_id']);
                }
                $run = $hasFlowMapping ? $this->flows->latestRun($kind, $itemId) : null;
                return $this->result(200, $this->accessPathPresenter->present($accessPath, $run, $item, $mapping));
            }
            if ($currentPath !== '' && $reason === '') {
                return $this->result(400, ['error_code' => 'reason_required']);
            }
            $this->publication->invalidateDraft($kind, $itemId, $item['submission_id']);
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
        $item = $this->items->find($kind, $itemId);
        $publicationState = $this->publication->lockForWrite($kind, $itemId, $item['submission_id']);
        $runId = $this->flows->insertRun(
            $kind, $itemId, $flowId, $version['version'], $firstStep, $publicationState['draft_revision']
        );
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

    private function trimmedString($value)
    {
        return is_scalar($value) ? trim((string)$value) : '';
    }
}
