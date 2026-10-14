<?php

namespace app\filters;

use Yii;
use yii\base\ActionFilter;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

/**
 * Enforces action-specific role rules and development-only actions.
 */
class RoleAccessFilter extends ActionFilter
{
    /** @var array Action IDs mapped to allowed roles. */
    public $rules = [];

    /** @var array Action IDs available only in development. */
    public $devOnlyActions = [];

    /**
     * Check action policy after authentication filters run.
     *
     * @param  \yii\base\Action $action Action being executed.
     * @return bool Whether the action should continue.
     */
    public function beforeAction($action)
    {
        if ($action->id === 'options' || Yii::$app->request->method === 'OPTIONS') {
            return true;
        }

        if (in_array($action->id, $this->devOnlyActions, true) && !$this->isDevelopmentEnvironment()) {
            throw new NotFoundHttpException('Page not found.');
        }

        if (!isset($this->rules[$action->id])) {
            return true;
        }

        $identity = Yii::$app->user->identity;
        if (!in_array($identity->role ?? null, $this->rules[$action->id], true)) {
            throw new ForbiddenHttpException('This action is not available for your role.');
        }

        return true;
    }

    /**
     * Check whether Yii is running in development mode.
     *
     * @return bool
     */
    protected function isDevelopmentEnvironment()
    {
        return defined('YII_ENV_DEV') && YII_ENV_DEV;
    }
}
