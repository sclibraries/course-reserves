<?php

namespace app\services;

/** Checks folder names without depending on persistence. */
class FolderNames
{
    public static function clash(array $names, array $reservedOrphanNames = [])
    {
        $reserved = [];
        foreach ($reservedOrphanNames as $name) {
            $reserved[mb_strtolower(trim($name), 'UTF-8')] = true;
        }

        $seen = [];
        foreach ($names as $name) {
            $key = mb_strtolower(trim($name), 'UTF-8');
            if ($key === '') {
                continue;
            }
            if (isset($reserved[$key])) {
                return ['folder_name' => $name, 'reason' => 'orphan_name'];
            }
            if (isset($seen[$key])) {
                return ['folder_name' => $name, 'reason' => 'duplicate'];
            }
            $seen[$key] = true;
        }
        return null;
    }
}
