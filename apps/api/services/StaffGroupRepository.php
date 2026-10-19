<?php

namespace app\services;

use Yii;

/** Owns persistence and membership queries for staff groups. */
class StaffGroupRepository
{
    public function find($id, $forUpdate = false)
    {
        $sql = 'SELECT * FROM staff_groups WHERE id = :id LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '');
        return Yii::$app->db->createCommand($sql, [':id' => (int)$id])->queryOne() ?: null;
    }

    public function allGroups()
    {
        return Yii::$app->db->createCommand($this->groupListSql(false), [])->queryAll();
    }

    public function groupsForMember($username)
    {
        return Yii::$app->db->createCommand($this->groupListSql(true), [':username' => $username])->queryAll();
    }

    public function isMember($groupId, $username)
    {
        return (bool)Yii::$app->db->createCommand(
            'SELECT 1 FROM staff_group_members WHERE group_id = :group_id AND username = :username LIMIT 1',
            [':group_id' => (int)$groupId, ':username' => $username]
        )->queryScalar();
    }

    public function members($groupId)
    {
        return Yii::$app->db->createCommand(
            'SELECT m.username, COALESCE(NULLIF(u.full_name, ""), u.username) AS display_name, '
            . 'm.added_by, m.added_at FROM staff_group_members m '
            . 'LEFT JOIN users u ON u.username = m.username '
            . 'WHERE m.group_id = :group_id ORDER BY display_name ASC, m.username ASC',
            [':group_id' => (int)$groupId]
        )->queryAll();
    }

    public function staffMember($username)
    {
        return Yii::$app->db->createCommand(
            'SELECT username, COALESCE(NULLIF(full_name, ""), username) AS display_name, role '
            . 'FROM users WHERE username = :username AND role IN ("staff", "admin") LIMIT 1',
            [':username' => $username]
        )->queryOne();
    }

    public function nameExists($name, $exceptId = null)
    {
        $sql = 'SELECT 1 FROM staff_groups WHERE name = :name';
        $params = [':name' => $name];
        if ($exceptId !== null) {
            $sql .= ' AND id <> :id';
            $params[':id'] = (int)$exceptId;
        }
        return (bool)Yii::$app->db->createCommand($sql . ' LIMIT 1', $params)->queryScalar();
    }

    public function insertGroup(array $values)
    {
        Yii::$app->db->createCommand()->insert('staff_groups', $values)->execute();
        return (int)Yii::$app->db->getLastInsertID();
    }

    public function updateGroup($id, array $values)
    {
        return Yii::$app->db->createCommand()->update('staff_groups', $values, ['id' => (int)$id])->execute();
    }

    public function deleteGroup($id)
    {
        return Yii::$app->db->createCommand()->delete('staff_groups', ['id' => (int)$id])->execute();
    }

    public function hasAssignedItems($groupId)
    {
        return (int)Yii::$app->db->createCommand(
            'SELECT (SELECT COUNT(*) FROM submission_new_resources WHERE assigned_group_id = :new_id) '
            . '+ (SELECT COUNT(*) FROM submission_reuse_resources WHERE assigned_group_id = :reuse_id)',
            [':new_id' => (int)$groupId, ':reuse_id' => (int)$groupId]
        )->queryScalar() > 0;
    }

    public function insertMember($groupId, $username, $addedBy)
    {
        Yii::$app->db->createCommand()->insert('staff_group_members', [
            'group_id' => (int)$groupId,
            'username' => $username,
            'added_by' => $addedBy,
        ])->execute();
    }

    public function deleteMember($groupId, $username)
    {
        return Yii::$app->db->createCommand()->delete('staff_group_members', [
            'group_id' => (int)$groupId,
            'username' => $username,
        ])->execute();
    }

    public function memberUsernames($groupId)
    {
        return Yii::$app->db->createCommand(
            'SELECT username FROM staff_group_members WHERE group_id = :group_id ORDER BY username ASC',
            [':group_id' => (int)$groupId]
        )->queryColumn();
    }

    private function groupListSql($memberOnly)
    {
        $membership = $memberOnly ? 'INNER JOIN staff_group_members mine ON mine.group_id = g.id ' : '';
        $where = $memberOnly ? 'WHERE mine.username = :username ' : '';
        $params = $memberOnly ? ':username' : '';
        return 'SELECT g.id, g.name, g.description, g.created_by, g.created_at, '
            . '(SELECT COUNT(*) FROM staff_group_members m WHERE m.group_id = g.id) AS member_count, '
            . '(SELECT COUNT(*) FROM submission_new_resources i '
            . 'INNER JOIN faculty_submissions s ON s.submission_id = i.submission_id '
            . 'WHERE i.assigned_group_id = g.id AND i.claimed_by IS NULL AND s.link_state = "linked") '
            . '+ (SELECT COUNT(*) FROM submission_reuse_resources i '
            . 'INNER JOIN faculty_submissions s ON s.submission_id = i.submission_id '
            . 'WHERE i.assigned_group_id = g.id AND i.claimed_by IS NULL AND s.link_state = "linked") AS queue_count '
            . 'FROM staff_groups g ' . $membership . $where . 'ORDER BY g.name ASC, g.id ASC';
    }
}
