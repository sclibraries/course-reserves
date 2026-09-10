<?php

namespace app\models;

/**
 * This is the ActiveQuery class for [[CourseResources]].
 *
 * @see CourseResources
 */
class CourseResourcesQuery extends \yii\db\ActiveQuery
{
    /*public function active()
    {
        return $this->andWhere('[[status]]=1');
    }*/

    /**
     * {@inheritdoc}
     * @return CourseResources[]|array
     */
    public function all($db = null)
    {
        return parent::all($db);
    }

    /**
     * {@inheritdoc}
     * @return CourseResources|array|null
     */
    public function one($db = null)
    {
        return parent::one($db);
    }
}
