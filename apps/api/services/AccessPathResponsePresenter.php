<?php

namespace app\services;

/** Formats access-path routing outcomes for staff endpoints. */
class AccessPathResponsePresenter
{
    public function present($accessPath, $run, array $item, $mapping)
    {
        return [
            'access_path' => $accessPath,
            'flow_id' => $run ? (int)$run['flow_id'] : null,
            'run_id' => $run ? (int)$run['id'] : null,
            'group_id' => $item['assigned_group_id'] === null ? null : (int)$item['assigned_group_id'],
            'warning' => $this->warning($mapping),
        ];
    }

    public function warning($mapping)
    {
        if (!$mapping || $mapping['flow_id'] === null) {
            return 'no_flow_mapped';
        }
        return $mapping['group_id'] === null ? 'no_group_mapped' : null;
    }
}
