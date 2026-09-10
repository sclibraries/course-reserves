<?php

namespace app\models;

use Yii;

/**
 * This is the model class for table "college_customizations".
 *
 * @property string $college_code
 * @property string|null $logo_url
 * @property string|null $header_bg_color
 * @property string|null $body_bg_color
 * @property string|null $button_primary_color
 * @property string|null $button_secondary_color
 * @property string|null $card_bg_color
 * @property string|null $card_text_color
 * @property string|null $discover_link
 * @property string|null $moodle_link
 * @property string|null $copyright_link
 * @property string|null $electronic_reserves_text
 * @property string|null $print_reserves_text
 */
class CollegeCustomization extends \yii\db\ActiveRecord
{
    public static function tableName()
    {
        return 'college_customizations';
    }

    public function rules()
    {
        return [
            [['campus_location', 'logo_url', 'alt_text'], 'required'],
            [['additional_header_text'], 'safe'],
            [['logo_url', 'records_discover_link_base_url', 'moodle_link'], 'string', 'max' => 1000],
            [['campus_location'], 'string', 'max' => 50],
            [['header_bg_color', 'search_button_bg_color'], 'string', 'max' => 20],
        ];
    }
}