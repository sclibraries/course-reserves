<?php

use app\services\LegacySubmissionItemUpdateService;
use app\services\ItemClaimService;
use app\services\SubmissionCopyInputRefreshService;
use app\services\SubmissionItemDetailsService;

class PostLockReadConcurrencyNotifier implements \app\services\WorkflowNotifier
{
    public $notifications = [];

    public function notify($eventType, array $context)
    {
        $this->notifications[] = ['event' => $eventType, 'context' => $context];
    }
}

/** Runs item writers behind an acknowledged barrier after their plain discovery read. */
class PostLockReadConcurrencyWorkerOps
{
    private static $paused;
    private static $request;
    private static $notifier;

    public static function run(array $request, $db)
    {
        self::$request = $request;
        self::$notifier = null;
        PublicationDestinationConcurrencyWorkerOps::assertFixtureManifest($request['manifest'] ?? [], $db);
        self::$paused = false;
        Api119A4ItemLockConcurrencyCommand::setObserver(function ($sql) {
            self::observe($sql);
        });

        try {
            if (isset($request['caller_read'])) {
                return self::nested($request, $db);
            }
            $result = self::invoke($request);
            return self::includeNotifications($result);
        } finally {
            Api119A4ItemLockConcurrencyCommand::setObserver(null);
        }
    }

    private static function nested(array $request, $db)
    {
        $transaction = $db->beginTransaction();
        try {
            $before = self::callerRead($request, $db);
            $result = self::invoke($request);
            $after = self::callerRead($request, $db);
            $transaction->commit();
            Yii::$app->get('workflowNotificationQueue')->flushAfterCommit();
            return [
                'result' => self::includeNotifications(self::response($result)),
                'caller_read_before' => $before,
                'caller_read_after' => $after,
            ];
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    private static function callerRead(array $request, $db)
    {
        $read = $request['caller_read'];
        return $db->createCommand($read['sql'], $read['params'] ?? [])->queryScalar();
    }

    private static function invoke(array $request)
    {
        if ($request['op'] === 'item_lock_a5_claim') {
            return (new ItemClaimService())->claim(
                $request['kind'], $request['item_id'], $request['actor']
            );
        }
        if ($request['op'] === 'item_lock_a5_handoff') {
            return (new ItemClaimService())->handoff(
                $request['kind'], $request['item_id'], $request['target'], $request['actor'], 'Synthetic A5c handoff'
            );
        }
        if ($request['op'] === 'item_lock_a5_group_handoff') {
            self::$notifier = new PostLockReadConcurrencyNotifier();
            return (new ItemClaimService(null, null, null, self::$notifier))->handoffToGroup(
                $request['kind'], $request['item_id'], $request['group_id'], $request['actor'], 'Synthetic A5c group handoff'
            );
        }
        if ($request['op'] === 'item_lock_a5_flow_get') {
            return (new \app\services\FlowRunner())->getItemFlow(
                $request['kind'], $request['item_id'], $request['actor']
            );
        }
        if ($request['op'] === 'item_lock_a5_step_result') {
            return (new \app\services\FlowRunner())->stepResult(
                $request['kind'], $request['item_id'], $request['actor'], $request['body']
            );
        }
        if ($request['op'] === 'item_lock_a5_switch_flow') {
            return (new \app\services\FlowRunner())->switchFlow(
                $request['kind'], $request['item_id'], $request['actor'], $request['body']
            );
        }
        if ($request['op'] === 'item_lock_a5_set_access_path') {
            return (new \app\services\FlowRunner())->setAccessPath(
                $request['kind'], $request['item_id'], $request['actor'], $request['body']
            );
        }
        if ($request['op'] === 'item_lock_a5_contract') {
            return (new \app\services\SubmissionPublicationStateService())->contract(
                $request['kind'], $request['item_id'], $request['actor']
            );
        }
        if ($request['op'] === 'item_lock_a5_mark_ready') {
            return (new \app\services\SubmissionPublicationStateService())->markReady(
                $request['kind'], $request['item_id'], $request['actor'], $request['body']['reason'] ?? null
            );
        }
        if ($request['op'] === 'item_lock_a5_input_projection') {
            return (new \app\services\SubmissionInputProjectionService())->project(
                $request['kind'], $request['item_id']
            );
        }
        if ($request['op'] === 'item_lock_a5_placement') {
            $claims = \Yii::$container->get(\app\services\ItemClaimService::class);
            return $claims->withLinkedItem($request['kind'], $request['item_id'], function ($item) use ($request) {
                (new \app\services\SubmissionPublicationStateService())->recordChange(
                    $request['kind'], $request['item_id'], $item['submission_id'],
                    \app\services\ItemChangeClass::PLACEMENT
                );
                return ['status' => 200, 'body' => []];
            });
        }
        $actor = $request['actor'];
        if ($request['op'] === 'item_lock_a5_details') {
            return (new SubmissionItemDetailsService())->update(
                $request['kind'], $request['item_id'], $actor, $request['body']
            );
        }
        if ($request['op'] === 'item_lock_a5_copy_refresh') {
            return (new SubmissionCopyInputRefreshService())->refresh(
                $request['kind'], $request['item_id'], $actor
            );
        }
        if ($request['op'] === 'item_lock_a5_legacy_update') {
            return (new LegacySubmissionItemUpdateService())->update(
                $request['item_id'], $actor, $request['body']
            );
        }
        throw new \RuntimeException('Unknown post-lock read operation: ' . $request['op']);
    }

    private static function response(array $result)
    {
        $body = $result['body'] ?? [];
        if (isset($body['item']) && is_object($body['item']) && method_exists($body['item'], 'getAttributes')) {
            $body['item'] = $body['item']->getAttributes();
        }
        return ['status' => $result['status'], 'body' => $body];
    }

    private static function includeNotifications(array $result)
    {
        if (self::$notifier !== null) {
            $result['notifications'] = self::$notifier->notifications;
        }
        return $result;
    }

    private static function checkpoint($operation, $sql, $phase)
    {
        PublicationDestinationConcurrencyWire::write(STDOUT, [
            'op' => $operation,
            'attempt' => 1,
            'phase' => $phase,
            'context' => ['sql' => $sql],
        ]);
        $answer = PublicationDestinationConcurrencyWire::read(STDIN);
        if (($answer['command'] ?? null) !== 'go' || ($answer['phase'] ?? null) !== $phase
            || (int)($answer['attempt'] ?? -1) !== 1) {
            throw new \RuntimeException('Post-lock read worker received an invalid ' . $phase . ' acknowledgement.');
        }
    }

    private static function observe($sql)
    {
        if (self::$paused) {
            return;
        }
        $phase = self::$request['pause_after'] ?? 'discovered';
        $patterns = [
            'discovered' => '/SELECT\s+submission_id\s+FROM\s+submission_(?:new|reuse)_resources\s+WHERE\s+id\s*=/i',
            'item_locked' => '/SELECT\s+\*\s+FROM\s+submission_(?:new|reuse)_resources\s+WHERE\s+id\s*=.*FOR\s+UPDATE/i',
        ];
        if (isset($patterns[$phase]) && preg_match($patterns[$phase], $sql)) {
            self::$paused = true;
            self::checkpoint(self::$request['op'], $sql, $phase);
        }
    }
}
