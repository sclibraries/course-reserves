<?php
namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * This is the model class for table "tracking_events".
 *
 * @property int $id
 * @property string $college
 * @property string $event_type
 * @property string $course_id
 * @property string $term
 * @property string|null $course_name
 * @property string|null $course_code
 * @property string|null $instructor JSON encoded string, e.g. '[{"name": "Dr. Smith"}, {"name": "Prof. Jones"}]'
 * @property string|null $metadata JSON encoded string for additional info
 * @property string $created_at
 */
class TrackingEvent extends ActiveRecord
{
    const EVENT_TYPES = [
        'search',
        'search_reset',
        'term_change',
        'search_mode_change',
        'college_change',
        'department_change',
        'course_access',
        'instructor_search',
        'course_access_from_item_search',
        'view_mode_change',
        'filter_change',
        'switched_to_card_view',
        'switched_to_table_view',
        'resource_click',
        'resource_link_click',
        'record_discover_link',
    ];

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'tracking_events';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['college', 'event_type', 'course_id', 'term'], 'required'],
            [['college', 'event_type', 'course_id', 'term'], 'string', 'max' => 50],
            [['event_type'], 'in', 'range' => self::EVENT_TYPES],
            [['course_name', 'course_code'], 'string', 'max' => 255],
            [['instructor', 'metadata'], 'safe'],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id'           => 'ID',
            'college'      => 'College',
            'event_type'   => 'Event Type',
            'course_id'    => 'Course ID',
            'term'         => 'Term',
            'course_name'  => 'Course Name',
            'course_code'  => 'Course Code',
            'instructor'   => 'Instructor',
            'metadata'     => 'Metadata',
            'created_at'   => 'Created At',
        ];
    }

    /**
     * Convert array attributes to JSON strings before saving.
     *
     * @param bool $insert whether this is a new record being inserted.
     * @return bool whether the record should be saved.
     */
    public function beforeSave($insert)
    {
        if (parent::beforeSave($insert)) {
            if (is_array($this->instructor)) {
                $this->instructor = json_encode($this->instructor);
            }
            if (is_array($this->metadata)) {
                $this->metadata = json_encode($this->metadata);
            }
            return true;
        }
        return false;
    }
}
