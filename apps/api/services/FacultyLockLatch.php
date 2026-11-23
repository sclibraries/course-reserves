<?php

namespace app\services;

use Yii;

/** Sets the first successful staff-processing timestamp inside the caller's item transaction. */
class FacultyLockLatch
{
    public function set($kind, $itemId, $now)
    {
        $transaction = Yii::$app->db->getTransaction();
        if (!$transaction || !$transaction->isActive) {
            throw new \LogicException('Faculty lock latches require the item write transaction.');
        }

        $table = (new ItemClaimRepository())->table($kind);
        return Yii::$app->db->createCommand()->update($table, [
            'locked_for_faculty_at' => $now,
        ], [
            'and',
            ['id' => (int)$itemId],
            ['locked_for_faculty_at' => null],
        ])->execute();
    }
}
