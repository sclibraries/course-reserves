<?php

namespace app\components;

use app\filters\RoleAccessFilter;
use yii\filters\auth\HttpBearerAuth;

/**
 * Shared bearer authentication and role access behavior configuration.
 */
class ApiAccessBehaviors
{
    /**
     * Add JWT authentication and action-specific role policies to behaviors.
     *
     * @param array $behaviors Existing controller behaviors.
     * @param array $rules Action IDs mapped to allowed roles.
     * @param array $publicActions Actions that do not require a bearer token.
     * @return array
     */
    public static function withRoleRules(array $behaviors, array $rules, array $publicActions = [])
    {
        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            'except' => array_merge(['options'], $publicActions),
        ];
        $behaviors['roleAccess'] = [
            'class' => RoleAccessFilter::class,
            'rules' => $rules,
        ];

        return CorsOriginPolicy::corsFirst($behaviors);
    }
}
