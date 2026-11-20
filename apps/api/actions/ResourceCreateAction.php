<?php

namespace app\actions;

use app\services\Transactional;
use yii\rest\CreateAction;

/** Yii's create action as one retrying owner, so a hook that hits contention re-creates the model whole. */
class ResourceCreateAction extends CreateAction
{
    public function run()
    {
        return Transactional::retrying(function () {
            return parent::run();
        });
    }
}
