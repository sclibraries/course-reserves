<?php

namespace app\services;

/** Hook for workflow notifications; delivery is owned by API-045. */
interface WorkflowNotifier
{
    public function notify($eventType, array $context);
}
