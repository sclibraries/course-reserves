<?php

namespace app\services;

use Yii;

class WorkflowNotificationQueue
{
    private $notifications = [];

    public function enqueue(callable $notification)
    {
        $this->notifications[] = $notification;
    }

    public function flushAfterCommit()
    {
        $notifications = $this->notifications;
        $this->discard();

        foreach ($notifications as $notification) {
            try {
                call_user_func($notification);
            } catch (\Throwable $exception) {
                $reference = EbscoFailureReference::generate();
                Yii::error(
                    'Workflow notification failed reference=' . $reference . ' exception=' . get_class($exception),
                    __METHOD__
                );
            }
        }
    }

    public function discard()
    {
        $this->notifications = [];
    }
}
