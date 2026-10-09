<?php

namespace app\models;

/**
 * This is the ActiveQuery class for [[Resources]].
 *
 * @see Resources
 */
class ResourcesQuery extends \yii\db\ActiveQuery
{
    /*public function active()
    {
        return $this->andWhere('[[status]]=1');
    }*/

    /**
     * {@inheritdoc}
     * @return Resources[]|array
     */
    public function all($db = null)
    {
        return parent::all($db);
    }

    /**
     * {@inheritdoc}
     * @return Resources|array|null
     */
    public function one($db = null)
    {
        return parent::one($db);
    }
}
