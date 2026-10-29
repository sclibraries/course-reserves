<?php

namespace app\services;

/** Finds or installs the preparation-only Ebook flow and its material type mapping. */
class EbookFlowMapping
{
    const FLOW_NAME = 'Ebook';
    const MATERIAL_TYPE_DESCRIPTION = 'Electronic books accessed online for course reserves.';
    const SEEDED_MATERIAL_TYPE_DESCRIPTION = 'Synthetic material type created by dev-seed/test-courses for the Ebook flow.';
    const FLOW_DESCRIPTION = 'Prepare an electronic book for course reserve publication.';

    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?: \Yii::$app->db;
    }

    public function findOrCreate($createMaterialType = false, $createdBy = 'system')
    {
        $materialTypeDescription = $createdBy === 'dev-seed'
            ? self::SEEDED_MATERIAL_TYPE_DESCRIPTION
            : self::MATERIAL_TYPE_DESCRIPTION;
        return (new BuiltInFlowMapping($this->db))->findOrCreate(
            self::FLOW_NAME,
            self::FLOW_DESCRIPTION,
            $this->ebookSteps(),
            'ebook',
            $createMaterialType,
            $materialTypeDescription,
            $createdBy
        );
    }

    public function resetSeededMaterialType()
    {
        return (new BuiltInFlowMapping($this->db))->resetSeededMaterialType(
            'ebook', self::SEEDED_MATERIAL_TYPE_DESCRIPTION
        );
    }

    public function defaultSteps()
    {
        return $this->ebookSteps();
    }

    private function ebookSteps()
    {
        return [
            ['key' => 'own_it', 'kind' => 'question', 'label' => 'Do we have access?', 'help_text' => null, 'outcomes' => [
                $this->outcome('yes', 'Yes', ['step' => 'readers']),
                $this->outcome('no', 'No', ['finish' => 'needs_access_path']),
                $this->outcome('cannot_get', "Can't get it", ['finish' => 'unavailable']),
            ]],
            [
                'key' => 'readers', 'kind' => 'question', 'label' => 'How many readers at once?',
                'help_text' => 'If you note a reader limit, add it to the public note for students.',
                'outcomes' => [
                    $this->outcome('unlimited', 'Unlimited', ['finish' => 'prepared']),
                    $this->outcome('limited_note', 'Limited; note the limit', ['finish' => 'prepared']),
                    $this->outcome('limited_buy', 'Limited; buy more seats', ['handoff_group' => 'Acquisitions']),
                ],
            ],
            $this->finish('prepared', 'Prepared', 'prepared', false),
            $this->finish('needs_access_path', 'Needs access path', 'needs_access_path', false),
            $this->finish('unavailable', 'Unavailable', 'unavailable', true),
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
