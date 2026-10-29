<?php

namespace app\services;

use Yii;

/** Persists private publication state for the polymorphic submission item keys. */
class SubmissionPublicationStateRepository
{
    public function ensureForSubmission($submissionId)
    {
        $transaction = Yii::$app->db->getTransaction();
        if (!$transaction || !$transaction->isActive) {
            throw new \LogicException('Publication state creation requires the submission write transaction.');
        }
        foreach (['new' => 'submission_new_resources', 'reuse' => 'submission_reuse_resources'] as $kind => $table) {
            Yii::$app->db->createCommand(
                'INSERT IGNORE INTO submission_publication_state (item_kind, item_id, submission_id) '
                . 'SELECT :kind, id, submission_id FROM ' . $table . ' WHERE submission_id = :submission_id',
                [':kind' => $kind, ':submission_id' => (int)$submissionId]
            )->execute();
        }
    }

    public function lock($kind, $itemId, $submissionId)
    {
        Yii::$app->db->createCommand(
            'INSERT INTO submission_publication_state (item_kind, item_id, submission_id) '
            . 'VALUES (:kind, :item_id, :submission_id) ON DUPLICATE KEY UPDATE '
            . 'submission_id = VALUES(submission_id)',
            [':kind' => $kind, ':item_id' => (int)$itemId, ':submission_id' => (int)$submissionId]
        )->execute();
        return Yii::$app->db->createCommand(
            'SELECT * FROM submission_publication_state '
            . 'WHERE item_kind = :kind AND item_id = :item_id FOR UPDATE',
            [':kind' => $kind, ':item_id' => (int)$itemId]
        )->queryOne();
    }

    public function find($kind, $itemId)
    {
        return Yii::$app->db->createCommand(
            'SELECT * FROM submission_publication_state '
            . 'WHERE item_kind = :kind AND item_id = :item_id LIMIT 1',
            [':kind' => $kind, ':item_id' => (int)$itemId]
        )->queryOne() ?: null;
    }

    public function forSubmission($submissionId)
    {
        $rows = Yii::$app->db->createCommand(
            'SELECT * FROM submission_publication_state WHERE submission_id = :submission_id',
            [':submission_id' => (int)$submissionId]
        )->queryAll();
        $states = [];
        foreach ($rows as $row) {
            $states[$row['item_kind'] . ':' . (int)$row['item_id']] = $row;
        }
        return $states;
    }

    public function lastClaimEvents(array $items)
    {
        if (!$items) {
            return [];
        }
        $conditions = [];
        $params = [];
        foreach ($items as $index => $item) {
            $kind = ':kind' . $index;
            $id = ':item_id' . $index;
            $conditions[] = '(item_kind = ' . $kind . ' AND item_id = ' . $id . ')';
            $params[$kind] = $item['kind'];
            $params[$id] = (int)$item['id'];
        }
        $rows = Yii::$app->db->createCommand(
            'SELECT event.item_kind, event.item_id, event.event_type FROM workflow_events event '
            . 'INNER JOIN (SELECT item_kind, item_id, MAX(id) AS id FROM workflow_events '
            . 'WHERE event_type IN ("claimed", "claim_expired", "released", "handed_off", '
            . '"taken_over", "group_handoff") AND (' . implode(' OR ', $conditions) . ') '
            . 'GROUP BY item_kind, item_id) latest ON latest.id = event.id'
        , $params)->queryAll();
        $events = [];
        foreach ($rows as $row) {
            $events[$row['item_kind'] . ':' . (int)$row['item_id']] = $row['event_type'];
        }
        return $events;
    }

    public function save($kind, $itemId, array $values)
    {
        return Yii::$app->db->createCommand()->update(
            'submission_publication_state', $values,
            ['item_kind' => $kind, 'item_id' => (int)$itemId]
        )->execute();
    }

    public function delete($kind, $itemId)
    {
        return Yii::$app->db->createCommand()->delete('submission_publication_state', [
            'item_kind' => $kind,
            'item_id' => (int)$itemId,
        ])->execute();
    }
}
