<?php

namespace app\services;

use Yii;

/** Writes admin group changes transactionally outside workflow_events, which requires a submission. */
class StaffGroupEventLog
{
    public function record($groupId, $groupName, array $actor, $eventType, array $before, array $after)
    {
        $transaction = Yii::$app->db->getTransaction();
        if (!$transaction || !$transaction->isActive) {
            throw new \LogicException('Staff group events must be recorded inside the caller transaction.');
        }

        Yii::$app->db->createCommand()->insert('staff_group_events', [
            'group_id' => $groupId,
            'group_name' => $groupName,
            'actor_username' => $actor['username'],
            'actor_role' => $actor['role'],
            'event_type' => $eventType,
            'before_json' => json_encode($before, JSON_UNESCAPED_SLASHES),
            'after_json' => json_encode($after, JSON_UNESCAPED_SLASHES),
        ])->execute();
    }
}
