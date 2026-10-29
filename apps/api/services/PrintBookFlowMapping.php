<?php

namespace app\services;

/** Finds or creates the built-in Print book flow and its optional book mapping. */
class PrintBookFlowMapping
{
    const FLOW_NAME = 'Print book';
    const SEEDED_MATERIAL_TYPE_DESCRIPTION = 'Synthetic material type created by dev-seed/test-courses for the Print book flow.';

    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?: \Yii::$app->db;
    }

    public function findOrCreate($createMaterialType = false)
    {
        return (new BuiltInFlowMapping($this->db))->findOrCreate(
            self::FLOW_NAME,
            'Process a physical book for course reserve.',
            $this->printBookSteps(),
            'book',
            $createMaterialType,
            self::SEEDED_MATERIAL_TYPE_DESCRIPTION
        );
    }

    public function resetSeededMaterialType()
    {
        return (new BuiltInFlowMapping($this->db))->resetSeededMaterialType(
            'book', self::SEEDED_MATERIAL_TYPE_DESCRIPTION
        );
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
