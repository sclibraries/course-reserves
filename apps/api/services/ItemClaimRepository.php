<?php

namespace app\services;

use Yii;
use app\models\FacultySubmission;
use app\models\SubmissionNewResource;
use yii\web\BadRequestHttpException;

/** Hides the new/reuse item tables behind the public kind/id reference. */
class ItemClaimRepository
{
    public function table($kind)
    {
        if ($kind === 'new') {
            return 'submission_new_resources';
        }
        if ($kind === 'reuse') {
            return 'submission_reuse_resources';
        }
        throw new BadRequestHttpException('Item kind must be new or reuse.');
    }

    public static function claimedByDisplayNameSql()
    {
        return 'COALESCE(NULLIF(claimant.full_name, ""), claimant.username)';
    }

    public function find($kind, $id, $forUpdate = false)
    {
        $table = $this->table($kind);
        $materialTypeJoin = $kind === 'new'
            ? 'mt.material_type_id = i.material_type_id'
            : 'mt.material_type_id = source.material_type_id';
        $resourceData = $kind === 'new' ? 'i.resource_data' : 'NULL';
        $sql = 'SELECT i.id, i.submission_id, i.claimed_by, i.claimed_at, i.last_activity_at, '
            . 'i.assigned_group_id, i.access_path, i.item_status AS status, i.display_order AS position, '
            . 'i.public_note, i.assigned_pages, '
            . $resourceData . ' AS resource_data, source.name AS source_resource_title, '
            . 'mt.name AS material_type, mt.material_type_id, flow_run.current_step_key, '
            . 'flow_run.finish_state AS flow_finish_state, flow_version.steps_json AS flow_steps_json, '
            . 's.submission_uuid, s.course_code, s.section, s.term_code, s.link_state, '
            . 's.status AS submission_status, s.submitted_at, '
            . self::claimedByDisplayNameSql() . ' AS claimed_by_display, '
            . 'group_ref.name AS assigned_group_name '
            . 'FROM ' . $table . ' i INNER JOIN faculty_submissions s ON s.submission_id = i.submission_id '
            . 'LEFT JOIN resources source ON source.resource_id = i.source_resource_id '
            . 'LEFT JOIN material_types mt ON ' . $materialTypeJoin . ' '
            . 'LEFT JOIN users claimant ON claimant.username = i.claimed_by '
            . 'LEFT JOIN staff_groups group_ref ON group_ref.id = i.assigned_group_id '
            . 'LEFT JOIN item_flow_runs flow_run ON flow_run.id = (SELECT MAX(run.id) FROM item_flow_runs run '
            . 'WHERE run.item_kind = "' . $kind . '" AND run.item_id = i.id) '
            . 'LEFT JOIN flow_versions flow_version ON flow_version.flow_id = flow_run.flow_id '
            . 'AND flow_version.version = flow_run.version '
            . 'WHERE i.id = :id LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '');
        $row = Yii::$app->db->createCommand($sql, [':id' => $id])->queryOne();
        if ($row) {
            $row['item_kind'] = $kind;
        }
        return $row ?: null;
    }

    public function claimsBySubmission($submissionId)
    {
        $claims = ['new' => [], 'reuse' => []];
        foreach (['new', 'reuse'] as $kind) {
            $rows = Yii::$app->db->createCommand(
                'SELECT i.id, i.submission_id, i.claimed_by, i.claimed_at, i.last_activity_at, '
                . 'i.assigned_group_id, i.item_status AS status, s.status AS submission_status, s.link_state, '
                . self::claimedByDisplayNameSql() . ' AS claimed_by_display, '
                . 'group_ref.name AS assigned_group_name '
                . 'FROM ' . $this->table($kind) . ' i '
                . 'INNER JOIN faculty_submissions s ON s.submission_id = i.submission_id '
                . 'LEFT JOIN users claimant ON claimant.username = i.claimed_by '
                . 'LEFT JOIN staff_groups group_ref ON group_ref.id = i.assigned_group_id '
                . 'WHERE i.submission_id = :submission_id FOR UPDATE',
                [':submission_id' => (int)$submissionId]
            )->queryAll();
            foreach ($rows as $row) {
                $claims[$kind][(int)$row['id']] = $row;
            }
        }
        return $claims;
    }

    public function claimIfUnclaimed($kind, $id, $username, $now)
    {
        return Yii::$app->db->createCommand(
            'UPDATE ' . $this->table($kind) . ' SET claimed_by = :username, claimed_at = :now, '
            . 'last_activity_at = :now, item_status = "in_progress" '
            . 'WHERE id = :id AND claimed_by IS NULL AND '
            . '(assigned_group_id IS NULL OR EXISTS (SELECT 1 FROM staff_group_members m '
            . 'WHERE m.group_id = ' . $this->table($kind) . '.assigned_group_id AND m.username = :username)) '
            . 'AND EXISTS (SELECT 1 FROM faculty_submissions submitted '
            . 'WHERE submitted.submission_id = ' . $this->table($kind) . '.submission_id AND '
            . SubmittedSubmissionScope::sqlPredicate('submitted') . ')',
            [':username' => $username, ':now' => $now, ':id' => $id]
        )->execute();
    }

    public function releaseIfOwned($kind, $id, $username, $now)
    {
        return Yii::$app->db->createCommand()->update($this->table($kind), [
            'claimed_by' => null,
            'claimed_at' => null,
            'last_activity_at' => $now,
        ], ['and', ['id' => $id], ['claimed_by' => $username]])->execute();
    }

