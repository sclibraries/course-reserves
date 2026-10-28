<?php

namespace app\services;

use Yii;

/** Reads unified new/reuse queue rows and staff hand-off choices. */
class ItemClaimListRepository
{
    private $items;

    public function __construct(ItemClaimRepository $items = null)
    {
        $this->items = $items ?: new ItemClaimRepository();
    }

    public function queueCount($term, $type)
    {
        list($sql, $params) = $this->queueSql($term, $type);
        return (int)Yii::$app->db->createCommand('SELECT COUNT(*) FROM (' . $sql . ') claim_rows', $params)->queryScalar();
    }

    public function queuePage($term, $type, $page, $pageSize)
    {
        list($sql, $params) = $this->queueSql($term, $type);
        $params[':limit'] = (int)$pageSize;
        $params[':offset'] = ((int)$page - 1) * (int)$pageSize;
        return Yii::$app->db->createCommand(
            'SELECT * FROM (' . $sql . ') claim_rows '
            . 'ORDER BY submitted_at ASC, position ASC, kind ASC, id ASC LIMIT :limit OFFSET :offset',
            $params
        )->queryAll();
    }

    public function myItems($username)
    {
        list($sql, $params) = $this->unionRows(['new', 'reuse'], function ($kind, $suffix) use ($username) {
            return [
                'i.claimed_by = :username_' . $suffix . ' AND s.link_state = "linked" AND '
                    . SubmittedSubmissionScope::sqlPredicate('s'),
                [':username_' . $suffix => $username],
            ];
        });
        return Yii::$app->db->createCommand(
            'SELECT * FROM (' . $sql . ') claim_rows '
            . 'ORDER BY last_activity_at ASC, claimed_at ASC, submitted_at ASC, position ASC, kind ASC, id ASC',
            $params
        )->queryAll();
    }

    public function groupQueue($groupId)
    {
        list($sql, $params) = $this->unionRows(['new', 'reuse'], function ($kind, $suffix) use ($groupId) {
            return [
                'i.assigned_group_id = :group_' . $suffix . ' AND i.claimed_by IS NULL AND s.link_state = "linked" AND '
                    . SubmittedSubmissionScope::sqlPredicate('s'),
                [':group_' . $suffix => (int)$groupId],
            ];
        });
        return Yii::$app->db->createCommand(
            'SELECT * FROM (' . $sql . ') claim_rows '
            . 'ORDER BY submitted_at ASC, position ASC, kind ASC, id ASC',
            $params
        )->queryAll();
    }

    public function staff($query)
    {
        $sql = 'SELECT username, COALESCE(NULLIF(full_name, ""), username) AS display_name '
            . 'FROM users WHERE role IN ("staff", "admin")';
        $params = [];
        if ($query !== null && trim((string)$query) !== '') {
            $sql .= ' AND (username LIKE :query OR full_name LIKE :query)';
            $params[':query'] = '%' . trim((string)$query) . '%';
        }
        return Yii::$app->db->createCommand($sql . ' ORDER BY display_name ASC, username ASC LIMIT 20', $params)->queryAll();
    }

    private function queueSql($term, $type)
    {
        $kinds = in_array($type, ['new', 'reuse'], true) ? [$type] : ['new', 'reuse'];
        list($sql, $params) = $this->unionRows($kinds, function ($kind, $suffix) use ($term, $type) {
            $where = [
                'i.claimed_by IS NULL',
                'i.assigned_group_id IS NULL',
                's.link_state = "linked"',
                SubmittedSubmissionScope::sqlPredicate('s'),
            ];
            $params = [];
            if ($term !== null && trim((string)$term) !== '') {
                $where[] = 's.term_code = :term_' . $suffix;
                $params[':term_' . $suffix] = trim((string)$term);
            }
            if ($type !== null && trim((string)$type) !== '' && !in_array($type, ['new', 'reuse'], true)) {
                $where[] = 'mt.name = :material_type_' . $suffix;
                $params[':material_type_' . $suffix] = trim((string)$type);
            }
            return [implode(' AND ', $where), $params];
        });
        return [$sql, $params];
    }

    private function unionRows(array $kinds, $conditionBuilder)
    {
        $selects = [];
        $params = [];
        foreach ($kinds as $kind) {
            $suffix = $kind;
            list($condition, $conditionParams) = call_user_func($conditionBuilder, $kind, $suffix);
            $selects[] = $this->selectForKind($kind, $condition);
            $params = array_merge($params, $conditionParams);
        }
        return [implode(' UNION ALL ', $selects), $params];
    }

    private function selectForKind($kind, $condition)
    {
        $table = $this->items->table($kind);
        $materialTypeJoin = $kind === 'new'
            ? 'mt.material_type_id = i.material_type_id'
            : 'mt.material_type_id = source.material_type_id';
        $title = $kind === 'new'
            ? 'CASE WHEN JSON_VALID(i.resource_data) THEN JSON_UNQUOTE(JSON_EXTRACT(i.resource_data, "$.title")) ELSE NULL END'
            : 'NULL';
        $resourceData = $kind === 'new' ? 'i.resource_data' : 'NULL';
        return 'SELECT "' . $kind . '" AS kind, i.id, i.submission_id, s.submission_uuid, '
            . 's.course_code, s.section, s.term_code, ' . $title . ' AS title, source.name AS source_resource_title, '
            . $resourceData . ' AS resource_data, mt.name AS material_type, i.display_order AS position, '
            . 'i.item_status AS status, i.claimed_by, i.claimed_at, i.last_activity_at, i.assigned_group_id, '
            . 'mt.material_type_id, flow_run.current_step_key, flow_run.finish_state AS flow_finish_state, '
            . 'flow_version.steps_json AS flow_steps_json, '
            . 's.submitted_at, ' . ItemClaimRepository::claimedByDisplayNameSql() . ' AS claimed_by_display, '
            . 'group_ref.name AS assigned_group_name '
            . 'FROM ' . $table . ' i INNER JOIN faculty_submissions s ON s.submission_id = i.submission_id '
            . 'LEFT JOIN resources source ON source.resource_id = i.source_resource_id '
            . 'LEFT JOIN material_types mt ON ' . $materialTypeJoin . ' '
            . 'LEFT JOIN users claimant ON claimant.username = i.claimed_by '
            . 'LEFT JOIN staff_groups group_ref ON group_ref.id = i.assigned_group_id '
            . 'LEFT JOIN item_flow_runs flow_run ON flow_run.id = (SELECT MAX(run.id) FROM item_flow_runs run '
            . 'WHERE run.item_kind = "' . $kind . '" AND run.item_id = i.id) '
            . 'LEFT JOIN flow_versions flow_version ON flow_version.flow_id = flow_run.flow_id '
            . 'AND flow_version.version = flow_run.version WHERE ' . $condition;
    }
}
