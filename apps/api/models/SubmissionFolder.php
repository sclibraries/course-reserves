<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * SubmissionFolder model
 *
 * @property int $folder_id
 * @property int $submission_id
 * @property string $folder_name
 * @property int $display_order
 * @property int $course_folder_id
 * @property string $created_at
 */
class SubmissionFolder extends ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'submission_folders';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['submission_id', 'folder_name'], 'required'],
            [['submission_id', 'display_order', 'course_folder_id'], 'integer'],
            [['created_at'], 'safe'],
            [['folder_name'], 'string', 'max' => 255],
            [['display_order'], 'default', 'value' => 999],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'folder_id' => 'Folder ID',
            'submission_id' => 'Submission ID',
            'folder_name' => 'Folder Name',
            'display_order' => 'Display Order',
            'course_folder_id' => 'Course Folder ID',
            'created_at' => 'Created At',
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSubmission()
    {
        return $this->hasOne(FacultySubmission::class, ['submission_id' => 'submission_id']);
    }

    public function getCourseFolder()
    {
        return $this->hasOne(Folder::class, ['folder_id' => 'course_folder_id']);
    }

    /**
     * Get all items in this folder (reuse + new)
     * @return array
     */
    public function getItems()
    {
        $reuseItems = SubmissionReuseResource::find()
            ->where([
                'submission_id' => $this->submission_id,
                'folder_name' => $this->folder_name
            ])
            ->orderBy(['display_order' => SORT_ASC])
            ->all();

        $newItems = SubmissionNewResource::find()
            ->where([
                'submission_id' => $this->submission_id,
                'folder_name' => $this->folder_name
            ])
            ->orderBy(['display_order' => SORT_ASC])
            ->all();

        $allItems = [];
        
        foreach ($reuseItems as $item) {
            $allItems[] = [
                'type' => 'reuse',
                'id' => $item->id,
                'data' => $item,
                'order' => $item->display_order
            ];
        }
        
        foreach ($newItems as $item) {
            $allItems[] = [
                'type' => 'new',
                'id' => $item->id,
                'data' => $item,
                'order' => $item->display_order
            ];
        }
        
        // Sort by display order
        usort($allItems, function($a, $b) {
            return $a['order'] - $b['order'];
        });
        
        return $allItems;
    }

    /**
     * Count items in this folder
     * @return int
     */
    public function getItemCount()
    {
        $reuseCount = SubmissionReuseResource::find()
            ->where([
                'submission_id' => $this->submission_id,
                'folder_name' => $this->folder_name
            ])
            ->count();

        $newCount = SubmissionNewResource::find()
            ->where([
                'submission_id' => $this->submission_id,
                'folder_name' => $this->folder_name
            ])
            ->count();

        return $reuseCount + $newCount;
    }
}
