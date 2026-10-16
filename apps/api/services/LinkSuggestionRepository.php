<?php

namespace app\services;

use Yii;
use yii\db\Query;

/** Stores the current candidate group and a bounded queue of asynchronous refresh requests. */
class LinkSuggestionRepository
{
    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?: Yii::$app->db;
    }

    public function latestRows($submissionId)
    {
        return $this->db->createCommand(
            'SELECT * FROM link_suggestions WHERE submission_id = :submission_id '
            . 'AND checked_at = (SELECT MAX(checked_at) FROM link_suggestions '
            . 'WHERE submission_id = :latest_submission_id AND checked_at IS NOT NULL) ORDER BY id ASC',
            [':submission_id' => $submissionId, ':latest_submission_id' => $submissionId]
        )->queryAll();
    }

    public function summary(array $rows)
    {
        if (!$rows) {
            return [
                'match' => null,
                'fields' => null,
                'checked_at' => null,
                'candidate_count' => 0,
                'items' => [],
            ];
        }

        $match = 'none';
        $fields = ['course_number' => false, 'section' => false, 'term' => false];
        $items = [];
        foreach ($rows as $row) {
            $candidateFields = json_decode($row['fields_json'], true);
            $candidate = $row['candidate_json'] === null ? null : json_decode($row['candidate_json'], true);
            if (is_array($candidate)) {
                $items[] = $candidate;
            }
            if ($row['match'] === 'exact' || ($row['match'] === 'possible' && $match !== 'exact')) {
                $match = $row['match'];
                $fields = is_array($candidateFields) ? $candidateFields : $fields;
            }
        }

        return [
            'match' => $match,
            'fields' => $fields,
            'checked_at' => $rows[0]['checked_at'],
            'candidate_count' => count($items),
            'items' => $items,
        ];
    }

    public function replaceResults($submissionId, array $items, $checkedAt)
    {
        $this->db->createCommand()->delete('link_suggestions', ['submission_id' => $submissionId])->execute();
        if (!$items) {
            $items = [[
                'folio_course_listing_id' => null,
                'match' => 'none',
                'fields' => ['course_number' => false, 'section' => false, 'term' => false],
            ]];
        }

        foreach ($items as $item) {
            $candidate = isset($item['folio_course_listing_id']) ? $item : null;
            $this->db->createCommand()->insert('link_suggestions', [
                'submission_id' => $submissionId,
                'folio_course_listing_id' => $item['folio_course_listing_id'] ?? null,
                'match' => $item['match'],
                'fields_json' => json_encode($item['fields'], JSON_UNESCAPED_SLASHES),
                'candidate_json' => $candidate === null ? null : json_encode($candidate, JSON_UNESCAPED_SLASHES),
                'checked_at' => $checkedAt,
                'last_error_at' => null,
                'requested_at' => null,
            ])->execute();
        }
    }

    public function recordError($submissionId, $errorAt)
    {
        $count = (int)$this->db->createCommand(
            'SELECT COUNT(*) FROM link_suggestions WHERE submission_id = :submission_id',
            [':submission_id' => $submissionId]
        )->queryScalar();
        if ($count > 0) {
            $this->db->createCommand()->update('link_suggestions', [
                'last_error_at' => $errorAt,
                'requested_at' => null,
            ], ['submission_id' => $submissionId])->execute();
            return;
        }

        $this->db->createCommand()->insert('link_suggestions', [
            'submission_id' => $submissionId,
            'folio_course_listing_id' => null,
            'match' => null,
            'fields_json' => '{}',
            'candidate_json' => null,
            'checked_at' => null,
            'last_error_at' => $errorAt,
            'requested_at' => null,
        ])->execute();
    }

    public function clearQueue($submissionId)
    {
        $this->db->createCommand()->update('link_suggestions', [
            'requested_at' => null,
        ], ['submission_id' => $submissionId])->execute();
    }

    public function queueStale($staleMinutes, $limit)
    {
        $cutoff = date('Y-m-d H:i:s', time() - ((int)$staleMinutes * 60));
        $limit = max(1, min(50, (int)$limit));
        $ids = $this->db->createCommand(
            'SELECT submissions.submission_id FROM faculty_submissions submissions '
            . 'LEFT JOIN (SELECT submission_id, MAX(checked_at) checked_at, MAX(last_error_at) last_error_at, '
            . 'MAX(requested_at) requested_at '
            . 'FROM link_suggestions GROUP BY submission_id) suggestions '
            . 'ON suggestions.submission_id = submissions.submission_id '
            . 'WHERE submissions.link_state = :link_state '
            . 'AND (COALESCE(suggestions.last_error_at, suggestions.checked_at) IS NULL '
            . 'OR COALESCE(suggestions.last_error_at, suggestions.checked_at) <= :cutoff) '
            . 'AND suggestions.requested_at IS NULL '
            . 'ORDER BY submissions.submitted_at ASC, submissions.submission_id ASC LIMIT ' . $limit,
            [':link_state' => 'needs_linking', ':cutoff' => $cutoff]
        )->queryColumn();
        if (!$ids) {
            return 0;
        }

        $transaction = $this->db->beginTransaction();
        try {
            $requestedAt = date('Y-m-d H:i:s');
            foreach ($ids as $submissionId) {
                $updated = $this->db->createCommand()->update('link_suggestions', [
                    'requested_at' => $requestedAt,
                ], ['submission_id' => $submissionId])->execute();
                if (!$updated) {
                    $this->db->createCommand()->insert('link_suggestions', [
                        'submission_id' => $submissionId,
                        'folio_course_listing_id' => null,
                        'match' => null,
                        'fields_json' => '{}',
                        'candidate_json' => null,
                        'checked_at' => null,
                        'last_error_at' => null,
                        'requested_at' => $requestedAt,
                    ])->execute();
                }
            }
            $transaction->commit();
            return count($ids);
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    public function queuedSubmissionIds($limit = 0)
    {
        $limitSql = $limit > 0 ? ' LIMIT ' . max(1, min(5000, (int)$limit)) : '';
        return $this->db->createCommand(
            'SELECT submissions.submission_id FROM faculty_submissions submissions '
            . 'INNER JOIN (SELECT submission_id, MIN(requested_at) requested_at FROM link_suggestions '
            . 'WHERE requested_at IS NOT NULL GROUP BY submission_id) queued '
            . 'ON queued.submission_id = submissions.submission_id '
            . 'WHERE submissions.link_state = :link_state '
            . 'ORDER BY submissions.submitted_at ASC, queued.requested_at ASC, submissions.submission_id ASC'
            . $limitSql,
            [':link_state' => 'needs_linking']
        )->queryColumn();
    }

    public function submissionIdsForCheck($limit = 0)
    {
        $limitSql = $limit > 0 ? ' LIMIT ' . max(1, min(5000, (int)$limit)) : '';
        return $this->db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE link_state = :link_state '
            . 'ORDER BY submitted_at ASC, submission_id ASC' . $limitSql,
            [':link_state' => 'needs_linking']
        )->queryColumn();
    }

    public function needsLinkingPage($page, $term, $pageSize)
    {
        $query = (new Query())->from(['submissions' => 'faculty_submissions'])
            ->where(['submissions.link_state' => 'needs_linking']);
        if ($term !== null && trim((string)$term) !== '') {
            $query->andWhere(['or',
                ['submissions.term_code' => trim((string)$term)],
                ['submissions.roster_term_id' => trim((string)$term)],
            ]);
        }

        $count = (int)(clone $query)->count('*', $this->db);
        $items = $query->select([
            'submission_id' => 'submissions.submission_id',
            'submission_uuid' => 'submissions.submission_uuid',
            'faculty_display_name' => 'submissions.faculty_display_name',
            'course_code' => 'submissions.course_code',
            'section' => 'submissions.section',
            'term_code' => 'submissions.term_code',
            'its_course_id' => 'submissions.its_course_id',
            'submitted_at' => 'submissions.submitted_at',
        ])->orderBy([
            'submissions.submitted_at' => SORT_ASC,
            'submissions.submission_id' => SORT_ASC,
        ])->limit($pageSize)->offset(($page - 1) * $pageSize)->all($this->db);

        return ['items' => $items, 'count' => $count];
    }
}
