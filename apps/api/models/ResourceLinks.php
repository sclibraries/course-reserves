<?php
// filepath: models/ResourceLinks.php
namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * ResourceLinks model
 *
 * @property int $link_id
 * @property int $resource_id
 * @property string $url
 * @property string|null $title
 * @property string|null $description
 * @property int $use_proxy
 * @property int|null $order
 * @property string $created_at
 *
 * @property Resources $resource
 */
class ResourceLinks extends ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'resource_links';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['resource_id', 'url'], 'required'],
            [['resource_id', 'use_proxy', 'order', 'use_link_visibility'], 'integer'],
            [['description'], 'string'],
            [['created_at','start_visibility', 'end_visibility'], 'safe'],
            [['url'], 'string', 'max' => 2048],
            [['title'], 'string', 'max' => 255],
            [['resource_id'], 'exist', 'skipOnError' => true, 'targetClass' => Resources::class, 'targetAttribute' => ['resource_id' => 'resource_id']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'link_id' => 'Link ID',
            'resource_id' => 'Resource ID',
            'url' => 'URL',
            'title' => 'Title',
            'description' => 'Description',
            'use_proxy' => 'Use Proxy',
            'order' => 'Order',
            'created_at' => 'Created At',
        ];
    }

    /**
     * Gets query for [[Resource]].
     *
     * @return \yii\db\ActiveQuery
     */
    public function getResource()
    {
        return $this->hasOne(Resources::class, ['resource_id' => 'resource_id']);
    }
}