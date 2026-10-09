<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;
use yii\behaviors\TimestampBehavior;

/**
 * SubmissionMetadata model
 *
 * @property int $metadata_id
 * @property int $submission_id
 * @property int $total_items
 * @property int $total_folders
 * @property int $items_in_folders
 * @property int $ungrouped_items
 * @property string $submitted_by_user_id
 * @property string $submitted_by_username
 * @property string $submitted_by_full_name
 * @property string $submitted_by_email
 * @property string $submitted_by_institution
 * @property string $raw_payload
 * @property string $created_at
 * @property string $updated_at
 */
class SubmissionMetadata extends ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'submission_metadata';
    }

    /**
     * {@inheritdoc}
     */
    public function behaviors()
    {
        return [
            [
                'class' => TimestampBehavior::class,
                'createdAtAttribute' => 'created_at',
                'updatedAtAttribute' => 'updated_at',
                'value' => function() {
                    return date('Y-m-d H:i:s');
                }
            ]
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['submission_id'], 'required'],
            [['submission_id', 'total_items', 'total_folders', 'items_in_folders', 'ungrouped_items'], 'integer'],
            [['raw_payload'], 'string'],
            [['created_at', 'updated_at'], 'safe'],
            [['submitted_by_user_id', 'submitted_by_username', 'submitted_by_full_name', 'submitted_by_email'], 'string', 'max' => 255],
            [['submitted_by_institution'], 'string', 'max' => 10],
            [['total_items', 'total_folders', 'items_in_folders', 'ungrouped_items'], 'default', 'value' => 0],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'metadata_id' => 'Metadata ID',
            'submission_id' => 'Submission ID',
            'total_items' => 'Total Items',
            'total_folders' => 'Total Folders',
            'items_in_folders' => 'Items In Folders',
            'ungrouped_items' => 'Ungrouped Items',
            'submitted_by_user_id' => 'Submitted By User ID',
            'submitted_by_username' => 'Submitted By Username',
            'submitted_by_full_name' => 'Submitted By Full Name',
            'submitted_by_email' => 'Submitted By Email',
            'submitted_by_institution' => 'Submitted By Institution',
            'raw_payload' => 'Raw Payload',
            'created_at' => 'Created At',
            'updated_at' => 'Updated At',
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSubmission()
    {
        return $this->hasOne(FacultySubmission::class, ['submission_id' => 'submission_id']);
    }

    /**
     * Get decoded raw payload
     * @return array|null
     */
    public function getPayload()
    {
        if (empty($this->raw_payload)) {
            return null;
        }
        return json_decode($this->raw_payload, true);
    }

    /**
     * Set raw payload from array
     * @param array $data
     */
    public function setPayload($data)
    {
        $this->raw_payload = json_encode($data);
    }

    /**
     * Get submitted by information as array
     * @return array
     */
    public function getSubmittedByInfo()
    {
        return [
            'id' => $this->submitted_by_user_id,
            'username' => $this->submitted_by_username,
            'fullName' => $this->submitted_by_full_name,
            'email' => $this->submitted_by_email,
            'institution' => $this->submitted_by_institution,
        ];
    }

    /**
     * Get submission statistics
     * @return array
     */
    public function getStats()
    {
        return [
            'totalItems' => $this->total_items,
            'totalFolders' => $this->total_folders,
            'itemsInFolders' => $this->items_in_folders,
            'ungroupedItems' => $this->ungrouped_items,
        ];
    }
}
