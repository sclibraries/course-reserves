<?php

namespace app\models;

/**
 * This is the ActiveQuery class for [[CollegeCustomizations]].
 *
 * @see CollegeCustomizations
 */
class CollegeCustomizationsQuery extends \yii\db\ActiveQuery
{
    /*public function active()
    {
        return $this->andWhere('[[status]]=1');
    }*/

    /**
     * {@inheritdoc}
     * @return CollegeCustomizations[]|array
     */
    public function all($db = null)
    {
        return parent::all($db);
    }

    /**
     * {@inheritdoc}
     * @return CollegeCustomizations|array|null
     */
    public function one($db = null)
    {
        return parent::one($db);
    }
}
