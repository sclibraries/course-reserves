<?php

use app\services\FacultyLockLatchBackfill;
use app\services\ItemHistoryReviewBackfill;
use yii\db\Migration;

/**
 * Flags unlatched submitted items while the API is stopped. Down/up drops review decisions and flags a new cohort.
 */
class m261123_000001_create_item_history_review extends Migration
{
    public function safeUp()
    {
        $timestamp = date('Y-m-d H:i:s');
        $this->execute(
            "CREATE TABLE IF NOT EXISTS `item_history_review` (
                `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
                `item_id` BIGINT(20) UNSIGNED NOT NULL,
                `submission_id` BIGINT(20) UNSIGNED NOT NULL,
                `trace` VARCHAR(64) NOT NULL,
                `flagged_at` DATETIME NOT NULL,
                `reviewed_at` DATETIME NULL,
                `reviewed_by_staff_id` VARCHAR(255) NULL,
                `decision` ENUM('finished','not_finished') NULL,
                `reason` TEXT NULL,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uq_item_history_review_item_id` (`item_id`),
                KEY `idx_item_history_review_open` (`reviewed_at`,`id`),
                KEY `idx_item_history_review_submission_open` (`submission_id`,`reviewed_at`),
                CONSTRAINT `fk_item_history_review_item` FOREIGN KEY (`item_id`)
                    REFERENCES `submission_new_resources` (`id`) ON DELETE CASCADE,
                CONSTRAINT `fk_item_history_review_submission` FOREIGN KEY (`submission_id`)
                    REFERENCES `faculty_submissions` (`submission_id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );

        (new FacultyLockLatchBackfill($this->db))->backfill($timestamp);
        (new ItemHistoryReviewBackfill($this->db))->backfill($timestamp);
    }

    public function safeDown()
    {
        $this->execute('DROP TABLE IF EXISTS `item_history_review`');
    }
}
