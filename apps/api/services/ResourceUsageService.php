<?php

namespace app\services;

use app\models\Resources;
use yii\db\Query;

class ResourceUsageService
{
    /**
     * Return the offering usage counts, or null when the resource does not exist.
     *
     * @param int|string $resourceId
     * @return array|null
     */
    public function forResource($resourceId)
    {
        if (!Resources::find()->where(['resource_id' => $resourceId])->exists()) {
            return null;
        }

        $associations = $this->associations($resourceId);
        $linkedPageCount = (new Query())
            ->select('COUNT(DISTINCT links.offering_id)')
            ->from(['links' => 'offering_links'])
            ->innerJoin(['cr' => 'course_resources'], 'cr.offering_id = links.linked_offering_id')
            ->where(['cr.resource_id' => $resourceId])
            ->scalar();

        return [
            'course_count' => (int)(clone $associations)->select('COUNT(DISTINCT co.course_id)')->scalar(),
            'offering_count' => (int)(clone $associations)->count(),
            'terms' => (clone $associations)
                ->select(['term_id' => 'co.term_id', 'term_name' => 'co.term_name'])
                ->distinct()
                ->orderBy('co.term_id')
                ->all(),
            'linked_page_count' => (int)$linkedPageCount,
        ];
    }

    private function associations($resourceId)
    {
        return (new Query())
            ->from(['cr' => 'course_resources'])
            ->innerJoin(['co' => 'course_offerings'], 'co.offering_id = cr.offering_id')
            ->where(['cr.resource_id' => $resourceId]);
    }
}
