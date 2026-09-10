<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;
use yii\db\Expression;

/**
 * This is the model class for table "offering_links".
 *
 * @property int $offering_link_id
 * @property int $offering_id
 * @property int $linked_offering_id
 * @property string $created_at
 *
 * @property CourseOfferings $offering
 * @property CourseOfferings $linkedOffering
 */
class OfferingLink extends ActiveRecord
{
    public function behaviors()
    {
        return [
            'timestamp' => [
                'class' => \yii\behaviors\TimestampBehavior::class,
                'createdAtAttribute' => 'created_at',
                'updatedAtAttribute' => null,
                'value' => new Expression('NOW()'),
            ],
        ];
    }

    public static function tableName()
    {
        return 'offering_links';
    }

    public function rules()
    {
        return [
            [['offering_id', 'linked_offering_id'], 'required'],
            [['offering_id', 'linked_offering_id'], 'integer'],
            [['offering_id'], 'exist', 'skipOnError' => true, 
                'targetClass' => CourseOfferings::class, 'targetAttribute' => ['offering_id' => 'offering_id']],
            [['linked_offering_id'], 'exist', 'skipOnError' => true, 
                'targetClass' => CourseOfferings::class, 'targetAttribute' => ['linked_offering_id' => 'offering_id']],
            ['linked_offering_id', 'compare', 'compareAttribute' => 'offering_id', 'operator' => '!='],
            [['offering_id', 'linked_offering_id'], 'unique', 'targetAttribute' => ['offering_id', 'linked_offering_id'], 
                'message' => 'This link already exists.'],
        ];
    }

    public function afterSave($insert, $changedAttributes)
    {
        parent::afterSave($insert, $changedAttributes);
        
        // Create reverse link if it doesn't exist
        if ($insert) {
            $reverseLink = new self([
                'offering_id' => $this->linked_offering_id,
                'linked_offering_id' => $this->offering_id,
            ]);
            
            if (!$reverseLink->exists()) {
                $reverseLink->save();
            }
        }
    }

    public function afterDelete()
    {
        parent::afterDelete();
        
        // Delete reverse link
        self::deleteAll([
            'offering_id' => $this->linked_offering_id,
            'linked_offering_id' => $this->offering_id,
        ]);
    }

    public function exists()
    {
        return self::find()
            ->where([
                'offering_id' => $this->offering_id,
                'linked_offering_id' => $this->linked_offering_id,
            ])
            ->exists();
    }

    public function getOffering()
    {
        return $this->hasOne(CourseOfferings::class, ['offering_id' => 'offering_id']);
    }

    public function getLinkedOffering()
    {
        return $this->hasOne(CourseOfferings::class, ['offering_id' => 'linked_offering_id']);
    }
}