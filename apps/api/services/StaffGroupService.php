<?php

namespace app\services;

use Yii;

/** Applies staff-group access rules and transactionally records admin changes. */
class StaffGroupService
{
    private $repository;
    private $eventLog;
    private $claims;
    private $lists;
    private $presenter;

    public function __construct($repository = null, $eventLog = null, $claims = null, $lists = null)
    {
        $this->repository = $repository ?: new StaffGroupRepository();
        $this->eventLog = $eventLog ?: new StaffGroupEventLog();
        $this->claims = $claims ?: Yii::$container->get(ItemClaimService::class);
        $this->lists = $lists ?: new ItemClaimListRepository();
        $this->presenter = new ItemClaimPresenter();
    }

    public function adminGroups()
    {
        return $this->result(200, ['groups' => $this->repository->allGroups()]);
    }

    public function groupOptions()
    {
        $groups = array_map(function ($group) {
            return ['id' => (int)$group['id'], 'name' => $group['name']];
        }, $this->repository->allGroups());
        return $this->result(200, ['groups' => $groups]);
    }

    public function createGroup(array $input, array $actor)
    {
        $name = $this->validatedName($input['name'] ?? null);
        if ($name === null) {
            return $this->result(400, ['error_code' => 'group_name_required']);
        }
        $description = $this->description($input['description'] ?? null);
        if ($this->repository->nameExists($name)) {
            return $this->result(409, ['error_code' => 'group_name_exists']);
        }

        $transaction = Yii::$app->db->beginTransaction();
        try {
            $id = $this->repository->insertGroup([
                'name' => $name,
                'description' => $description,
                'created_by' => $actor['username'],
            ]);
            $after = ['name' => $name, 'description' => $description];
            $this->eventLog->record($id, $name, $actor, 'group_created', [], $after);
            $transaction->commit();
            return $this->result(201, ['group' => $this->groupSummary($id)]);
        } catch (\yii\db\IntegrityException $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            return $this->result(409, ['error_code' => 'group_name_exists']);
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    public function updateGroup($id, array $input, array $actor)
    {
        $values = [];
        if (array_key_exists('name', $input)) {
            $name = $this->validatedName($input['name']);
            if ($name === null) {
                return $this->result(400, ['error_code' => 'group_name_required']);
            }
            $values['name'] = $name;
        }
        if (array_key_exists('description', $input)) {
            $values['description'] = $this->description($input['description']);
        }
        if (!$values) {
            return $this->result(400, ['error_code' => 'group_update_required']);
        }

        $transaction = Yii::$app->db->beginTransaction();
        try {
            $group = $this->repository->find($id, true);
            if (!$group) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'group_not_found']);
            }
            if (isset($values['name']) && $this->repository->nameExists($values['name'], $id)) {
                $transaction->rollBack();
                return $this->result(409, ['error_code' => 'group_name_exists']);
            }
            $before = ['name' => $group['name'], 'description' => $group['description']];
            $updated = array_merge($before, $values);
            $this->repository->updateGroup($id, $values);
            $this->eventLog->record($id, $group['name'], $actor, 'group_updated', $before, $updated);
            $transaction->commit();
            return $this->result(200, ['group' => $this->groupSummary($id)]);
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    public function deleteGroup($id, array $actor)
    {
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $group = $this->repository->find($id, true);
            if (!$group) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'group_not_found']);
            }
            if ($this->repository->hasAssignedItems($id)) {
                $transaction->rollBack();
                return $this->result(409, ['error_code' => 'group_has_items']);
            }
            $before = ['name' => $group['name'], 'description' => $group['description']];
            $this->eventLog->record($id, $group['name'], $actor, 'group_deleted', $before, []);
            $this->repository->deleteGroup($id);
            $transaction->commit();
            return $this->result(204, []);
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    public function members($groupId)
    {
        if (!$this->repository->find($groupId)) {
            return $this->result(404, ['error_code' => 'group_not_found']);
        }
        return $this->result(200, ['members' => $this->repository->members($groupId)]);
    }

    public function addMember($groupId, $username, array $actor)
    {
        $username = trim((string)$username);
        if ($username === '') {
            return $this->result(400, ['error_code' => 'username_required']);
        }
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $group = $this->repository->find($groupId, true);
            if (!$group) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'group_not_found']);
            }
            $staff = $this->repository->staffMember($username);
            if (!$staff) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'unknown_staff']);
            }
            if ($this->repository->isMember($groupId, $username)) {
                $transaction->rollBack();
                return $this->result(409, ['error_code' => 'already_group_member']);
            }
            $this->repository->insertMember($groupId, $username, $actor['username']);
            $after = ['username' => $username, 'display_name' => $staff['display_name']];
            $this->eventLog->record(
                $groupId, $group['name'], $actor, 'member_added', [], $after
            );
            $transaction->commit();
            return $this->result(201, ['member' => $this->memberSummary($groupId, $username)]);
        } catch (\yii\db\IntegrityException $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            return $this->result(409, ['error_code' => 'already_group_member']);
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    public function removeMember($groupId, $username, array $actor)
    {
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $group = $this->repository->find($groupId, true);
            if (!$group) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'group_not_found']);
            }
            $member = $this->memberSummary($groupId, $username);
            if (!$member) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'member_not_found']);
            }
            $this->repository->deleteMember($groupId, $username);
            $this->eventLog->record(
                $groupId, $group['name'], $actor, 'member_removed', $member, []
            );
            $transaction->commit();
            return $this->result(204, []);
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    public function myGroups($username)
    {
        $this->claims->expireDueClaims();
        return $this->result(200, ['groups' => $this->repository->groupsForMember($username)]);
    }

    public function groupQueue($groupId, $username)
    {
        if (!$this->repository->find($groupId)) {
            return $this->result(404, ['error_code' => 'group_not_found']);
        }
        if (!$this->repository->isMember($groupId, $username)) {
            return $this->result(403, ['error_code' => 'not_group_member']);
        }
        $this->claims->expireDueClaims();
        $rows = $this->lists->groupQueue($groupId);
        $expiryHours = (int)(Yii::$app->params['workflowClaimExpiryHours'] ?? 72);
        $items = array_map(function ($row) use ($expiryHours) {
            return $this->presenter->present($row, $expiryHours);
        }, $rows);
        return $this->result(200, ['items' => $items, 'count' => count($items)]);
    }

    private function groupSummary($id)
    {
        foreach ($this->repository->allGroups() as $group) {
            if ((int)$group['id'] === (int)$id) {
                return $group;
            }
        }
        return null;
    }

    private function memberSummary($groupId, $username)
    {
        foreach ($this->repository->members($groupId) as $member) {
            if ($member['username'] === $username) {
                return $member;
            }
        }
        return null;
    }

    private function validatedName($value)
    {
        $name = trim((string)$value);
        return $name !== '' && strlen($name) <= 255 ? $name : null;
    }

    private function description($value)
    {
        if ($value === null) {
            return null;
        }
        $description = trim((string)$value);
        return $description === '' ? null : $description;
    }

    private function result($status, array $body)
    {
        return ['status' => $status, 'body' => $body];
    }
}
