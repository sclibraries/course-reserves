<?php

namespace app\services;

use Yii;
use yii\web\BadRequestHttpException;

/** Creates a staff-entered submission through the shared faculty submission path. */
class StaffEnteredSubmissionService
{
    private $contexts;
    private $payloads;
    private $creator;
    private $syllabi;
    private $links;

    public function __construct(
        ?FacultySubmissionContext $contexts = null,
        ?SubmissionPayloadService $payloads = null,
        ?SubmittedSubmissionCreator $creator = null,
        ?SyllabusStore $syllabi = null,
        ?SubmissionLinkService $links = null
    ) {
        $this->contexts = $contexts ?: new FacultySubmissionContext();
        $this->payloads = $payloads ?: new SubmissionPayloadService();
        $this->creator = $creator ?: new SubmittedSubmissionCreator($this->contexts, $this->payloads);
        $this->syllabi = $syllabi ?: Yii::$container->get(SyllabusStore::class);
        $this->links = $links ?: Yii::$container->get(SubmissionLinkService::class);
    }

    public function create(array $actor, array $data)
    {
        $input = $this->prepareInput($actor, $data);
        if (isset($input['error_code'])) {
            return $this->error(422, $input['error_code']);
        }
        try {
            $this->payloads->validate(
                $input['data']['courseInfo'],
                $this->payloads->validationResources($this->payloads->payloadResources($input['data']))
            );
        } catch (BadRequestHttpException $exception) {
            return $this->error(422, 'invalid_submission');
        }

        $submissionId = null;
        $syllabusId = null;
        $afterCreate = function ($submission) use ($input, $actor, &$submissionId, &$syllabusId) {
            $submissionId = (int)$submission->submission_id;
            $syllabus = $this->syllabi->add($submissionId, $input['syllabus'], $actor);
            $syllabusId = (int)$syllabus['id'];
            $link = $this->links->link($submission->submission_uuid, $input['listing_id'], $actor);
            if ((int)($link['status'] ?? 0) !== 200) {
                throw new StaffSubmissionLinkException(
                    $link['status'] ?? 500,
                    $link['body']['error_code'] ?? 'course_link_failed'
                );
            }
        };
        $onFailure = function () use (&$submissionId, &$syllabusId) {
            if ($submissionId !== null && $syllabusId !== null) {
                $this->syllabi->removeStoredFileForSubmission($submissionId, $syllabusId);
            }
        };

        try {
            $result = $this->creator->create(
                $input['context'],
                $actor,
                $input['data'],
                [
                    'entered_by' => $actor['username'],
                    'entry_source' => 'staff_syllabus',
                    'proxy_shibboleth_user_id' => null,
                    'proxy_display_name' => null,
                ],
                $afterCreate,
                $onFailure,
                false
            );
            if (!empty($result['draft_exists'])) {
                return $this->error(409, 'instructor_draft_exists');
            }
            if ($result['duplicate']) {
                return $this->error(409, 'submission_already_exists');
            }
            return [
                'status_code' => 201,
                'body' => [
                    'submission_id' => (int)$result['submission']->submission_id,
                    'submission_uuid' => $result['submission']->submission_uuid,
                ],
            ];
        } catch (SyllabusException $exception) {
            return [
                'status_code' => $exception->getStatusCode(),
                'body' => $exception->toResponse(),
            ];
        } catch (StaffSubmissionLinkException $exception) {
            return $this->error($exception->getStatusCode(), $exception->getErrorCode());
        } catch (\Throwable $exception) {
            return $this->failure($exception);
        }
    }

    private function prepareInput(array $actor, array $data)
    {
        $username = $data['instructor_username'] ?? null;
        if (!is_string($username) || trim($username) === '') {
            return ['error_code' => 'instructor_username_required'];
        }
        $username = strtolower(trim($username));
        $at = strpos($username, '@');
        if ($at !== false) {
            $username = trim(substr($username, 0, $at));
        }
        if ($username === '' || strpos($username, '@') !== false) {
            return ['error_code' => 'instructor_username_required'];
        }

        $displayName = $data['instructor_display_name'] ?? null;
        if (!is_string($displayName) || trim($displayName) === '') {
            return ['error_code' => 'instructor_display_name_required'];
        }
        $listingId = $data['folio_course_listing_id'] ?? null;
        if (!is_string($listingId) || trim($listingId) === '') {
            return ['error_code' => 'folio_course_listing_id_required'];
        }
        if (!isset($data['courseInfo']) || !is_array($data['courseInfo'])) {
            return ['error_code' => 'course_info_required'];
        }
        if (!isset($data['items']) || !is_array($data['items']) || !$data['items']) {
            return ['error_code' => 'items_required'];
        }
        if (isset($data['folders']) && !is_array($data['folders'])) {
            return ['error_code' => 'folders_invalid'];
        }
        if (!isset($data['syllabus']) || !is_array($data['syllabus']) || !$data['syllabus']) {
            return ['error_code' => 'syllabus_required'];
        }

        $course = $data['courseInfo'];
        $course['instructors'] = trim($displayName);
        $submissionData = $data;
        unset(
            $submissionData['instructor_username'],
            $submissionData['instructor_display_name'],
            $submissionData['folio_course_listing_id'],
            $submissionData['syllabus'],
            $submissionData['resources']
        );
        $submissionData['courseInfo'] = $course;
        $submissionData['metadata'] = isset($data['metadata']) && is_array($data['metadata']) ? $data['metadata'] : [];
        $submissionData['metadata']['emailConfirmation'] = false;
        return [
            'listing_id' => trim($listingId),
            'syllabus' => $data['syllabus'],
            'data' => $submissionData,
            'context' => $this->contexts->forOwner($actor, $username, $course, trim($listingId)),
        ];
    }

    private function error($statusCode, $errorCode)
    {
        return ['status_code' => (int)$statusCode, 'body' => ['error_code' => $errorCode]];
    }

    private function failure(\Throwable $exception)
    {
        $reference = bin2hex(random_bytes(6));
        $detail = str_replace(["\r", "\n"], ' ', $exception->getMessage());
        Yii::error('Staff-entered submission failed. reference=' . $reference . ' detail=' . $detail, __METHOD__);
        return [
            'status_code' => 500,
            'body' => [
                'error' => 'We could not create the request. Contact library staff with reference ' . $reference,
                'reference_id' => $reference,
            ],
        ];
    }
}
