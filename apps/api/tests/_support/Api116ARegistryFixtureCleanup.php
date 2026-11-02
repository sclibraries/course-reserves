<?php

/** Removes registry rows that point at synthetic fixture entries. */
class Api116ARegistryFixtureCleanup
{
    public static function deleteForPointers(array $courseResourceIds, array $physicalReferenceIds)
    {
        $db = \Yii::$app->db;
        if (!$db->schema->getTableSchema('publication_destinations', true)
            || !$db->schema->getTableSchema('publication_attachments', true)) {
            return;
        }

        $conditions = [];
        if ($courseResourceIds) {
            $conditions[] = ['course_resource_id' => array_map('intval', $courseResourceIds)];
        }
        if ($physicalReferenceIds) {
            $conditions[] = ['physical_reference_id' => array_map('intval', $physicalReferenceIds)];
        }
        if (!$conditions) {
            return;
        }

        $ids = (new \yii\db\Query())->select('id')->from('publication_destinations')
            ->where(array_merge(['or'], $conditions))->column();
        if ($ids) {
            $db->createCommand()->delete('publication_attachments', ['destination_id' => $ids])->execute();
            $db->createCommand()->delete('publication_destinations', ['id' => $ids])->execute();
        }
    }
}
