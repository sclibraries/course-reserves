<?php

namespace app\models;

/**
 * This is the ActiveQuery class for [[SpringshareCourses]].
 *
 * @see SpringshareCourses
 */
class SpringshareCoursesQuery extends \yii\db\ActiveQuery
{
    /*public function active()
    {
        return $this->andWhere('[[status]]=1');
    }*/

    /**
     * {@inheritdoc}
     * @return SpringshareCourses[]|array
     */
    public function all($db = null)
    {
        return parent::all($db);
    }

    /**
     * {@inheritdoc}
     * @return SpringshareCourses|array|null
     */
    public function one($db = null)
    {
        return parent::one($db);
    }
}
