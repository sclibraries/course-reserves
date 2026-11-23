<?php

namespace app\services;

use Yii;

/** Shares the business-error envelope used by history-review operations. */
trait ItemHistoryReviewFailure
{
    private function failure($status, $code)
    {
        $reference = FailureReference::generate();
        Yii::warning('Item history review ' . $code . ' reference=' . $reference, __METHOD__);
        return $this->result($status, [
            'error_code' => $code,
            'message' => 'The item history review could not be completed.',
            'reference' => $reference,
        ]);
    }
}
