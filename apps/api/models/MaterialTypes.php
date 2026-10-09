<?php

namespace app\models;

use Yii;

/**
 * This is the model class for table "material_types".
 *
 * @property int $material_type_id
 * @property string $name
 * @property string|null $description
 * @property string $created_at
 *
 * @property Resources[] $resources
 */
class MaterialTypes extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'material_types';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['name'], 'required'],
            [['description'], 'string'],
            [['created_at'], 'safe'],
            [['name'], 'string', 'max' => 255],
            [['name'], 'unique'],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'material_type_id' => 'Material Type ID',
            'name' => 'Name',
            'description' => 'Description',
            'created_at' => 'Created At',
        ];
    }

    /**
     * Gets query for [[Resources]].
     *
     * @return \yii\db\ActiveQuery|ResourcesQuery
     */
    public function getResources()
    {
        return $this->hasMany(Resources::class, ['material_type_id' => 'material_type_id']);
    }

    /**
     * {@inheritdoc}
     * @return MaterialTypesQuery the active query used by this AR class.
     */
    public static function find()
    {
        return new MaterialTypesQuery(get_called_class());
    }
}
