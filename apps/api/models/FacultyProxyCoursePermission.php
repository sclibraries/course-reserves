<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * FacultyProxyCoursePermission model
 *
 * @property int $id
 * @property int $permission_id
 * @property string $folio_course_listing_id
 * @property string $course_title
 * @property string $term_id
 * @property string $created_at
 */
class FacultyProxyCoursePermission extends ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'faculty_proxy_course_permissions';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['permission_id', 'folio_course_listing_id'], 'required'],
            [['permission_id'], 'integer'],
            [['created_at'], 'safe'],
            [['folio_course_listing_id', 'term_id'], 'string', 'max' => 255],
            [['course_title'], 'string', 'max' => 500],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => 'ID',
            'permission_id' => 'Permission ID',
            'folio_course_listing_id' => 'FOLIO Course Listing ID',
            'course_title' => 'Course Title',
            'term_id' => 'Term ID',
            'created_at' => 'Created At',
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getPermission()
    {
        return $this->hasOne(FacultyProxyPermission::class, ['permission_id' => 'permission_id']);
    }
}
