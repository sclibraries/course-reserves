<?php

namespace app\services;

use Yii;

/** Finds or creates the built-in Print book flow and its optional book mapping. */
class PrintBookFlowMapping
{
    const FLOW_NAME = 'Print book';
    const SEEDED_MATERIAL_TYPE_DESCRIPTION = 'Synthetic material type created by dev-seed/test-courses for the Print book flow.';

    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?: Yii::$app->db;
    }

    public function findOrCreate($createMaterialType = false)
    {
        $flow = $this->findFlow();
        if (!$flow) {
            $this->db->createCommand()->insert('flows', [
                'name' => self::FLOW_NAME,
                'description' => 'Process a physical book for course reserve.',
                'created_by' => 'system',
            ])->execute();
            $flowId = (int)$this->db->getLastInsertID();
        } else {
            $flowId = (int)$flow['id'];
        }
        $this->ensureFirstVersion($flowId);

        $materialType = $this->findBookMaterialType();
        $createdMaterialType = false;
        if (!$materialType && $createMaterialType) {
            $this->db->createCommand()->insert('material_types', [
                'name' => 'book',
                'description' => self::SEEDED_MATERIAL_TYPE_DESCRIPTION,
            ])->execute();
            $materialType = [
                'material_type_id' => (int)$this->db->getLastInsertID(),
                'name' => 'book',
                'description' => self::SEEDED_MATERIAL_TYPE_DESCRIPTION,
            ];
            $createdMaterialType = true;
        }

        $mappingCreated = false;
        $mappedFlowId = null;
        if ($materialType) {
            $mapping = $this->db->createCommand(
                'SELECT flow_id FROM material_type_flows WHERE material_type_id = :type_id LIMIT 1',
                [':type_id' => (int)$materialType['material_type_id']]
            )->queryOne();
            if (!$mapping) {
                $this->db->createCommand()->insert('material_type_flows', [
                    'material_type_id' => (int)$materialType['material_type_id'],
                    'flow_id' => $flowId,
                ])->execute();
                $mappingCreated = true;
                $mappedFlowId = $flowId;
            } elseif ($mapping['flow_id'] === null) {
                $this->db->createCommand()->update('material_type_flows', ['flow_id' => $flowId], [
                    'material_type_id' => (int)$materialType['material_type_id'],
                ])->execute();
                $mappingCreated = true;
                $mappedFlowId = $flowId;
            } else {
                $mappedFlowId = (int)$mapping['flow_id'];
            }
        }

        return [
            'flow_id' => $flowId,
            'material_type_id' => $materialType ? (int)$materialType['material_type_id'] : null,
            'material_type_created' => $createdMaterialType,
            'mapping_created' => $mappingCreated,
            'mapped' => $materialType && $mappedFlowId === $flowId,
        ];
    }

    public function resetSeededMaterialType()
    {
        $materialType = $this->db->createCommand(
            'SELECT material_type_id FROM material_types WHERE LOWER(name) = :name AND description = :description LIMIT 1',
            [':name' => 'book', ':description' => self::SEEDED_MATERIAL_TYPE_DESCRIPTION]
        )->queryOne();
        if (!$materialType) {
            return false;
        }

        $inUse = $this->db->createCommand(
            'SELECT 1 FROM resources WHERE material_type_id = :type_id LIMIT 1',
            [':type_id' => (int)$materialType['material_type_id']]
        )->queryScalar();
        if ($inUse) {
            return false;
        }

        $this->db->createCommand()->delete('material_types', [
            'material_type_id' => (int)$materialType['material_type_id'],
        ])->execute();
        return true;
    }

    private function findFlow()
    {
        return $this->db->createCommand(
            'SELECT id FROM flows WHERE name = :name LIMIT 1', [':name' => self::FLOW_NAME]
        )->queryOne();
    }

    private function findBookMaterialType()
    {
        return $this->db->createCommand(
            'SELECT material_type_id, name, description FROM material_types WHERE LOWER(name) = :name '
            . "ORDER BY CASE WHEN BINARY name = 'book' THEN 0 ELSE 1 END, material_type_id ASC LIMIT 1",
            [':name' => 'book']
        )->queryOne();
    }

    private function ensureFirstVersion($flowId)
    {
        $version = $this->db->createCommand(
            'SELECT version FROM flow_versions WHERE flow_id = :flow_id AND version = 1 LIMIT 1',
            [':flow_id' => $flowId]
        )->queryScalar();
        if ($version !== false) {
            return;
        }

        $this->db->createCommand()->insert('flow_versions', [
            'flow_id' => $flowId,
            'version' => 1,
            'steps_json' => json_encode($this->printBookSteps(), JSON_UNESCAPED_SLASHES),
            'created_by' => 'system',
        ])->execute();
    }

    private function printBookSteps()
    {
        return [
            ['key' => 'own_it', 'kind' => 'question', 'label' => 'Do we own it?', 'help_text' => null, 'outcomes' => [
                $this->outcome('yes', 'Yes', ['step' => 'available']),
                $this->outcome('no', 'No', ['handoff_group' => 'Acquisitions']),
                $this->outcome('cannot_get', "We can't get this", ['finish' => 'unavailable']),
            ]],
            ['key' => 'available', 'kind' => 'question', 'label' => 'Is it available?', 'help_text' => null, 'outcomes' => [
                $this->outcome('available', 'Available', ['step' => 'pull']),
                $this->outcome('checked_out', 'Checked out', ['step' => 'recall']),
                $this->outcome('lost', 'Lost', ['handoff_group' => 'Acquisitions']),
                $this->outcome('cannot_get', "We can't get this", ['finish' => 'unavailable']),
            ]],
            $this->action('recall', 'Recall it', ['step' => 'available']),
            $this->action('pull', 'Pull it from the shelf', ['step' => 'folio_reserve']),
            $this->action('folio_reserve', 'Change its location to on reserve and attach it to the course in FOLIO', ['step' => 'confirm']),
            [
                'key' => 'confirm', 'kind' => 'confirm_on_reserve', 'label' => 'Confirm on reserve in FOLIO',
                'help_text' => null, 'outcomes' => [$this->outcome('done', 'Done', ['finish' => 'on_reserve'])],
            ],
            $this->finish('on_reserve', 'On reserve', 'on_reserve', false),
            $this->finish('unavailable', 'Unavailable', 'unavailable', true),
        ];
    }

    private function action($key, $label, array $next)
    {
        return [
            'key' => $key, 'kind' => 'action', 'label' => $label, 'help_text' => null,
            'outcomes' => [$this->outcome('done', 'Done', $next)],
        ];
    }

    private function finish($key, $label, $state, $reasonRequired)
    {
        return [
            'key' => $key, 'kind' => 'finish', 'label' => $label, 'help_text' => null,
            'finish_state' => $state, 'reason_required' => $reasonRequired, 'outcomes' => [],
        ];
    }

    private function outcome($key, $label, array $next)
    {
        return ['key' => $key, 'label' => $label, 'next' => $next, 'reason_required' => false];
    }
}
