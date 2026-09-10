<?php

namespace app\models;

/**
 * This is the ActiveQuery class for [[Instructors]].
 *
 * @see Instructors
 */
class InstructorsQuery extends \yii\db\ActiveQuery
{
    /*public function active()
    {
        return $this->andWhere('[[status]]=1');
    }*/

    /**
     * {@inheritdoc}
     * @return Instructors[]|array
     */
    public function all($db = null)
    {
        return parent::all($db);
    }

    /**
     * {@inheritdoc}
     * @return Instructors|array|null
     */
    public function one($db = null)
    {
        return parent::one($db);
    }
}
