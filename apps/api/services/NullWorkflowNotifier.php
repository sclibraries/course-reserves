<?php

namespace app\services;

/** Default no-op until the API-045 notification outbox is implemented. */
class NullWorkflowNotifier implements WorkflowNotifier
{
    public function notify($eventType, array $context)
    {
        // TODO(API-045): enqueue the notification event after the workflow transaction commits.
    }
}
