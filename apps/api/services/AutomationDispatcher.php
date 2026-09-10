<?php
namespace app\services;

use app\models\WorkflowInstance;
use app\models\WorkflowInstanceSteps;

/**
 * Simple dispatcher that routes automation intents to concrete handlers.
 */
class AutomationDispatcher
{
    /**
     * @param WorkflowInstance      $instance
     * @param WorkflowInstanceSteps $instanceStep
     * @param string|null           $intent
     * @param array                 $payload
     * @return array
     */
    public static function run(WorkflowInstance $instance, WorkflowInstanceSteps $instanceStep, $intent, array $payload)
    {
        $stepHandler = $intent ? null : ($instanceStep->step ? $instanceStep->step->automation_handler : null);
        $handlerKey  = $intent ?: $stepHandler;

        if (!$handlerKey) {
            throw new \RuntimeException('MISSING_AUTOMATION_HANDLER');
        }

        switch ($handlerKey) {
            case 'ensure_course_and_offering':
            case 'folio.ensure_course_offering': // legacy alias if you keep it
                throw new \RuntimeException('UNSUPPORTED_AUTOMATION: ' . (string)$handlerKey);

            case 'check_course_exists':
            case 'folio.check_course_exists': // optional alias
                return FolioCheckCourseExists::run($instance, $instanceStep, $payload);

            default:
                throw new \RuntimeException('UNKNOWN_AUTOMATION: ' . (string)$handlerKey);
        }
    }
}

/**
 * Handler that checks whether a FOLIO course exists and stores a summary on the instance.
 */
class FolioCheckCourseExists
{
    /**
     * @param WorkflowInstance      $instance
     * @param WorkflowInstanceSteps $instanceStep
     * @param array                 $payload
     * @return array
     */
    public static function run(WorkflowInstance $instance, WorkflowInstanceSteps $instanceStep, array $payload)
    {
        // Make sure workflow_data is an array we can safely mutate
        $workflowData = is_array($instance->workflow_data) ? $instance->workflow_data : [];

        // 1. Decide where to read the course ID from
        $courseId = null;
        if (!empty($payload['folio_course_id'])) {
            $courseId = trim((string)$payload['folio_course_id']);
        } elseif (!empty($payload['course_id'])) {
            $courseId = trim((string)$payload['course_id']);
        } elseif (!empty($workflowData['requested_course_id'])) {
            $courseId = trim((string)$workflowData['requested_course_id']);
        }

        if (!$courseId) {
            throw new \RuntimeException('MISSING_COURSE_ID');
        }

        // 2. Fetch from FOLIO via your existing service
        $folioService = new FolioService();
        $course       = $folioService->fetchCourseById($courseId);

        if (!$course) {
            throw new \RuntimeException('COURSE_NOT_FOUND');
        }

        // 3. Build summary (using extractIds + term name)
        $ids = $folioService->extractIds($course);

        $courseSummary = [
            'id'           => $ids['course_id'],
            'name'         => $ids['name'],
            'courseNumber' => $ids['course_number'],
            'termId'       => $ids['term_id'],
            'termName'     => $course['courseListingObject']['termObject']['name'] ?? null,
        ];

        // 4. Store result on the instance workflow_data
        $workflowData['folio_course_check'] = [
            'course_id'   => $courseId,
            'verified_at' => date('Y-m-d H:i:s'),
            'verified_by' => 'automation',
            'summary'     => $courseSummary,
        ];

        $instance->workflow_data = $workflowData;
        $instance->save(false);

        // 5. Return a machine-friendly result for history / UI
        return [
            'action'    => 'check_course_exists',
            'exists'    => true,
            'course_id' => $courseId,
            'summary'   => $courseSummary,
        ];
    }
}
