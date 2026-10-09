<?php

namespace app\models;

/**
 * This is the ActiveQuery class for [[SpringshareCourseItems]].
 *
 * @see SpringshareCourseItems
 */
class SpringshareCourseItemsQuery extends \yii\db\ActiveQuery
{
    /*public function active()
    {
        return $this->andWhere('[[status]]=1');
    }*/

    /**
     * {@inheritdoc}
     * @return SpringshareCourseItems[]|array
     */
    public function all($db = null)
    {
        return parent::all($db);
    }

    /**
     * {@inheritdoc}
     * @return SpringshareCourseItems|array|null
     */
    public function one($db = null)
    {
        return parent::one($db);
    }
}
