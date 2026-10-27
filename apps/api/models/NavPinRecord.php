<?php

namespace app\models;

use yii\db\ActiveRecord;

/** Stores navigation pins as JSON in a TEXT column. */
abstract class NavPinRecord extends ActiveRecord
{
    public function rules()
    {
        return [[['pins'], 'safe']];
    }

    public function afterFind()
    {
        parent::afterFind();
        $decoded = json_decode($this->pins, true);
        $this->pins = is_array($decoded) ? $decoded : [];
    }

    public function beforeSave($insert)
    {
        if (!parent::beforeSave($insert)) {
            return false;
        }
        if (is_array($this->pins)) {
            $this->pins = json_encode($this->pins);
        }
        return true;
    }
}
