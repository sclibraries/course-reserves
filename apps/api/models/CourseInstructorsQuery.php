<?php

namespace app\models;

/**
 * This is the ActiveQuery class for [[CourseInstructors]].
 *
 * @see CourseInstructors
 */
class CourseInstructorsQuery extends \yii\db\ActiveQuery
{
    /*public function active()
    {
        return $this->andWhere('[[status]]=1');
    }*/

    /**
     * {@inheritdoc}
     * @return CourseInstructors[]|array
     */
    public function all($db = null)
    {
        return parent::all($db);
    }

    /**
     * {@inheritdoc}
     * @return CourseInstructors|array|null
     */
    public function one($db = null)
    {
        return parent::one($db);
    }
}
