<?php

namespace app\services;

use Yii;

/** Persists and reads staff-only workflow history. Call record inside the write transaction. */
class WorkflowEventLog
{
    public function record($submissionId, $itemId, array $actor, $eventType, $reason, array $before, array $after)
    {
        $transaction = Yii::$app->db->getTransaction();
        if (!$transaction || !$transaction->isActive) {
            throw new \LogicException('Workflow events must be recorded inside the caller transaction.');
        }

        Yii::$app->db->createCommand()->insert('workflow_events', [
            'submission_id' => $submissionId,
            'item_id' => $itemId,
            'actor_username' => $actor['username'],
            'actor_role' => $actor['role'],
            'event_type' => $eventType,
            'reason' => $reason,
            'before_json' => json_encode($before, JSON_UNESCAPED_SLASHES),
            'after_json' => json_encode($after, JSON_UNESCAPED_SLASHES),
        ])->execute();
    }

    public function timeline($submissionId)
    {
        $events = Yii::$app->db->createCommand(
            'SELECT event_type, actor_username, actor_role, reason, before_json, after_json, created_at '
            . 'FROM workflow_events WHERE submission_id = :submission_id ORDER BY created_at ASC, id ASC',
            [':submission_id' => $submissionId]
        )->queryAll();

        return array_map(function ($event) {
            return [
                'event_type' => $event['event_type'],
                'actor' => $event['actor_username'],
                'actor_role' => $event['actor_role'],
                'reason' => $event['reason'],
                'before' => $event['before_json'] === null ? null : json_decode($event['before_json'], true),
                'after' => $event['after_json'] === null ? null : json_decode($event['after_json'], true),
                'created_at' => $event['created_at'],
            ];
        }, $events);
    }
}
