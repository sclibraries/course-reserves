<?php

namespace app\services;

use Yii;

/** Adds or removes only the synthetic Acquisitions group rows owned by dev-seed/test-courses. */
class DevSeedGroupService
{
    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?: Yii::$app->db;
    }

    public function seed($staffUsername)
    {
        $groupId = $this->groupId();
        if ($groupId === null) {
            $this->db->createCommand()->insert('staff_groups', [
                'name' => 'Acquisitions',
                'description' => 'Acquisitions staff queue',
                'created_by' => $staffUsername,
            ])->execute();
            $groupId = (int)$this->db->getLastInsertID();
        }
        $this->db->createCommand()->upsert('staff_group_members', [
            'group_id' => $groupId,
            'username' => $staffUsername,
            'added_by' => $staffUsername,
        ], ['added_by' => $staffUsername])->execute();
    }

    public function reset($staffUsername)
    {
        $groupId = $this->groupId();
        if ($groupId === null) {
            return;
        }
        $this->db->createCommand()->delete('staff_group_members', [
            'group_id' => $groupId,
            'username' => $staffUsername,
        ])->execute();
        $group = $this->db->createCommand(
            'SELECT created_by FROM staff_groups WHERE id = :id', [':id' => $groupId]
        )->queryOne();
        $memberCount = (int)$this->db->createCommand(
            'SELECT COUNT(*) FROM staff_group_members WHERE group_id = :id', [':id' => $groupId]
        )->queryScalar();
        $hasItems = (int)$this->db->createCommand(
            'SELECT (SELECT COUNT(*) FROM submission_new_resources WHERE assigned_group_id = :new_id) '
            . '+ (SELECT COUNT(*) FROM submission_reuse_resources WHERE assigned_group_id = :reuse_id)',
            [':new_id' => $groupId, ':reuse_id' => $groupId]
        )->queryScalar() > 0;
        if ($group && $group['created_by'] === $staffUsername && $memberCount === 0 && !$hasItems) {
            $this->db->createCommand()->delete('staff_groups', ['id' => $groupId])->execute();
        }
    }

    private function groupId()
    {
        $id = $this->db->createCommand(
            'SELECT id FROM staff_groups WHERE name = :name LIMIT 1',
            [':name' => 'Acquisitions']
        )->queryScalar();
        return $id === false ? null : (int)$id;
    }
}
