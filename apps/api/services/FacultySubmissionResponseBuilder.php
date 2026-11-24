<?php

namespace app\services;

use app\models\FacultySubmission;

/** Builds faculty submission headers around the canonical E3 item representation. */
class FacultySubmissionResponseBuilder
{
    public function index(array $submissions, array $accessDetails): array
    {
        $itemsBySubmission = (new FacultySubmissionItemsReader())->forSubmissions(
            $submissions,
            date('Y-m-d H:i:s')
        );
        $items = [];
        foreach ($submissions as $key => $submission) {
            $represented = $itemsBySubmission[(int)$submission->submission_id];
            $counts = $this->counts($represented);
            $access = $accessDetails[$key];
            $item = $this->header($submission, $represented, $access);
            $item['item_counts'] = $counts['item_counts'];
            $item['completion_percentage'] = $counts['completion_percentage'];
            $items[] = $item;
        }

        return $items;
    }

    public function view(FacultySubmission $submission): array
    {
        $represented = $this->representedItems($submission);
        $response = $this->header($submission, $represented);
        $response['metadata'] = $submission->metadata ? $submission->metadata->toArray() : null;
        $response['status_summary'] = $this->counts($represented)['status_summary'];

        return $response;
    }

    public function saved(FacultySubmission $submission): array
    {
        $submission->refresh();
        $represented = $this->representedItems($submission);
        $response = $this->header($submission, $represented);
        $response['lock_status'] = $submission->getLockStatus();

        return $response;
    }

    private function header(FacultySubmission $submission, array $represented, ?array $access = null): array
    {
        $response = $submission->toArray(FacultySubmissionPresenter::modelFields($submission));
        $response['folders'] = $represented['folders'];
        $response['unfoldered_items'] = $represented['unfoldered_items'];
        $response['can_edit'] = $submission->canEdit();
        if ($access !== null) {
            $response['id'] = $submission->submission_uuid;
            $response['instructors'] = $submission->faculty_display_name ?? '';
            $response['term'] = $this->formatTermCode($submission->term_code);
            $response['lastUpdated'] = $submission->updated_at
                ? date('M j, Y', strtotime($submission->updated_at))
                : null;
            $response['isTestData'] = false;
            $response['is_locked'] = (bool)$submission->is_locked;
            $response['access'] = $access['access'];
            if ($access['access'] === 'proxy') {
                $response['proxy_can_edit'] = $access['proxy_can_edit'];
            }
        }

        return $response;
    }

    private function representedItems(FacultySubmission $submission): array
    {
        return (new FacultySubmissionItemsReader())->forSubmissions(
            [$submission],
            date('Y-m-d H:i:s')
        )[(int)$submission->submission_id];
    }

    private function formatTermCode($termCode)
    {
        if (!$termCode || strpos($termCode, ' ') !== false || strlen($termCode) < 6) {
            return $termCode;
        }

        $semesterMap = [
            '01' => 'Spring',
            '02' => 'Winter',
            '05' => 'Summer',
            '09' => 'Fall',
        ];
        $semester = substr($termCode, 4, 2);

        return substr($termCode, 0, 4) . ' ' . ($semesterMap[$semester] ?? 'Term ' . $semester);
    }

    private function counts(array $represented): array
    {
        $items = $represented['unfoldered_items'];
        foreach ($represented['folders'] as $folder) {
            $items = array_merge($items, $folder['items']);
        }

        $total = count($items);
        $reuse = 0;
        $complete = 0;
        $statusCounts = ['pending' => 0, 'in_progress' => 0, 'complete' => 0, 'unavailable' => 0];
        foreach ($items as $item) {
            $reuse += $item['is_reuse'] ? 1 : 0;
            $status = $item['status'] ?? 'pending';
            if ($status === 'complete') {
                $complete++;
            }
            if (!array_key_exists($status, $statusCounts)) {
                $status = 'pending';
            }
            $statusCounts[$status]++;
        }

        $percentage = $total ? round(($complete / $total) * 100, 1) : 0;
        return [
            'item_counts' => [
                'total' => $total,
                'reuse' => $reuse,
                'new' => $total - $reuse,
                'complete' => $complete,
                'pending' => $total - $complete,
            ],
            'completion_percentage' => $percentage,
            'status_summary' => [
                'total_items' => $total,
                'by_status' => $statusCounts,
                'completion_percentage' => $percentage,
            ],
        ];
    }
}
