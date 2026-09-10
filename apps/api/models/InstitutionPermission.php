<?php
namespace app\models;

use Yii;
use yii\db\ActiveRecord;

class InstitutionPermission extends ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'institution_permissions';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['institution', 'permission_key'], 'required'],
            [['granted'], 'boolean'],
            [['created_by'], 'integer'],
            [['created_at', 'updated_at'], 'safe'],
            [['institution', 'permission_key'], 'string', 'max' => 255],
            [['institution', 'permission_key'], 'unique', 'targetAttribute' => ['institution', 'permission_key']],
        ];
    }

    /**
     * Check if a permission is granted for an institution
     * 
     * @param string $institution The institution to check
     * @param string $permission The permission key to check
     * @return bool Whether the permission is granted
     */
    public static function isGranted($institution, $permission)
    {
        // Convert full institution name to domain format
        $domainMap = [
            'Smith College' => 'smith.edu',
            'Hampshire College' => 'hampshire.edu',
            'Amherst College' => 'amherst.edu',
            'Mount Holyoke College' => 'mtholyoke.edu',
            'UMass Amherst' => 'umass.edu',
        ];
        
        // If institution is in the map, convert it to domain format
        if (isset($domainMap[$institution])) {
            $institution = $domainMap[$institution];
        }
        
        $record = self::find()
            ->where(['institution' => $institution, 'permission_key' => $permission])
            ->one();
            
        return $record && $record->granted;
    }
    
    /**
     * Get all permissions for an institution
     * 
     * @param string $institution The institution to get permissions for
     * @return array Array of permission keys that are granted
     */
    public static function getInstitutionPermissions($institution)
    {
        // Convert full institution name to domain format
        $domainMap = [
            'Smith College' => 'smith.edu',
            'Hampshire College' => 'hampshire.edu',
            'Amherst College' => 'amherst.edu',
            'Mount Holyoke College' => 'mtholyoke.edu',
            'UMass Amherst' => 'umass.edu',
        ];
        
        // If institution is in the map, convert it to domain format
        if (isset($domainMap[$institution])) {
            $institution = $domainMap[$institution];
        }
        
        try {
            return self::find()
                ->select(['permission_key'])
                ->where(['institution' => $institution, 'granted' => 1])
                ->column();
        } catch (\Exception $e) {
            Yii::error('Error fetching institution permissions: ' . $e->getMessage());
            return [];
        }
    }
}