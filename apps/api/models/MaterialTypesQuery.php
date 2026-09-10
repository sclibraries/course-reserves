<?php

namespace app\models;

/**
 * This is the ActiveQuery class for [[MaterialTypes]].
 *
 * @see MaterialTypes
 */
class MaterialTypesQuery extends \yii\db\ActiveQuery
{
    /*public function active()
    {
        return $this->andWhere('[[status]]=1');
    }*/

    /**
     * {@inheritdoc}
     * @return MaterialTypes[]|array
     */
    public function all($db = null)
    {
        return parent::all($db);
    }

    /**
     * {@inheritdoc}
     * @return MaterialTypes|array|null
     */
    public function one($db = null)
    {
        return parent::one($db);
    }
}
