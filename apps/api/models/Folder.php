<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * This is the model class for table "folders".
 *
 * @property int $folder_id
 * @property string $name
 * @property string|null $description
 * @property string $created_at
 * @property string $updated_at
 *
 * @property Resources[] $resources
 */
class Folder extends ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return '{{%folders}}';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['name'], 'required'],
            [['description'], 'string'],
            [['created_at', 'updated_at'], 'safe'],
            [['name'], 'string', 'max' => 255],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'folder_id'   => 'Folder ID',
            'name'        => 'Folder Name',
            'description' => 'Description',
            'created_at'  => 'Created At',
            'updated_at'  => 'Updated At',
        ];
    }

    /**
     * Gets query for [[Resources]].
     *
     * @return \yii\db\ActiveQuery
     */
    public function getResources()
    {
        return $this->hasMany(Resources::class, ['folder_id' => 'folder_id']);
    }
}
