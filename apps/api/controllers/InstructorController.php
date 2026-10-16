<?php

namespace app\controllers;

use app\components\ApiAccessBehaviors;
use app\components\Roles;
use yii\rest\ActiveController;

class InstructorController extends ActiveController
{
    public $modelClass = 'app\models\Instructors';

    public function behaviors()
    {
        return ApiAccessBehaviors::withRoleRules(parent::behaviors(), [
            'index' => Roles::STAFF,
            'view' => Roles::STAFF,
            'create' => Roles::STAFF,
            'update' => Roles::STAFF,
            'delete' => Roles::STAFF,
        ]);
    }
}
