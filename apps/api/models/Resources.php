<?php

namespace app\models;

use Yii;
use app\models\Folder; // Import the Folder model

/**
 * This is the model class for table "resources".
 *
 * @property int $resource_id
 * @property string $name             // Title of the resource
 * @property string|null $item_url    // Link to the resource
 * @property string|null $description // Notes for the resource
 * @property int|null $material_type_id
 * @property string $created_at
 *
 * // New fields:
 * @property string|null $internal_note   // Internal (staff-only) note
 * @property string|null $external_note   // External (user-visible) note
 * @property string|null $start_visibility // Date when resource becomes visible (YYYY-MM-DD)
 * @property string|null $end_visibility   // Date when resource stops being visible (YYYY-MM-DD)
 * @property int $use_proxy                // Boolean flag (0 or 1) to indicate whether to attach a proxy URL
 * @property int|null $folder_id           // Reference to a folder grouping the resource
 *
 * @property CourseResources[] $courseResources
 * @property CourseOfferings[] $courseOfferings   // New relation: resource linked to course offerings via course_resources
 * @property Courses[] $courses                   // Courses obtained through course offerings
 * @property MaterialTypes $materialType
 * @property Folder $folder
 */
class Resources extends \yii\db\ActiveRecord
{
    public $material_type_name;
    public $course_count;
    public $order; // Add order property to hold the join table's order value
    
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'resources';
    }

    public function fields()
    {
        $fields = parent::fields();
        $fields[] = 'material_type_name';
        $fields[] = 'course_count';
        $fields[] = 'order'; // Include order in the fields list
        $fields['metadata'] = function ($model) {
            return $model->metadata;
        };
        $fields['links'] = function ($model) {
            return $model->links;
        };
        return \app\services\PublicResourceFields::filterFieldDefinitions($fields, Yii::$app->user->identity);
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['name'], 'required'],
            [['description', 'internal_note', 'external_note'], 'string'],
            [['material_type_id', 'folder_id', 'order', 'use_primary_link_visibility'], 'integer'],
            [['created_at'], 'safe'],
            [['name'], 'string', 'max' => 1025],
            [['item_url'], 'string', 'max' => 512],
            [['material_type_id'], 'exist', 'skipOnError' => true, 'targetClass' => MaterialTypes::class, 'targetAttribute' => ['material_type_id' => 'material_type_id']],
            [['folder_id'], 'exist', 'skipOnError' => true, 'targetClass' => Folder::class, 'targetAttribute' => ['folder_id' => 'folder_id']],
            [['start_visibility', 'end_visibility', 'primary_link_end_visibility', 'primary_link_start_visibility'], 'date', 'format' => 'php:Y-m-d'],
            [['use_proxy'], 'boolean'],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'resource_id'      => 'Resource ID',
            'name'             => 'Title',
            'item_url'         => 'Link',
            'description'      => 'Notes',
            'material_type_id' => 'Material Type ID',
            'created_at'       => 'Created At',
            'internal_note'    => 'Internal Note',
            'external_note'    => 'External Note',
            'start_visibility' => 'Start Visibility',
            'end_visibility'   => 'End Visibility',
            'use_proxy'        => 'Use Proxy',
            'folder_id'        => 'Folder',
            'order'            => 'Order',
        ];
    }

    public $dynamicFields = [];

    public function afterFind()
    {
        parent::afterFind();
        $this->loadDynamicFields();
    }

    public function afterSave($insert, $changedAttributes)
    {
        parent::afterSave($insert, $changedAttributes);
        $sourceFields = [
            'name', 'item_url', 'description', 'material_type_id',
            'start_visibility', 'end_visibility', 'use_proxy',
        ];
        if ($insert || array_intersect($sourceFields, array_keys($changedAttributes))) {
            (new \app\services\SubmissionPublicationInvalidator())->sourceResource($this->resource_id);
        }
    }

    public function afterDelete()
    {
        parent::afterDelete();
        (new \app\services\SubmissionPublicationInvalidator())->sourceResource($this->resource_id);
    }

    private function loadDynamicFields()
    {
        $this->dynamicFields = [];
        $metadata = $this->getResourceMetadata()->all();
        foreach ($metadata as $meta) {
            $this->dynamicFields[$meta->field_name] = $meta->field_value;
        }
    }

    public function getMaterialTypeFields()
    {
        return $this->hasMany(MaterialTypeField::class, ['material_type_id' => 'material_type_id']);
    }

    /**
     * Gets query for [[CourseResources]].
     *
     * @return \yii\db\ActiveQuery|CourseResourcesQuery
     */
    public function getCourseResources()
    {
        return $this->hasMany(CourseResources::class, ['resource_id' => 'resource_id']);
    }

    /**
     * NEW: Gets query for [[CourseOfferings]].
     * This relation links the resource to course offerings via the course_resources table.
     *
     * @return \yii\db\ActiveQuery|CourseOfferingsQuery
     */
    public function getCourseOfferings()
    {
        return $this->hasMany(CourseOfferings::class, ['offering_id' => 'offering_id'])
            ->viaTable('course_resources', ['resource_id' => 'resource_id']);
    }

    /**
     * Updated: Gets query for [[Courses]].
     * Now it retrieves courses through course offerings.
     *
     * @return \yii\db\ActiveQuery|CoursesQuery
     */
    public function getCourses()
    {
        return $this->hasMany(Courses::class, ['course_id' => 'course_id'])
            ->via('courseOfferings');
    }

    /**
     * Gets query for [[MaterialType]].
     *
     * @return \yii\db\ActiveQuery|MaterialTypesQuery
     */
    public function getMaterialType()
    {
        return $this->hasOne(MaterialTypes::class, ['material_type_id' => 'material_type_id']);
    }

    /**
     * Gets query for [[Folder]].
     *
     * @return \yii\db\ActiveQuery
     */
    public function getFolder()
    {
        return $this->hasOne(Folder::class, ['folder_id' => 'folder_id']);
    }

    /**
     * {@inheritdoc}
     * @return ResourcesQuery the active query used by this AR class.
     */
    public static function find()
    {
        return new ResourcesQuery(get_called_class());
    }

    public function getResourceMetadata()
    {
        return $this->hasMany(ResourceMetadata::class, ['resource_id' => 'resource_id']);
    }

    public function getMetadata()
    {
        return $this->hasMany(ResourceMetadata::className(), ['resource_id' => 'resource_id']);
    }

    /**
     * Gets query for [[ResourceLinks]].
     *
     * @return \yii\db\ActiveQuery
     */
    public function getLinks()
    {
        return $this->hasMany(ResourceLinks::class, ['resource_id' => 'resource_id'])
            ->orderBy(['order' => SORT_ASC]);
    }
}