    public function handoffIfOwned($kind, $id, $username, $toUsername, $now)
    {
        return Yii::$app->db->createCommand()->update($this->table($kind), [
            'claimed_by' => $toUsername,
            'claimed_at' => $now,
            'last_activity_at' => $now,
            'assigned_group_id' => null,
        ], ['and', ['id' => $id], ['claimed_by' => $username]])->execute();
    }

    public function handoffToGroupIfOwned($kind, $id, $username, $groupId, $now)
    {
        return Yii::$app->db->createCommand()->update($this->table($kind), [
            'claimed_by' => null,
            'claimed_at' => null,
            'last_activity_at' => $now,
            'assigned_group_id' => (int)$groupId,
        ], ['and', ['id' => $id], ['claimed_by' => $username]])->execute();
    }

    public function takeoverIfClaimed($kind, $id, $toUsername, $now)
    {
        return Yii::$app->db->createCommand(
            'UPDATE ' . $this->table($kind)
            . ' SET claimed_by = :username, claimed_at = :now, last_activity_at = :now '
            . 'WHERE id = :id AND claimed_by IS NOT NULL',
            [':username' => $toUsername, ':now' => $now, ':id' => $id]
        )->execute();
    }

    public function expireIfDue($kind, $id, $username, $cutoff, $now)
    {
        return Yii::$app->db->createCommand()->update($this->table($kind), [
            'claimed_by' => null,
            'claimed_at' => null,
            'last_activity_at' => $now,
        ], [
            'and',
            ['id' => $id],
            ['claimed_by' => $username],
            ['or', ['<=', 'last_activity_at', $cutoff], ['and', ['last_activity_at' => null], ['<=', 'claimed_at', $cutoff]]],
        ])->execute();
    }

    public function touchActivity($kind, $id, $now)
    {
        return Yii::$app->db->createCommand()->update($this->table($kind), [
            'last_activity_at' => $now,
        ], ['id' => $id])->execute();
    }

    public function setAccessPath($kind, $id, $accessPath)
    {
        return Yii::$app->db->createCommand()->update($this->table($kind), [
            'access_path' => $accessPath,
        ], ['id' => (int)$id])->execute();
    }

    public function updateDetails($kind, $id, array $details, $now)
    {
        $details['last_activity_at'] = $now;
        return Yii::$app->db->createCommand()->update(
            $this->table($kind), $details, ['id' => (int)$id]
        )->execute();
    }

    public function clearClaimForChecklistCompletion($kind, $id, $now)
    {
        return Yii::$app->db->createCommand()->update($this->table($kind), [
            'claimed_by' => null,
            'claimed_at' => null,
            'last_activity_at' => $now,
        ], ['id' => $id])->execute();
    }

    public function itemRefsBySubmission($submissionId)
    {
        $items = [];
        foreach (['new', 'reuse'] as $kind) {
            $rows = Yii::$app->db->createCommand(
                'SELECT id, display_order AS position FROM ' . $this->table($kind) . ' WHERE submission_id = :id',
                [':id' => $submissionId]
            )->queryAll();
            foreach ($rows as $row) {
                $items[] = ['kind' => $kind, 'id' => (int)$row['id'], 'position' => (int)$row['position']];
            }
        }
        usort($items, function ($left, $right) {
            if ($left['position'] !== $right['position']) {
                return $left['position'] <=> $right['position'];
            }
            if ($left['kind'] !== $right['kind']) {
                return $left['kind'] === 'new' ? -1 : 1;
            }
            return $left['id'] <=> $right['id'];
        });
        return $items;
    }

    public function expiredClaimCandidates($cutoff)
    {
        $items = [];
        foreach (['new', 'reuse'] as $kind) {
            $rows = Yii::$app->db->createCommand(
                'SELECT id FROM ' . $this->table($kind)
                . ' WHERE claimed_by IS NOT NULL AND COALESCE(last_activity_at, claimed_at) <= :cutoff AND EXISTS '
                . '(SELECT 1 FROM faculty_submissions s WHERE s.submission_id = ' . $this->table($kind) . '.submission_id '
                . 'AND ' . SubmittedSubmissionScope::sqlPredicate('s') . ')',
                [':cutoff' => $cutoff]
            )->queryColumn();
            foreach ($rows as $id) {
                $items[] = ['kind' => $kind, 'id' => (int)$id];
            }
        }
        return $items;
    }

    public function submissionByUuid($uuid)
    {
        return FacultySubmission::find()->where(['submission_uuid' => $uuid])->one();
    }

    public function findStaffByUsername($username)
    {
        return Yii::$app->db->createCommand(
            'SELECT id, username, full_name, role FROM users WHERE username = :username AND role IN ("staff", "admin") LIMIT 1',
            [':username' => $username]
        )->queryOne();
    }

    public function legacyClaimedNewItems($username)
    {
        return SubmissionNewResource::find()
            ->joinWith('submission')
            ->where(['submission_new_resources.claimed_by' => $username])
            ->andWhere(['faculty_submissions.link_state' => 'linked'])
            ->andWhere(['<>', 'faculty_submissions.status', FacultySubmission::STATUS_DRAFT])
            ->with(['submission', 'materialType'])
            ->orderBy(['submission_new_resources.claimed_at' => SORT_DESC])
            ->all();
    }
}
