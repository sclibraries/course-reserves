<?php

namespace app\services;

use Yii;

/** Reads a bounded page of currently open item-history review rows. */
class ItemHistoryReviewReadService
{
    use ServiceResult;
    use ItemHistoryReviewFailure;

    const PAGE_SIZE = 50;

    public function list($page, $submissionId)
    {
        if ($page === null) {
            $page = 1;
        } else {
            $page = $this->positiveInteger($page, intdiv(PHP_INT_MAX, self::PAGE_SIZE) + 1);
            if ($page === null) {
                return $this->failure(422, 'invalid_page');
            }
        }

        if ($submissionId !== null) {
            $submissionId = $this->positiveInteger($submissionId, PHP_INT_MAX);
            if ($submissionId === null) {
                return $this->failure(422, 'invalid_submission_id');
            }
        }

        $where = 'review.reviewed_at IS NULL';
        $params = [':limit' => self::PAGE_SIZE, ':offset' => ($page - 1) * self::PAGE_SIZE];
        if ($submissionId !== null) {
            $where .= ' AND review.submission_id = :submission_id';
            $params[':submission_id'] = $submissionId;
        }

        $rows = Yii::$app->db->createCommand(
            'SELECT review.item_id, review.submission_id, review.trace, review.flagged_at, '
            . ItemClaimListRepository::newItemTitleSql('item.resource_data') . ' AS stored_title, '
            . 'source.name AS source_resource_title, submission.course_code, submission.course_title, '
            . 'submission.term_code, submission.section '
            . 'FROM item_history_review review '
            . 'INNER JOIN submission_new_resources item ON item.id = review.item_id '
            . 'INNER JOIN faculty_submissions submission ON submission.submission_id = review.submission_id '
            . 'LEFT JOIN resources source ON source.resource_id = '
            . SourceResourceId::sqlValue('item.source_resource_id') . ' '
            . 'WHERE ' . $where . ' ORDER BY review.id ASC LIMIT :limit OFFSET :offset',
            $params
        )->queryAll();
        $count = Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM item_history_review review WHERE ' . $where,
            array_diff_key($params, [':limit' => true, ':offset' => true])
        )->queryScalar();

        $submissionOpenCounts = $this->openCountsForRows($rows);
        $items = array_map(function ($row) use ($submissionOpenCounts) {
            $submissionId = (int)$row['submission_id'];
            return [
                'item_id' => (int)$row['item_id'],
                'submission_id' => $submissionId,
                'item_title' => $row['stored_title'] ?: ($row['source_resource_title'] ?: null),
                'trace' => $row['trace'],
                'flagged_at' => $row['flagged_at'],
                'course' => [
                    'course_code' => $row['course_code'],
                    'course_title' => $row['course_title'],
                    'term_code' => $row['term_code'],
                    'section' => $row['section'],
                ],
                'submission_open_count' => $submissionOpenCounts[$submissionId] ?? 0,
            ];
        }, $rows);

        return $this->result(200, [
            'items' => $items,
            'count' => (int)$count,
            'page' => $page,
            'per_page' => self::PAGE_SIZE,
        ]);
    }

    private function openCountsForRows(array $rows)
    {
        $submissionIds = array_unique(array_map('intval', array_column($rows, 'submission_id')));
        if (!$submissionIds) {
            return [];
        }

        $placeholders = [];
        $params = [];
        foreach (array_values($submissionIds) as $index => $submissionId) {
            $name = ':submission_' . $index;
            $placeholders[] = $name;
            $params[$name] = $submissionId;
        }
        $rows = Yii::$app->db->createCommand(
            'SELECT submission_id, COUNT(*) AS open_count FROM item_history_review '
            . 'WHERE reviewed_at IS NULL AND submission_id IN (' . implode(', ', $placeholders) . ') '
            . 'GROUP BY submission_id',
            $params
        )->queryAll();

        $counts = [];
        foreach ($rows as $row) {
            $counts[(int)$row['submission_id']] = (int)$row['open_count'];
        }
        return $counts;
    }

    private function positiveInteger($value, $maximum)
    {
        if (!is_string($value) || preg_match('/\A[1-9][0-9]*\z/', $value) !== 1) {
            return null;
        }
        $maximum = (string)$maximum;
        if (strlen($value) > strlen($maximum)
            || (strlen($value) === strlen($maximum) && strcmp($value, $maximum) > 0)) {
            return null;
        }
        return (int)$value;
    }
}
